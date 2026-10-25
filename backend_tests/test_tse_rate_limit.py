"""Limite de requisições por segundo ao TSE (100/s por IP, contando os 304)."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import httpx

from backend.config import Settings
from backend.db import Database
from backend.tse_client import RequestPacer, TSEClient


def _max_in_any_second(starts: list[float]) -> int:
    starts = sorted(starts)
    best = 0
    j = 0
    for i, t in enumerate(starts):
        while starts[j] <= t - 1.0:
            j += 1
        best = max(best, i - j + 1)
    return best


async def test_pacer_nunca_passa_do_limite_por_segundo() -> None:
    pacer = RequestPacer()
    starts: list[float] = []

    async def one() -> None:
        await pacer.wait_turn(30)
        starts.append(time.monotonic())

    await asyncio.gather(*[one() for _ in range(75)])
    assert len(starts) == 75
    # 30/s com espaçamento fixo: no máximo 31 inícios em qualquer janela de 1 s
    assert _max_in_any_second(starts) <= 31


async def test_fetch_json_respeita_o_limite_mesmo_com_cdn_instantanea(tmp_path: Path) -> None:
    starts: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        starts.append(time.monotonic())
        return httpx.Response(200, json={"ok": True})

    settings = Settings(
        data_dir=tmp_path / "data",
        snapshot_dir=tmp_path / "snapshots",
        fixtures_dir=tmp_path / "fixtures",
        tse_max_concurrent_requests=8,
        tse_max_requests_per_second=40,
    )
    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    client = TSEClient(settings, Database(tmp_path / "data" / "t.db"))
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    try:
        # 120 arquivos diferentes de uma vez, como os municípios de um estado no pico
        urls = [f"https://resultados.tse.jus.br/teste/{i:05d}-u.json" for i in range(120)]
        await asyncio.gather(*[client.fetch_json(u) for u in urls])
    finally:
        await client.close()

    assert len(starts) == 120
    assert _max_in_any_second(starts) <= 41
