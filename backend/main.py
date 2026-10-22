"""Aplicação FastAPI — Backend e Publicador de Snapshots "Apuração 2º Turno" (Eleições 2026)."""

from __future__ import annotations

from collections import defaultdict, deque
from contextlib import asynccontextmanager
import json
import os
import time
from typing import Any

import brotli
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.alerts import AlertManager
from backend.baseline_1t import Baseline1TStore
from backend.calculator import calculate_turnaround
from backend.config import Settings, get_settings
from backend.db import Database
from backend.poller import ElectionPoller
from backend.publisher import SnapshotPublisher, _atomic_write_json
from backend.tse_client import TSEClient


class AppState:
    """Estado global compartilhado da aplicação."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.started_at = time.time()
        self.db = Database(self.settings.db_path)
        self.client = TSEClient(self.settings, self.db)
        self.baseline_store = Baseline1TStore(self.settings.baseline_1t_path)
        self.publisher = SnapshotPublisher(self.settings, self.db)
        self.alert_manager = AlertManager(self.settings, self.db)
        self.poller = ElectionPoller(
            settings=self.settings,
            db=self.db,
            client=self.client,
            baseline_store=self.baseline_store,
            publisher=self.publisher,
            alert_manager=self.alert_manager,
        )


def create_app(custom_settings: Settings | None = None, start_poller: bool = True) -> FastAPI:
    state = AppState(custom_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.core = state
        if start_poller and os.getenv("DISABLE_STARTUP_POLLER") != "1":
            try:
                await state.poller.run_single_cycle()
            except Exception as exc:
                state.db.log_event(
                    level="ERROR",
                    component="startup",
                    message=f"Falha no ciclo inicial: {exc}",
                )
            state.poller.start_background_loop()
        yield
        await state.poller.stop_background_loop()
        await state.client.close()

    app = FastAPI(
        title="Apuração 2º Turno 2026 — Backend & Snapshot Service",
        version="1.0.0",
        description=(
            "Serviço independente de agregação, validação de sanidade e geração de snapshots "
            "estáticos para acompanhamento do 2º turno das eleições brasileiras de 2026. "
            "Fonte oficial: TSE (https://resultados.tse.jus.br)."
        ),
        lifespan=lifespan,
    )
    app.state.core = state

    # CORS restrito aos domínios autorizados e deployments da Vercel (*.vercel.app)
    cors_kwargs: dict[str, Any] = {
        "allow_credentials": False,
        "allow_methods": ["GET", "HEAD", "OPTIONS"],
        "allow_headers": ["*"],
    }
    if "*" in state.settings.cors_origins:
        cors_kwargs["allow_origins"] = ["*"]
    else:
        cors_kwargs["allow_origins"] = state.settings.cors_origins
        if state.settings.cors_origin_regex:
            cors_kwargs["allow_origin_regex"] = state.settings.cors_origin_regex

    app.add_middleware(CORSMiddleware, **cors_kwargs)

    # Compressão GZip padrão (além de suporte Brotli em endpoints JSON pesados)
    app.add_middleware(GZipMiddleware, minimum_size=512)

    # Rate Limiting simples por IP em memória (janela deslizante de 60s)
    ip_buckets: dict[str, deque[float]] = defaultdict(deque)

    @app.middleware("http")
    async def rate_limit_and_cache_headers(request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        bucket = ip_buckets[client_ip]
        while bucket and (now - bucket[0]) > 60.0:
            bucket.popleft()

        if len(bucket) >= state.settings.rate_limit_requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Limite de requisições por minuto excedido. Tente novamente em instantes."
                },
                headers={"Retry-After": "15"},
            )
        bucket.append(now)

        response: Response = await call_next(request)
        if request.url.path.startswith("/snapshots/"):
            response.headers["Cache-Control"] = (
                "public, max-age=30, stale-while-revalidate=60"
            )
        return response

    @app.get("/health")
    async def healthcheck() -> dict[str, Any]:
        now = time.time()
        last_ok = state.poller.last_success_ts
        elapsed = round(now - last_ok, 1) if last_ok else None
        return {
            "status": "ok",
            "uptime_seconds": round(now - state.started_at, 1),
            "cycle_count": state.poller.cycle_count,
            "last_success_ts": last_ok,
            "seconds_since_last_update": elapsed,
            "source_mode": state.settings.tse_source_mode,
        }

    @app.get("/api/v1/status")
    async def system_status() -> dict[str, Any]:
        now = time.time()
        last_ok = state.poller.last_success_ts
        staleness = await state.alert_manager.check_and_notify_staleness(last_ok)
        poller_summary = state.db.get_poller_state("summary") or {}
        recent_events = state.db.get_recent_events(limit=25)
        recent_errors = state.db.get_recent_events(limit=10, level="ERROR")

        return {
            "service": "Apuração 2º Turno 2026",
            "status": "degraded" if staleness.get("critical_stale") else "healthy",
            "uptime_seconds": round(now - state.started_at, 1),
            "source_mode": state.settings.tse_source_mode,
            "tse_base_url": state.settings.tse_base_url,
            "poll_interval_seconds": state.settings.tse_poll_interval_seconds,
            "min_file_interval_seconds": state.settings.tse_min_file_interval_seconds,
            "cycle_count": state.poller.cycle_count,
            "last_success_ts": last_ok,
            "last_success_iso": poller_summary.get("last_success_iso"),
            "last_success_hms": poller_summary.get("last_success_hms"),
            "last_duration_ms": poller_summary.get("last_duration_ms"),
            "seconds_since_last_update": staleness.get("elapsed_seconds"),
            "is_stale_3min": staleness.get("stale"),
            "is_critical_stale_5min": staleness.get("critical_stale"),
            "discovered_gov_2t_ufs": poller_summary.get("discovered_gov_ufs", []),
            "feature_flags": {
                "reference_scenario": state.settings.feature_reference_scenario,
                "narrator": state.settings.feature_narrator,
                "replay": state.settings.feature_replay,
            },
            "recent_errors": recent_errors,
            "recent_events": recent_events,
        }

    @app.get("/api/v1/catalog")
    async def get_catalog() -> dict[str, Any]:
        cat_path = state.settings.snapshot_dir / "catalog.json"
        if not cat_path.exists():
            cat = await state.poller.run_single_cycle()
            return cat.model_dump()
        return json.loads(cat_path.read_text(encoding="utf-8"))

    @app.get("/api/v1/disputes/{dispute_id}")
    async def get_dispute_snapshot(dispute_id: str, request: Request) -> Response:
        snap_path = state.settings.snapshot_dir / dispute_id.lower() / "latest.json"
        if not snap_path.exists():
            snap = state.db.get_latest_snapshot(dispute_id.lower())
            if snap is None:
                raise HTTPException(
                    status_code=404, detail=f"Disputa '{dispute_id}' não encontrada."
                )
            raw_bytes = snap.model_dump_json().encode("utf-8")
        else:
            raw_bytes = snap_path.read_bytes()

        accept_enc = request.headers.get("accept-encoding", "")
        if "br" in accept_enc and len(raw_bytes) > 1024:
            compressed = brotli.compress(raw_bytes, quality=4)
            return Response(
                content=compressed,
                media_type="application/json",
                headers={
                    "Content-Encoding": "br",
                    "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
                },
            )
        return Response(
            content=raw_bytes,
            media_type="application/json",
            headers={"Cache-Control": "public, max-age=30, stale-while-revalidate=60"},
        )

    @app.get("/api/v1/disputes/{dispute_id}/turnaround")
    async def recalculate_dispute_turnaround(
        dispute_id: str,
        turnout_adjustment_pct: float = Query(
            default=0.0,
            ge=-30.0,
            le=20.0,
            description="Ajuste percentual sobre o comparecimento esperado do 1º turno (ex.: -5.0 para 5% menor)",
        ),
    ) -> dict[str, Any]:
        snap = state.db.get_latest_snapshot(dispute_id.lower())
        if snap is None:
            raise HTTPException(
                status_code=404, detail=f"Disputa '{dispute_id}' não encontrada."
            )
        res = calculate_turnaround(
            cand1=snap.candidates[0],
            cand2=snap.candidates[1],
            turnout_votes_2t=snap.electorate.turnout_votes,
            blank_votes_2t=snap.votes.blank_votes,
            null_votes_2t=snap.votes.null_votes,
            turnout_votes_1t=snap.electorate.turnout_1t,
            total_electorate_2t=snap.electorate.total_electorate,
            blank_null_rate_1t=snap.votes.blank_null_rate_1t,
            pct_counted=snap.sections.pct_counted,
            turnout_adjustment_pct=turnout_adjustment_pct,
            localities=snap.localities,
        )
        return res.model_dump()

    @app.get("/api/v1/presidente/municipalities/{uf}")
    async def get_pres_municipalities(uf: str) -> dict[str, Any]:
        uf_l = uf.lower().strip()
        if len(uf_l) != 2:
            raise HTTPException(status_code=400, detail="Sigla de UF inválida.")
        mun_snap_path = (
            state.settings.snapshot_dir / "presidente" / f"mun-{uf_l}.json"
        )
        if mun_snap_path.exists() and (time.time() - mun_snap_path.stat().st_mtime) < 60:
            return json.loads(mun_snap_path.read_text(encoding="utf-8"))

        items = await state.poller.get_or_build_pres_municipalities_for_uf(uf_l)
        payload = {
            "dispute_id": "presidente",
            "uf": uf_l.upper(),
            "generated_at_hms": time.strftime("%H:%M:%S"),
            "municipalities": items,
        }
        _atomic_write_json(mun_snap_path, payload)
        return payload

    @app.get("/api/v1/replay/2022")
    async def get_replay_2022() -> dict[str, Any]:
        replay_path = state.settings.snapshot_dir / "replay-2022" / "presidente.json"
        if not replay_path.exists():
            await state.poller.initialize()
        return json.loads(replay_path.read_text(encoding="utf-8"))

    # Monta o diretório de snapshots estáticos em /snapshots para servir localmente como CDN
    state.settings.snapshot_dir.mkdir(parents=True, exist_ok=True)
    app.mount(
        "/snapshots",
        StaticFiles(directory=str(state.settings.snapshot_dir)),
        name="snapshots",
    )

    return app


app = create_app()
