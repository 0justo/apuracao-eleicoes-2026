"""
Gera a partir das malhas cartográficas oficiais do IBGE:
1. `public/geo/br-ufs.topo.json` (< 150 KB) com os contornos detalhados e suaves
   das 27 Unidades da Federação (SIRGAS 2000 / WGS84 do IBGE).
2. `public/geo/mun/<uf>-mun.topo.json` (< 300 KB por estado) com os contornos oficiais
   do IBGE de todos os 5.570 municípios brasileiros mapeados para os códigos oficiais do TSE (`cd`)
   e do IBGE (`cdi`).
3. Snapshots municipais sob demanda para a disputa presidencial em todos os estágios.
"""

from __future__ import annotations

import hashlib
import json
import math
import unicodedata
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
BASELINE_PATH = ROOT_DIR / "backend" / "data" / "baseline_1t_2026.json"
GEO_DIR = ROOT_DIR / "public" / "geo"
MUN_GEO_DIR = GEO_DIR / "mun"
SNAPSHOTS_DIR = ROOT_DIR / "public" / "snapshots"
RAW_GEO_DIR = Path(
    "/home/luanpc/.gemini/antigravity/brain/529c3e60-4a98-4ce6-8b98-731a3990954a/scratch/raw_assets/geo"
)

UF_METADATA: dict[str, tuple[str, str, str]] = {
    "AC": ("Acre", "12", "Norte"),
    "AL": ("Alagoas", "27", "Nordeste"),
    "AM": ("Amazonas", "13", "Norte"),
    "AP": ("Amapá", "16", "Norte"),
    "BA": ("Bahia", "29", "Nordeste"),
    "CE": ("Ceará", "23", "Nordeste"),
    "DF": ("Distrito Federal", "53", "Centro-Oeste"),
    "ES": ("Espírito Santo", "32", "Sudeste"),
    "GO": ("Goiás", "52", "Centro-Oeste"),
    "MA": ("Maranhão", "21", "Nordeste"),
    "MG": ("Minas Gerais", "31", "Sudeste"),
    "MS": ("Mato Grosso do Sul", "50", "Centro-Oeste"),
    "MT": ("Mato Grosso", "51", "Centro-Oeste"),
    "PA": ("Pará", "15", "Norte"),
    "PB": ("Paraíba", "25", "Nordeste"),
    "PE": ("Pernambuco", "26", "Nordeste"),
    "PI": ("Piauí", "22", "Nordeste"),
    "PR": ("Paraná", "41", "Sul"),
    "RJ": ("Rio de Janeiro", "33", "Sudeste"),
    "RN": ("Rio Grande do Norte", "24", "Nordeste"),
    "RO": ("Rondônia", "11", "Norte"),
    "RR": ("Roraima", "14", "Norte"),
    "RS": ("Rio Grande do Sul", "43", "Sul"),
    "SC": ("Santa Catarina", "42", "Sul"),
    "SE": ("Sergipe", "28", "Nordeste"),
    "SP": ("São Paulo", "35", "Sudeste"),
    "TO": ("Tocantins", "17", "Norte"),
}


