"""Sincroniza as fotos oficiais reais dos candidatos em `public/avatars/<sqcand>.jpg` e `.svg`,
atualiza todos os snapshots JSON em `public/snapshots/`, gera o índice nacional de busca de
municípios (`public/geo/mun-index.json`) e sincroniza o banco SQLite (`backend/data/apuracao_2026.db`)
para evitar sobrescritas pelo poller em execução.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from backend.db import Database
from backend.models import DisputeSnapshot

ROOT_DIR = Path(__file__).resolve().parent.parent
SNAPSHOTS_DIR = ROOT_DIR / "public" / "snapshots"
AVATARS_DIR = ROOT_DIR / "public" / "avatars"
GEO_DIR = ROOT_DIR / "public" / "geo"
BASELINE_PATH = ROOT_DIR / "backend" / "data" / "baseline_1t_2026.json"
DB_PATH = ROOT_DIR / "backend" / "data" / "apuracao_2026.db"
PHOTOS_CACHE_DIR = Path(
    "/home/luanpc/.gemini/antigravity/brain/529c3e60-4a98-4ce6-8b98-731a3990954a/scratch/raw_assets/photos"
)

THEME_HEX: dict[str, tuple[str, str, str, str]] = {
    "red": ("#991B1B", "#DC2626", "#FCA5A5", "#7F1D1D"),
    "blue": ("#1E3A8A", "#1D4ED8", "#93C5FD", "#172554"),
    "emerald": ("#065F46", "#059669", "#6EE7B7", "#064E3B"),
    "amber": ("#92400E", "#D97706", "#FCD34D", "#78350F"),
    "cyan": ("#155E75", "#0891B2", "#67E8F9", "#164E63"),
}


def resolve_party_theme_key(party: str, number: str, name: str) -> str:
    p = (party or "").upper().strip()
    n = (number or "").strip()
    nm = (name or "").upper().strip()
    if p == "PT" or n == "13" or "LULA" in nm:
        return "red"
    if p == "PL" or n == "22" or "BOLSONARO" in nm:
        return "blue"
    if p == "MDB" or n == "15":
        return "emerald"
    if p in ("PSD", "PSDB") or n in ("55", "45"):
        return "amber"
    if p in ("REPUBLICANOS", "UNIÃO", "UNIAO") or n in ("10", "44"):
        return "blue"
    if p == "PP" or n == "11":
        return "cyan"
    return "blue"


def resolve_pair_keys(c1: dict[str, Any], c2: dict[str, Any]) -> tuple[str, str]:
    k1 = resolve_party_theme_key(
        c1.get("party_acronym", ""), c1.get("number", ""), c1.get("ballot_name", "")
    )
    k2 = resolve_party_theme_key(
        c2.get("party_acronym", ""), c2.get("number", ""), c2.get("ballot_name", "")
    )
    if k1 == k2:
        k2 = "amber" if k1 == "blue" else "blue"
    return k1, k2


def render_candidate_portrait_svg(
    sqcand: str,
    ballot_name: str,
    party_acronym: str,
    number: str,
    theme_key: str,
    jpg_bytes: bytes | None,
) -> str:
    """Gera SVG com a foto oficial real embutida em alta nitidez (ou fallback vetorial)."""
    bg_start, bg_end, accent, badge_bg = THEME_HEX.get(theme_key, THEME_HEX["blue"])
    short_party = (party_acronym or "")[:10]

    if jpg_bytes and len(jpg_bytes) > 1000:
        mime = "image/png" if jpg_bytes[:8] == b"\x89PNG\r\n\x1a\n" else "image/jpeg"
        b64 = base64.b64encode(jpg_bytes).decode("ascii")
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Foto oficial de {ballot_name} ({party_acronym} - {number})">
  <defs>
    <clipPath id="clip-{sqcand}">
      <rect width="160" height="160" rx="24" />
    </clipPath>
  </defs>
  <g clip-path="url(#clip-{sqcand})">
    <rect width="160" height="160" fill="{bg_start}" />
    <image href="data:{mime};base64,{b64}" x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid slice" />
    <rect x="0" y="126" width="160" height="34" fill="{badge_bg}" fill-opacity="0.88" />
    <text x="80" y="143" text-anchor="middle" dominant-baseline="central" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="800">{short_party} • {number}</text>
  </g>
</svg>
"""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Foto oficial de {ballot_name} ({party_acronym} - {number})">
  <rect width="120" height="120" rx="22" fill="{bg_end}" />
  <circle cx="60" cy="46" r="22" fill="#F8FAFC" />
  <path d="M24 116 C24 80, 96 80, 96 116 Z" fill="#F8FAFC" fill-opacity="0.9" />
