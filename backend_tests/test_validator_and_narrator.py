"""Testes unitários do Validador de Sanidade e do Narrador Automático Neutro."""

from __future__ import annotations

import pytest

from backend.config import Settings
from backend.db import Database
from backend.fixtures_2022 import build_2022_replay_frames
from backend.narrator import assert_neutral_text, generate_narrator_messages
from backend.publisher import SnapshotPublisher
from backend.tse_client import TSEClient
from backend.validator import validate_snapshot


def test_narrator_neutrality_guard_rejects_forbidden_terms() -> None:
    """Garante que o filtro léxico bloqueia declarações próprias de vitória/eleito."""
    with pytest.raises(ValueError, match="Violação de neutralidade"):
        assert_neutral_text("O candidato A é o grande vencedor da noite.")

    with pytest.raises(ValueError, match="Violação de neutralidade"):
        assert_neutral_text("Fulano ganhou em 15 estados.")

    with pytest.raises(ValueError, match="Menção a 'eleito' sem atribuição oficial"):
        assert_neutral_text("O candidato já está matematicamente eleito.")

    # Só deve permitir se contiver a atribuição explícita "Eleito (segundo o TSE)" e allow_tse_elected=True
    valid_official = (
        "Status oficial informado pelo sistema de totalização para LULA (13): "
        "Eleito (segundo o TSE), com 50,90% dos votos válidos."
    )
    assert assert_neutral_text(valid_official, allow_tse_elected=True) == valid_official


def test_validator_rejects_vote_sum_mismatch_and_regression(tmp_path) -> None:
    """Verifica se o validador bloqueia somas incoerentes e regressão de % apurado,
    mantendo o snapshot anterior e marcando 'em_verificacao'.
    """
    settings = Settings(
        data_dir=tmp_path / "data",
        snapshot_dir=tmp_path / "snapshots",
        fixtures_dir=tmp_path / "fixtures",
    )
    db = Database(settings.db_path)
    client = TSEClient(settings, db)
    publisher = SnapshotPublisher(settings, db)

    frames = build_2022_replay_frames(client, settings)
    frame_50 = frames[8]  # ~53.1% apurado
    frame_60 = frames[9]  # ~60.4% apurado

    # Publica o frame_60 válido primeiro
    val_ok, pub_60 = publisher.validate_and_publish(frame_60)
    assert val_ok.is_valid is True
    assert pub_60.validation_status == "ok"

    # 1. Tenta publicar o frame_50 depois do frame_60 (regressão de % apurado e de votos)
    val_reg, kept_snap = publisher.validate_and_publish(frame_50)
    assert val_reg.is_valid is False
    assert any("Regressão" in err for err in val_reg.errors)
    # O snapshot mantido deve continuar com o % apurado do frame_60, mas com status 'em_verificacao'
    assert kept_snap.sections.pct_counted == pub_60.sections.pct_counted
    assert kept_snap.validation_status == "em_verificacao"
    assert kept_snap.validation_message == "Atualização em verificação"

    # 2. Testa soma incoerente (votos válidos != soma dos candidatos)
    corrupted = frame_60.model_copy(deep=True)
    corrupted.candidates[0].votes += 500_000  # Descola da soma de votos válidos
    val_corrupt = validate_snapshot(corrupted, previous_snapshot=None)
    assert val_corrupt.is_valid is False
    assert any("diverge de votos válidos" in e for e in val_corrupt.errors)


def test_all_2022_replay_frames_pass_sanity_and_neutrality(tmp_path) -> None:
    """Roda o ciclo completo 0% -> 100% nas fixtures de 2022 garantindo que todos os 21 frames
    passam na validação de sanidade e de neutralidade do narrador.
    """
    settings = Settings(
        data_dir=tmp_path / "data",
        snapshot_dir=tmp_path / "snapshots",
        fixtures_dir=tmp_path / "fixtures",
    )
    db = Database(settings.db_path)
    client = TSEClient(settings, db)
    publisher = SnapshotPublisher(settings, db)

    frames = build_2022_replay_frames(client, settings)
    assert len(frames) == 21
    assert frames[0].sections.pct_counted == 0.0
    assert frames[-1].sections.pct_counted == 100.0

    for idx, frame in enumerate(frames):
        val_res, published = publisher.validate_and_publish(frame)
        assert val_res.is_valid is True, f"Falha no frame {idx}: {val_res.errors}"
        assert published.validation_status == "ok"
        assert len(published.narrator_messages) >= 1

        for msg in published.narrator_messages:
            allow_official = msg.category == "official_status"
            assert_neutral_text(msg.text, allow_tse_elected=allow_official)