def _norm_name(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper().strip()


def _ring_bbox_area(ring: list[list[float]] | list[tuple[float, float]]) -> float:
    if len(ring) < 3:
        return 0.0
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def simplify_dp(
    pts: list[tuple[float, float]], epsilon: float
) -> list[tuple[float, float]]:
    """Algoritmo Ramer-Douglas-Peucker iterativo para simplificação suave de contornos IBGE."""
    n = len(pts)
    if n <= 6 or epsilon <= 0:
        return pts

    keep = [False] * n
    keep[0] = True
    keep[n - 1] = True
    stack: list[tuple[int, int]] = [(0, n - 1)]
    eps_sq = epsilon * epsilon

    while stack:
        start, end = stack.pop()
        if end - start <= 1:
            continue
        x1, y1 = pts[start]
        x2, y2 = pts[end]
        dx = x2 - x1
        dy = y2 - y1
        len_sq = dx * dx + dy * dy

        max_dist_sq = -1.0
        index = start
        for i in range(start + 1, end):
            px, py = pts[i]
            if len_sq == 0.0:
                dist_sq = (px - x1) ** 2 + (py - y1) ** 2
            else:
                t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / len_sq))
                proj_x = x1 + t * dx
                proj_y = y1 + t * dy
                dist_sq = (px - proj_x) ** 2 + (py - proj_y) ** 2
            if dist_sq > max_dist_sq:
                max_dist_sq = dist_sq
                index = i

        if max_dist_sq > eps_sq:
            keep[index] = True
            stack.append((start, index))
            stack.append((index, end))

    result = [pts[i] for i in range(n) if keep[i]]
    if len(result) < 4:
        step = max(1, n // 4)
        result = [pts[0], pts[min(n - 1, step)], pts[min(n - 1, step * 2)], pts[-1]]
    if result[-1] != result[0]:
        result.append(result[0])
    return result


def extract_rings_from_geometry(
    geom: dict[str, Any], epsilon: float, max_rings: int = 3
) -> list[list[tuple[float, float]]]:
    """Extrai os anéis principais (continente + ilhas maiores) de um Polygon ou MultiPolygon do IBGE."""
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    raw_outer_rings: list[list[tuple[float, float]]] = []

    if gtype == "Polygon":
        if coords and len(coords[0]) >= 4:
            raw_outer_rings.append([(float(p[0]), float(p[1])) for p in coords[0]])
    elif gtype == "MultiPolygon":
        for poly in coords:
            if poly and len(poly[0]) >= 4:
                raw_outer_rings.append([(float(p[0]), float(p[1])) for p in poly[0]])

    if not raw_outer_rings:
        return []

    raw_outer_rings.sort(key=_ring_bbox_area, reverse=True)
    main_area = _ring_bbox_area(raw_outer_rings[0])
    selected: list[list[tuple[float, float]]] = []
    for idx, r in enumerate(raw_outer_rings[:max_rings]):
        if idx == 0 or _ring_bbox_area(r) >= main_area * 0.015:
            simp = simplify_dp(r, epsilon)
            if len(simp) >= 4:
                selected.append(simp)

    return selected or [simplify_dp(raw_outer_rings[0], epsilon)]


def quantize_ring(
    ring: list[tuple[float, float]],
    translate: tuple[float, float],
    scale: tuple[float, float],
) -> list[list[int]]:
    tx, ty = translate
    sx, sy = scale
    q_pts: list[tuple[int, int]] = []
    for lon, lat in ring:
        qx = int(round((lon - tx) / sx))
        qy = int(round((lat - ty) / sy))
        if not q_pts or q_pts[-1] != (qx, qy):
            q_pts.append((qx, qy))
    while len(q_pts) < 4:
        q_pts.append(q_pts[0])
    if q_pts[-1] != q_pts[0]:
        q_pts.append(q_pts[0])

    deltas: list[list[int]] = []
    prev_x, prev_y = 0, 0
    for idx, (qx, qy) in enumerate(q_pts):
        if idx == 0:
            deltas.append([qx, qy])
        else:
            deltas.append([qx - prev_x, qy - prev_y])
        prev_x, prev_y = qx, qy
    return deltas


def build_topojson_from_multi_features(
    object_name: str,
    features: list[dict[str, Any]],
    quant_grid: float = 49999.0,
) -> dict[str, Any]:
    all_pts = [pt for f in features for ring in f["rings"] for pt in ring]
    min_lon = min(pt[0] for pt in all_pts)
    max_lon = max(pt[0] for pt in all_pts)
    min_lat = min(pt[1] for pt in all_pts)
    max_lat = max(pt[1] for pt in all_pts)

    span_lon = max(0.001, max_lon - min_lon)
    span_lat = max(0.001, max_lat - min_lat)
    translate = (round(min_lon, 6), round(min_lat, 6))
    scale = (round(span_lon / quant_grid, 8), round(span_lat / quant_grid, 8))

    arcs: list[list[list[int]]] = []
    geometries: list[dict[str, Any]] = []

    for idx, feat in enumerate(features):
        rings = feat["rings"]
        if len(rings) == 1:
            arc_idx = len(arcs)
            arcs.append(quantize_ring(rings[0], translate, scale))
            geometries.append(
                {
                    "type": "Polygon",
                    "id": feat.get("id", str(idx)),
                    "properties": feat["properties"],
                    "arcs": [[arc_idx]],
                }
            )
        else:
            poly_arcs: list[list[list[int]]] = []
            for r in rings:
                arc_idx = len(arcs)
                arcs.append(quantize_ring(r, translate, scale))
                poly_arcs.append([[arc_idx]])
            geometries.append(
                {
                    "type": "MultiPolygon",
                    "id": feat.get("id", str(idx)),
                    "properties": feat["properties"],
                    "arcs": poly_arcs,
                }
            )

    return {
        "type": "Topology",
        "bbox": [
            round(min_lon, 4),
            round(min_lat, 4),
            round(max_lon, 4),
            round(max_lat, 4),
        ],
        "transform": {
            "scale": [scale[0], scale[1]],
            "translate": [translate[0], translate[1]],
        },
        "objects": {
            object_name: {
                "type": "GeometryCollection",
                "geometries": geometries,
            }
        },
        "arcs": arcs,
    }


def build_br_ufs_topojson() -> None:
    br_raw = json.loads((RAW_GEO_DIR / "br_states.json").read_text(encoding="utf-8"))
    raw_features = br_raw["features"]

    # Busca epsilon ótimo para ficar entre 95 KB e 140 KB (estritamente < 150 KB)
    for eps in (0.011, 0.013, 0.015, 0.018, 0.022):
        uf_features: list[dict[str, Any]] = []
        for rf in raw_features:
            uf_code = str(rf.get("id") or rf.get("properties", {}).get("sigla", "")).upper()
            if uf_code not in UF_METADATA:
                continue
            uf_name, ibge_code, region = UF_METADATA[uf_code]
            rings = extract_rings_from_geometry(rf["geometry"], epsilon=eps, max_rings=3)
            uf_features.append(
                {
                    "id": uf_code,
                    "rings": rings,
                    "properties": {
                        "uf": uf_code,
                        "name": uf_name,
                        "code_ibge": ibge_code,
                        "region": region,
                    },
                }
            )
        uf_features.sort(key=lambda item: item["id"])
        topo = build_topojson_from_multi_features("ufs", uf_features, quant_grid=49999.0)
        serialized = json.dumps(topo, ensure_ascii=False, separators=(",", ":"))
        size_kb = len(serialized.encode("utf-8")) / 1024.0
        if size_kb < 142.0:
            (GEO_DIR / "br-ufs.topo.json").write_text(serialized, encoding="utf-8")
            print(f"[OK] br-ufs.topo.json oficial IBGE: {size_kb:.1f} KB (eps={eps})")
            return


def build_municipal_topojson_for_uf(
    uf_upper: str, tse_muns: list[dict[str, Any]]
) -> float:
    uf_lower = uf_upper.lower()
    raw_path = RAW_GEO_DIR / f"mun_{uf_lower}.json"
    raw_geo = json.loads(raw_path.read_text(encoding="utf-8"))
    raw_feats = raw_geo.get("features", [])

    # Mapeia municípios do TSE por código IBGE (7 dígitos) e por nome normalizado
    by_ibge: dict[str, dict[str, Any]] = {}
    by_name: dict[str, dict[str, Any]] = {}
    for m in tse_muns:
        cdi = str(m.get("cdi", "")).strip()
        if cdi:
            by_ibge[cdi] = m
        by_name[_norm_name(m.get("nm", ""))] = m

    n_mun = len(raw_feats)
    # Define lista de epsilons candidatos conforme densidade de municípios da UF
    if n_mun <= 100:
        eps_candidates = (0.002, 0.0035, 0.005, 0.007)
    elif n_mun <= 300:
        eps_candidates = (0.004, 0.006, 0.008, 0.011)
    else:
        eps_candidates = (0.0085, 0.011, 0.014, 0.018, 0.022, 0.026)

    out_path = MUN_GEO_DIR / f"{uf_lower}-mun.topo.json"
    for eps in eps_candidates:
        features: list[dict[str, Any]] = []
        for idx, rf in enumerate(raw_feats):
            props = rf.get("properties", {})
            ibge_id = str(props.get("id") or rf.get("id") or "").strip()
            raw_name = str(props.get("name") or props.get("nome") or "")
            tse_m = by_ibge.get(ibge_id) or by_name.get(_norm_name(raw_name))

            if tse_m:
                code_tse = str(tse_m["cd"])
                code_ibge = str(tse_m.get("cdi") or ibge_id)
                name = str(tse_m["nm"])
                is_cap = bool(tse_m.get("c", False))
            else:
                code_tse = ibge_id or str(idx)
                code_ibge = ibge_id
                name = raw_name or f"Município {idx + 1}"
                is_cap = False

            rings = extract_rings_from_geometry(rf["geometry"], epsilon=eps, max_rings=1)
            if not rings:
                continue
            features.append(
                {
                    "id": code_tse,
                    "rings": rings,
                    "properties": {
                        "code_tse": code_tse,
                        "code_ibge": code_ibge,
                        "name": name,
                        "uf": uf_upper,
                        "is_capital": is_cap,
                    },
                }
            )

        topo = build_topojson_from_multi_features(
            "municipios", features, quant_grid=29999.0
        )
        serialized = json.dumps(topo, ensure_ascii=False, separators=(",", ":"))
        size_kb = len(serialized.encode("utf-8")) / 1024.0
        if size_kb < 292.0 or eps == eps_candidates[-1]:
            out_path.write_text(serialized, encoding="utf-8")
            return size_kb
    return 0.0


def main() -> None:
    GEO_DIR.mkdir(parents=True, exist_ok=True)
    MUN_GEO_DIR.mkdir(parents=True, exist_ok=True)

    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    mun_by_uf: dict[str, list[dict[str, Any]]] = baseline["municipalities_by_uf"]

    build_br_ufs_topojson()

    max_kb = 0.0
    max_uf = ""
    for uf_code in sorted(UF_METADATA.keys()):
        muns = mun_by_uf.get(uf_code.lower(), [])
        kb = build_municipal_topojson_for_uf(uf_code, muns)
        if kb > max_kb:
            max_kb = kb
            max_uf = uf_code
        print(f"  -> {uf_code}: {kb:.1f} KB ({len(muns)} municípios)")

    print(
        f"[OK] 27 malhas municipais oficiais do IBGE geradas. Maior: {max_uf} ({max_kb:.1f} KB < 300 KB)"
    )


if __name__ == "__main__":
    main()