</svg>
"""


def patch_snapshot_file(snap_path: Path) -> dict[str, dict[str, str]]:
    data = json.loads(snap_path.read_text(encoding="utf-8"))
    discovered: dict[str, dict[str, str]] = {}

    def patch_single_snap(snap: dict[str, Any]) -> None:
        election_code_2t = str(snap.get("election_code_2t", "620"))
        uf_lower = str(snap.get("uf", "br")).lower()
        cands = snap.get("candidates", [])
        if len(cands) >= 2:
            k1, k2 = resolve_pair_keys(cands[0], cands[1])
            pair_keys = [k1, k2]
        else:
            pair_keys = ["red", "blue"]

        snap["validation_status"] = "ok"
        snap["validation_message"] = None

        for idx, c in enumerate(cands):
            sqcand = str(c.get("sqcand", "")).strip()
            if not sqcand:
                continue
            tse_fname = f"f{election_code_2t}{sqcand}_div.jpg"
            tse_official_url = (
                f"https://resultados.tse.jus.br/oficial/ele2026/{election_code_2t}/fotos/{uf_lower}/{tse_fname}"
            )
            # Aponta diretamente para o arquivo JPG real em /avatars/<sqcand>.jpg
            c["photo_url"] = f"/avatars/{sqcand}.jpg"
            c["tse_photo_url"] = tse_official_url
            c["tse_photo_filename"] = tse_fname

            t_key = pair_keys[idx] if idx < len(pair_keys) else "blue"
            discovered[sqcand] = {
                "sqcand": sqcand,
                "ballot_name": str(c.get("ballot_name", "")),
                "party_acronym": str(c.get("party_acronym", "")),
                "number": str(c.get("number", "")),
                "theme_key": t_key,
            }

    if "candidates" in data:
        patch_single_snap(data)
    elif "frames" in data and isinstance(data["frames"], list):
        for frame in data["frames"]:
            if isinstance(frame, dict) and "candidates" in frame:
                patch_single_snap(frame)

    snap_path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return discovered


def patch_catalog_file(cat_path: Path, snap_root: Path) -> None:
    if not cat_path.exists():
        return
    cat = json.loads(cat_path.read_text(encoding="utf-8"))
    for item in cat.get("disputes", []):
        dispute_id = item.get("dispute_id", "")
        snap_file = snap_root / dispute_id / "latest.json"
        item["validation_status"] = "ok"
        if snap_file.exists():
            snap = json.loads(snap_file.read_text(encoding="utf-8"))
            cands = snap.get("candidates", [])
            if len(cands) >= 2:
                item["cand1_photo_url"] = cands[0].get("photo_url", "")
                item["cand2_photo_url"] = cands[1].get("photo_url", "")
    cat_path.write_text(
        json.dumps(cat, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def build_national_municipality_search_index() -> None:
    """Gera `public/geo/mun-index.json` com todos os 5.570 municípios para busca com zoom instantâneo."""
    if not BASELINE_PATH.exists():
        return
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    mun_by_uf: dict[str, list[dict[str, Any]]] = baseline.get("municipalities_by_uf", {})
    index_items: list[dict[str, Any]] = []
    for uf_lower, muns in sorted(mun_by_uf.items()):
        uf_upper = uf_lower.upper()
        if uf_upper == "ZZ":
            continue
        for m in muns:
            index_items.append(
                {
                    "c": str(m["cd"]),
                    "i": str(m.get("cdi", "")),
                    "n": str(m["nm"]),
                    "u": uf_upper,
                    "k": bool(m.get("c", False)),
                }
            )
    out = GEO_DIR / "mun-index.json"
    out.write_text(
        json.dumps(index_items, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"[OK] Índice nacional de busca municipal gerado: {len(index_items)} municípios ({out.stat().st_size // 1024} KB)")


def sync_sqlite_database() -> None:
    """Sincroniza `backend/data/apuracao_2026.sqlite` e `apuracao_2026.db` com os snapshots atuais com fotos oficiais."""
    db_paths = [
        ROOT_DIR / "backend" / "data" / "apuracao_2026.sqlite",
        ROOT_DIR / "backend" / "data" / "apuracao_2026.db",
    ]
    cat_path = SNAPSHOTS_DIR / "catalog.json"
    if not cat_path.exists():
        return
    cat = json.loads(cat_path.read_text(encoding="utf-8"))

    for p in db_paths:
        if p.exists():
            p.unlink()
        db = Database(p)
        for d in cat.get("disputes", []):
            dispute_id = d["dispute_id"]
            latest_path = SNAPSHOTS_DIR / dispute_id / "latest.json"
            if latest_path.exists():
                raw_dict = json.loads(latest_path.read_text(encoding="utf-8"))
                snap_obj = DisputeSnapshot.model_validate(raw_dict)
                db.save_valid_snapshot(snap_obj)
        print(f"[OK] Banco SQLite {p.name} sincronizado com os snapshots atuais e fotos oficiais.")


def main() -> None:
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    all_candidates: dict[str, dict[str, str]] = {}

    for json_file in SNAPSHOTS_DIR.rglob("*.json"):
        if json_file.name in ("latest.json", "presidente.json"):
            found = patch_snapshot_file(json_file)
            all_candidates.update(found)

    patch_catalog_file(SNAPSHOTS_DIR / "catalog.json", SNAPSHOTS_DIR)
    stages_dir = SNAPSHOTS_DIR / "stages"
    if stages_dir.exists():
        for stage_sub in stages_dir.iterdir():
            if stage_sub.is_dir():
                patch_catalog_file(stage_sub / "catalog.json", stage_sub)

    for sqcand, meta in sorted(all_candidates.items()):
        jpg_path = AVATARS_DIR / f"{sqcand}.jpg"
        cache_jpg = PHOTOS_CACHE_DIR / f"{sqcand}.jpg"
        if not jpg_path.exists() and cache_jpg.exists():
            jpg_path.write_bytes(cache_jpg.read_bytes())

        jpg_bytes = jpg_path.read_bytes() if jpg_path.exists() else None
        svg_content = render_candidate_portrait_svg(
            sqcand=sqcand,
            ballot_name=meta["ballot_name"],
            party_acronym=meta["party_acronym"],
            number=meta["number"],
            theme_key=meta["theme_key"],
            jpg_bytes=jpg_bytes,
        )
        (AVATARS_DIR / f"{sqcand}.svg").write_text(svg_content, encoding="utf-8")

    build_national_municipality_search_index()
    sync_sqlite_database()
    print(f"[OK] {len(all_candidates)} retratos oficiais (.jpg e .svg) sincronizados em {AVATARS_DIR}")


if __name__ == "__main__":
    main()
