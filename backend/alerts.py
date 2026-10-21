"""Sistema de Alertas Operacionais (Webhook / Telegram / Log Estruturado).

Dispara alerta caso o poller fique mais de `alert_stale_seconds` (padrão 5 minutos = 300s)
sem concluir uma atualização válida ou em caso de falha repetida de validação.
"""

from __future__ import annotations

import time
from typing import Any
import httpx

from backend.config import Settings
from backend.db import Database


class AlertManager:
    """Monitora atrasos de atualização e dispara alertas com cooldown para evitar spam."""

    def __init__(self, settings: Settings, db: Database) -> None:
        self.settings = settings
        self.db = db
        self._last_alert_ts: float = 0.0
        self._cooldown_seconds: float = 300.0

    async def check_and_notify_staleness(
        self, last_success_ts: float | None
    ) -> dict[str, Any]:
        now = time.time()
        if last_success_ts is None:
            return {"stale": False, "elapsed_seconds": 0.0, "alert_triggered": False}

        elapsed = max(0.0, now - last_success_ts)
        is_stale_alert = elapsed >= self.settings.alert_stale_seconds

        alert_sent = False
        if is_stale_alert and (now - self._last_alert_ts) >= self._cooldown_seconds:
            self._last_alert_ts = now
            msg = (
                f"[ALERTA APURAÇÃO 2º TURNO] Poller sem atualização bem-sucedida há "
                f"{int(elapsed)}s (limite configurado: {self.settings.alert_stale_seconds}s)."
            )
            self.db.log_event(
                level="CRITICAL",
                component="alert_manager",
                message=msg,
                details={"elapsed_seconds": round(elapsed, 1)},
            )
            alert_sent = await self._dispatch_external_alert(msg)

        return {
            "stale": elapsed >= self.settings.stale_warning_seconds,
            "critical_stale": is_stale_alert,
            "elapsed_seconds": round(elapsed, 1),
            "alert_triggered": alert_sent,
        }

    async def _dispatch_external_alert(self, message: str) -> bool:
        sent_any = False
        async with httpx.AsyncClient(timeout=5.0) as client:
            if self.settings.alert_webhook_url:
                try:
                    await client.post(
                        self.settings.alert_webhook_url,
                        json={"text": message, "timestamp": time.time()},
                    )
                    sent_any = True
                except Exception as exc:
                    self.db.log_event(
                        level="ERROR",
                        component="alert_manager",
                        message=f"Erro ao enviar webhook de alerta: {exc}",
                    )

            if (
                self.settings.alert_telegram_bot_token
                and self.settings.alert_telegram_chat_id
            ):
                tg_url = (
                    f"https://api.telegram.org/bot{self.settings.alert_telegram_bot_token}/sendMessage"
                )
                try:
                    await client.post(
                        tg_url,
                        json={
                            "chat_id": self.settings.alert_telegram_chat_id,
                            "text": message,
                        },
                    )
                    sent_any = True
                except Exception as exc:
                    self.db.log_event(
                        level="ERROR",
                        component="alert_manager",
                        message=f"Erro ao enviar alerta Telegram: {exc}",
                    )
        return sent_any
