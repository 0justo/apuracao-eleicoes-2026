"""Publicador Atômico de Snapshots Estáticos JSON para CDN / Armazenamento Estático.

Aplica validação de sanidade antes de qualquer escrita:
- Se válido: grava no SQLite e escreve de forma atômica em `public/snapshots/<dispute_id>/latest.json`
  e `history.json`.
- Se inválido: NÃO publica o novo snapshot, mantém o anterior, registra o erro no SQLite
  e atualiza apenas o indicador `validation_status = "em_verificacao"` ("Atualização em verificação").
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Sequence

from backend.config import Settings
from backend.db import Database
from backend.models import (
    DisputeCatalogItem,
    DisputeSnapshot,
    ElectionCatalogSnapshot,
    FeatureFlagsPayload,
)
from backend.validator import ValidationResult, validate_snapshot


def _atomic_write_json(target_path: Path, data: Any) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = target_path.with_suffix(".json.tmp")
    if isinstance(data, str):
        raw = data
    else:
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    tmp_path.write_text(raw, encoding="utf-8")
    tmp_path.replace(target_path)


class SnapshotPublisher:
    """Valida e publica snapshots estáticos para consumo pelo CDN e navegadores."""

    def __init__(self, settings: Settings, db: Database) -> None:
        self.settings = settings
        self.db = db

    def validate_and_publish(
        self, candidate_snapshot: DisputeSnapshot
    ) -> tuple[ValidationResult, DisputeSnapshot]:
        """Valida o snapshot candidato contra regras de sanidade e o último snapshot válido.

        Retorna `(ValidationResult, published_or_kept_snapshot)`.
        """
        previous = self.db.get_latest_snapshot(candidate_snapshot.dispute_id)
        val_result = validate_snapshot(candidate_snapshot, previous_snapshot=previous)

        if not val_result.is_valid:
            err_joined = "; ".join(val_result.errors)
            self.db.log_event(
                level="ERROR",
                component="validator",
                message=f"Falha de sanidade em {candidate_snapshot.dispute_id}: {err_joined}",
                details={
                    "dispute_id": candidate_snapshot.dispute_id,
                    "errors": val_result.errors,
                },
            )
            kept = self.db.mark_snapshot_under_verification(
                candidate_snapshot.dispute_id, err_joined
            )
            if kept is not None:
                self._write_dispute_files(kept)
                return val_result, kept
            # Caso extremo onde não havia snapshot anterior, marca o próprio como em verificação
            candidate_snapshot.validation_status = "em_verificacao"
            candidate_snapshot.validation_message = "Atualização em verificação"
            return val_result, candidate_snapshot

        # Persiste no SQLite e consolida linha do tempo e feed completo do narrador
        self.db.save_valid_snapshot(candidate_snapshot)
        persisted_feed = self.db.save_narrator_messages(
            dispute_id=candidate_snapshot.dispute_id,
            messages=candidate_snapshot.narrator_messages,
            is_replay=candidate_snapshot.is_replay,
        )
        persisted_timeline = self.db.get_timeline(
            dispute_id=candidate_snapshot.dispute_id,
            is_replay=candidate_snapshot.is_replay,
        )

        candidate_snapshot.narrator_messages = persisted_feed
        candidate_snapshot.timeline = persisted_timeline
        candidate_snapshot.validation_status = "ok"
        candidate_snapshot.validation_message = None

        # Atualiza o JSON consolidado na tabela latest_snapshots e escreve no diretório de CDN
        self.db.save_valid_snapshot(candidate_snapshot)
        self._write_dispute_files(candidate_snapshot)
        return val_result, candidate_snapshot

    def _write_dispute_files(self, snapshot: DisputeSnapshot) -> None:
        uf_l = snapshot.uf.lower()
        for c in snapshot.candidates:
            if not c.photo_url and c.sqcand:
                c.photo_url = f"/avatars/{c.sqcand}.jpg"
            if not c.tse_photo_filename and c.sqcand:
                c.tse_photo_filename = f"f{snapshot.election_code_2t}{c.sqcand}_div.jpg"
            if not c.tse_photo_url and c.sqcand:
                c.tse_photo_url = f"https://resultados.tse.jus.br/oficial/ele2026/{snapshot.election_code_2t}/fotos/{uf_l}/{c.tse_photo_filename}"
        dispute_dir = self.settings.snapshot_dir / snapshot.dispute_id
        _atomic_write_json(dispute_dir / "latest.json", snapshot.model_dump())
        _atomic_write_json(
            dispute_dir / "history.json",
            {
                "dispute_id": snapshot.dispute_id,
                "generated_at_iso": snapshot.generated_at_iso,
                "generated_at_hms": snapshot.generated_at_hms,
                "timeline": [pt.model_dump() for pt in snapshot.timeline],
            },
        )

    def publish_catalog(
        self,
        snapshots: Sequence[DisputeSnapshot],
        cycle: str,
        generated_at_iso: str,
        generated_at_hms: str,
    ) -> ElectionCatalogSnapshot:
        items: list[DisputeCatalogItem] = []
        for snap in snapshots:
            c1, c2 = snap.candidates[0], snap.candidates[1]
            route = (
                "/presidente"
                if snap.cargo_code == "1"
                else f"/governador/{snap.uf.lower()}"
            )
            items.append(
                DisputeCatalogItem(
                    dispute_id=snap.dispute_id,
                    cargo_code=snap.cargo_code,
                    cargo_name=snap.cargo_name,
                    uf=snap.uf,
                    uf_name=snap.uf_name,
                    route_path=route,
                    snapshot_url=f"/snapshots/{snap.dispute_id}/latest.json",
                    pct_counted=snap.sections.pct_counted,
                    cand1_name=c1.ballot_name,
                    cand1_number=c1.number,
                    cand1_pct=c1.pct_valid,
                    cand1_photo_url=c1.photo_url,
                    cand2_name=c2.ballot_name,
                    cand2_number=c2.number,
                    cand2_pct=c2.pct_valid,
                    cand2_photo_url=c2.photo_url,
                    updated_at_hms=snap.generated_at_hms,
                    validation_status=snap.validation_status,
                )
            )

        catalog = ElectionCatalogSnapshot(
            cycle=cycle,
            election_date="25/10/2026",
            generated_at_iso=generated_at_iso,
            generated_at_hms=generated_at_hms,
            source_mode=self.settings.tse_source_mode,
            feature_flags=FeatureFlagsPayload(
                reference_scenario=self.settings.feature_reference_scenario,
                narrator=self.settings.feature_narrator,
                replay=self.settings.feature_replay,
            ),
            disputes=items,
        )
        _atomic_write_json(
            self.settings.snapshot_dir / "catalog.json", catalog.model_dump()
        )
        return catalog

    def publish_replay_2022_bundle(self, frames: Sequence[DisputeSnapshot]) -> Path:
        replay_dir = self.settings.snapshot_dir / "replay-2022"
        replay_dir.mkdir(parents=True, exist_ok=True)
        out_path = replay_dir / "presidente.json"
        _atomic_write_json(
            out_path,
            {
                "dispute_id": "presidente",
                "title": "Replay Histórico — 2º Turno Presidencial 2022 (TSE)",
                "disclaimer": "Replay histórico das eleições de 2022 (30/10/2022) para fins de demonstração e teste.",
                "total_frames": len(frames),
                "frames": [f.model_dump() for f in frames],
            },
        )
        return out_path
