"""Configurações e Feature Flags do Backend (Apuração 2º Turno - Eleições 2026)."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on", "s", "sim"}


def _env_int(name: str, default: int) -> int:
    val = os.getenv(name)
    if val is None:
        return default
    try:
        return int(val.strip())
    except ValueError:
        return default


def _parse_cors_origins(val: str | None, default: list[str]) -> list[str]:
    if not val:
        return default
    cleaned = val.strip()
    if cleaned.startswith("[") and cleaned.endswith("]"):
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass
    return [origin.strip() for origin in cleaned.split(",") if origin.strip()]


@dataclass
class Settings:
    """Configurações carregadas de variáveis de ambiente."""

    # Fonte de dados do TSE:
    # - "live": consulta https://resultados.tse.jus.br (com cache de 1º turno e respeito a ETag/45-60s)
    # - "sim_2026": reproduz progressão simulada de 0% a 100% sobre a base real de 2026
    # - "replay_2022": reproduz as fixtures históricas do 2º turno de 2022
    tse_source_mode: str = field(
        default_factory=lambda: os.getenv("TSE_SOURCE_MODE", "live").strip().lower()
    )
    tse_base_url: str = field(
        default_factory=lambda: os.getenv(
            "TSE_BASE_URL", "https://resultados.tse.jus.br"
        ).rstrip("/")
    )
    tse_environment: str = field(
        default_factory=lambda: os.getenv("TSE_ENVIRONMENT", "oficial").strip()
    )
    tse_cycle: str = field(
        default_factory=lambda: os.getenv("TSE_CYCLE", "ele2026").strip()
    )

    # Resolução TSE nº 23.751/2026, arts. 264 a 269:
    # Intervalo mínimo de 45-60s por arquivo e controle estrito de concorrência
    tse_poll_interval_seconds: int = field(
        default_factory=lambda: _env_int("TSE_POLL_INTERVAL_SECONDS", 60)
    )
    tse_min_file_interval_seconds: int = field(
        default_factory=lambda: _env_int("TSE_MIN_FILE_INTERVAL_SECONDS", 50)
    )
    tse_max_concurrent_requests: int = field(
        default_factory=lambda: _env_int("TSE_MAX_CONCURRENT_REQUESTS", 8)
    )
    tse_request_timeout_seconds: float = field(
        default_factory=lambda: float(os.getenv("TSE_REQUEST_TIMEOUT_SECONDS", "15.0"))
    )

    # Caminhos de persistência e publicação estática (CDN / public/snapshots)
    data_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("DATA_DIR", str(ROOT_DIR / "backend" / "data"))
        )
    )
    snapshot_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("SNAPSHOT_DIR", str(ROOT_DIR / "public" / "snapshots"))
        )
    )
    fixtures_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("FIXTURES_DIR", str(ROOT_DIR / "backend" / "fixtures"))
        )
    )

    # Feature Flags (podem ser desligadas sem novo deploy)
    feature_reference_scenario: bool = field(
        default_factory=lambda: _env_bool("FEATURE_REFERENCE_SCENARIO", False)
    )
    feature_narrator: bool = field(
        default_factory=lambda: _env_bool("FEATURE_NARRATOR", True)
    )
    feature_replay: bool = field(
        default_factory=lambda: _env_bool("FEATURE_REPLAY", True)
    )

    # Segurança, CORS e Rate Limit da API
    cors_origins: list[str] = field(
        default_factory=lambda: _parse_cors_origins(
            os.getenv("CORS_ORIGINS"),
            [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            ],
        )
    )
    cors_origin_regex: str = field(
        default_factory=lambda: os.getenv(
            "CORS_ORIGIN_REGEX",
            r"^https:\/\/.*\.vercel\.app$",
        ).strip()
    )
    rate_limit_requests_per_minute: int = field(
        default_factory=lambda: _env_int("RATE_LIMIT_RPM", 240)
    )

    # Alertas e Monitoramento Operacional (/status)
    stale_warning_seconds: int = field(
        default_factory=lambda: _env_int("STALE_WARNING_SECONDS", 180)
    )
    alert_stale_seconds: int = field(
        default_factory=lambda: _env_int("ALERT_STALE_SECONDS", 300)
    )
    alert_webhook_url: str = field(
        default_factory=lambda: os.getenv("ALERT_WEBHOOK_URL", "").strip()
    )
    alert_telegram_bot_token: str = field(
        default_factory=lambda: os.getenv("ALERT_TELEGRAM_BOT_TOKEN", "").strip()
    )
    alert_telegram_chat_id: str = field(
        default_factory=lambda: os.getenv("ALERT_TELEGRAM_CHAT_ID", "").strip()
    )
    alert_email_to: str = field(
        default_factory=lambda: os.getenv("ALERT_EMAIL_TO", "").strip()
    )

    @property
    def db_path(self) -> Path:
        return self.data_dir / "apuracao_2026.sqlite"

    @property
    def baseline_1t_path(self) -> Path:
        return self.data_dir / "baseline_1t_2026.json"


def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.snapshot_dir.mkdir(parents=True, exist_ok=True)
    return settings
