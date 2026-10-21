"""Baixa as fotos oficiais dos candidatos (Wikimedia Commons / Wikipedia REST API)
e salva em `public/avatars/<sqcand>.jpg` e no cache de scratch.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
import urllib.parse

import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
AVATARS_DIR = ROOT_DIR / "public" / "avatars"
PHOTOS_RAW_DIR = Path(
    "/home/luanpc/.gemini/antigravity/brain/529c3e60-4a98-4ce6-8b98-731a3990954a/scratch/raw_assets/photos"
)

CANDIDATE_WIKI_TARGETS: dict[str, list[str]] = {
    "280002542548": ["Luiz_Inácio_Lula_da_Silva"],
    "280001607829": ["Luiz_Inácio_Lula_da_Silva"],
    "280002551544": ["Flávio_Bolsonaro"],
    "280001618036": ["Jair_Bolsonaro"],
    "10002532492": ["Alan_Rick"],
    "10002544107": ["Mailza_Gomes", "Mailza"],
    "40002532272": ["Omar_Aziz"],
    "40002541626": ["Maria_do_Carmo_Seffair"],
    "70002552496": ["Celina_Leão"],
    "70002553055": ["Leandro_Grass"],
    "80002552172": ["Ricardo_Ferraço"],
    "80002552682": ["Lorenzo_Pazolini"],
    "200002534001": ["Carlos_Eduardo_Xavier", "Fátima_Bezerra"],
    "200002535255": ["Allyson_Bezerra"],
    "270002544544": ["Dorinha_Rezende", "Professora_Dorinha", "Dorinha_Seabra_Rezende"],
    "270002544599": ["Vicentinho_Júnior"],
}


async def find_photo_url(client: httpx.AsyncClient, titles: list[str]) -> str | None:
    for t in titles:
        url = f"https://pt.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(t)}"
        try:
            r = await client.get(url)
            if r.status_code == 200:
                d = r.json()
                thumb = d.get("thumbnail", {}).get("source") or d.get("originalimage", {}).get("source")
                if thumb:
                    return thumb
        except Exception:
            pass

    for t in titles:
        q = t.replace("_", " ")
        commons_url = (
            "https://commons.wikimedia.org/w/api.php?"
            f"action=query&generator=search&gsrsearch={urllib.parse.quote(q)}"
            "&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=360&format=json"
        )
        try:
            r = await client.get(commons_url)
            if r.status_code == 200:
                pages = r.json().get("query", {}).get("pages", {})
                for p in pages.values():
                    ii = p.get("imageinfo", [])
                    if ii:
                        u = ii[0].get("thumburl") or ii[0].get("url")
                        if u and any(ext in u.lower() for ext in (".jpg", ".jpeg", ".png")):
                            return u
        except Exception:
            pass
    return None


async def main() -> None:
    PHOTOS_RAW_DIR.mkdir(parents=True, exist_ok=True)
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    headers = {
        "User-Agent": "Apuracao2026App/1.0 (https://github.com/apuracao2026; contact@apuracao2026.org)"
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=25.0) as client:
        for sqcand, titles in CANDIDATE_WIKI_TARGETS.items():
            img_url = await find_photo_url(client, titles)
            if not img_url:
                print(f"[MISS] Sem URL para {sqcand}")
                continue
            r = await client.get(img_url)
            if r.status_code == 200 and len(r.content) > 1500:
                (PHOTOS_RAW_DIR / f"{sqcand}.jpg").write_bytes(r.content)
                (AVATARS_DIR / f"{sqcand}.jpg").write_bytes(r.content)
                print(f"[OK] {sqcand} ({titles[0]}) -> {len(r.content) // 1024} KB")
            else:
                print(f"[ERR] {sqcand} HTTP {r.status_code} ({len(r.content)} B)")


if __name__ == "__main__":
    asyncio.run(main())
