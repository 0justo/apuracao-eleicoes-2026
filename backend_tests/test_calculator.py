"""Testes unitários da Calculadora da Virada e Onde Ainda Falta Contar.

Cobre obrigatoriamente todas as bordas especificadas:
- R = 0 (votos restantes estimados zero)
- Empate exato (V1 == V2)
- A > V/2 (candidato avaliado já acima da metade dos votos válidos)
- Brancos e nulos altos (inclusive 90% e 100%)
- 0% apurado (início da apuração às 17h)
- 100% apurado (final da totalização)
- s > 100% (diferença supera o total estimado de votos restantes)
- s <= 0% (já soma mais da metade do total estimado)
- Controle deslizante de comparecimento (-20% a +10%)
"""

from __future__ import annotations

import pytest

from backend.calculator import (
    OFFICIAL_DISCLAIMER,
    calculate_turnaround,
    summarize_pending_and_reference,
)
from backend.models import CandidateResult, LocalityDataItem


def _make_cand(seq: int, num: str, name: str, votes: int, pct: float) -> CandidateResult:
    return CandidateResult(
        seq=seq,
        number=num,
        sqcand=f"sq-{num}",
        full_name=name,
        ballot_name=name,
        party_acronym=f"P{num}",
        party_name=f"Partido {num}",
        votes=votes,
        pct_valid=pct,
        pct_valid_display=f"{pct:.2f}".replace(".", ","),
        color_Slot=1 if seq == 1 else 2,
    )


def test_turnaround_exact_formula_in_dispute() -> None:
    """Verifica a fórmula exata s = ((V + R) / 2 - A) / R em cenário competitivo."""
    # V = 1.000.000 (Cand1 = 520.000, Cand2 = 480.000 -> A = 480.000)
    # Comparecimento 1T = 1.600.000, votos apurados 2T = 1.050.000 -> restantes totais = 550.000
    # Brancos/nulos 2T = 50.000 / 1.050.000 -> (1 - bn_rate) = 1.000.000 / 1.050.000
    c1 = _make_cand(1, "13", "CANDIDATO 1", 520_000, 52.0)
    c2 = _make_cand(2, "22", "CANDIDATO 2", 480_000, 48.0)

    res = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_050_000,
        blank_votes_2t=20_000,
        null_votes_2t=30_000,
        turnout_votes_1t=1_600_000,
        total_electorate_2t=2_000_000,
        blank_null_rate_1t=0.05,
        pct_counted=65.0,
    )

    assert res.disclaimer == OFFICIAL_DISCLAIMER
    assert res.valid_votes_counted_v == 1_000_000
    assert res.trailing_candidate_Votes_a if hasattr(res, "trailing_candidate_Votes_a") else res.trailing_candidate_votes_a == 480_000
    assert res.status_code == "in_dispute"
    assert res.estimated_remaining_valid_votes_r > 0

    expected_s = (
        ((res.valid_votes_counted_v + res.estimated_remaining_valid_votes_r) / 2.0 - 480_000)
        / res.estimated_remaining_valid_votes_r
        * 100.0
    )
    assert res.needed_share_pct_s == pytest.approx(round(expected_s, 2))
    assert "precisa de" in res.neutral_message
    assert "vencedor" not in res.neutral_message.lower()
    assert "eleito" not in res.neutral_message.lower()


def test_turnaround_edge_r_equals_zero_under_100pct() -> None:
    """Borda R = 0 quando o comparecimento do 2º turno já atingiu o esperado antes de 100% das urnas."""
    c1 = _make_cand(1, "13", "CANDIDATO 1", 600_000, 60.0)
    c2 = _make_cand(2, "22", "CANDIDATO 2", 400_000, 40.0)

    res = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_050_000,
        blank_votes_2t=25_000,
        null_votes_2t=25_000,
        turnout_votes_1t=1_000_000,  # já superado pelo comparecimento atual
        total_electorate_2t=1_200_000,
        blank_null_rate_1t=0.05,
        pct_counted=95.0,
    )

    assert res.estimated_remaining_valid_votes_r == 0
    assert res.needed_share_pct_s is None
    assert res.status_code == "exceeds_remaining"
    assert (
        res.neutral_message
        == "Pelos dados atuais, a diferença supera o total estimado de votos restantes."
    )


def test_turnaround_edge_exact_tie() -> None:
    """Borda de empate exato (V1 == V2) com votos restantes > 0 e com R == 0."""
    c1 = _make_cand(1, "13", "CANDIDATO 1", 500_000, 50.0)
    c2 = _make_cand(2, "22", "CANDIDATO 2", 500_000, 50.0)

    res_open = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_050_000,
        blank_votes_2t=25_000,
        null_votes_2t=25_000,
        turnout_votes_1t=1_500_000,
        total_electorate_2t=2_000_000,
        blank_null_rate_1t=0.05,
        pct_counted=70.0,
    )
    assert res_open.status_code == "exact_tie"
    assert res_open.needed_share_pct_s == 50.0
    assert res_open.trailing_candidate_seq is None

    res_done = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_050_000,
        blank_votes_2t=25_000,
        null_votes_2t=25_000,
        turnout_votes_1t=1_050_000,
        total_electorate_2t=2_000_000,
        blank_null_rate_1t=0.05,
        pct_counted=100.0,
    )
    assert res_done.status_code == "exact_tie"
    assert res_done.estimated_remaining_valid_votes_r == 0


def test_turnaround_edge_a_greater_than_v_half_and_s_lte_zero() -> None:
    """Borda A > V/2 e s <= 0%: mensagem equivalente e neutra sem declarar vencedor."""
    c1 = _make_cand(1, "13", "CANDIDATO 1", 700_000, 70.0)
    c2 = _make_cand(2, "22", "CANDIDATO 2", 300_000, 30.0)

    # Testando s <= 0% (quando A já supera (V + R)/2)
    res = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_050_000,
        blank_votes_2t=25_000,
        null_votes_2t=25_000,
        turnout_votes_1t=1_200_000,
        total_electorate_2t=1_500_000,
        blank_null_rate_1t=0.05,
        pct_counted=85.0,
        override_Trailing_votes_a=700_000,
    )
    assert res.needed_share_pct_s is not None and res.needed_share_pct_s <= 0.0
    assert res.status_code == "already_above_half"
    assert (
        res.neutral_message
        == "Pelos dados atuais, o candidato já soma mais da metade do total estimado de votos válidos."
    )
    assert "eleito" not in res.neutral_message.lower()
    assert "vencedor" not in res.neutral_message.lower()


def test_turnaround_edge_s_greater_than_100pct() -> None:
    """Borda s > 100%: diferença supera o total estimado de votos restantes."""
    c1 = _make_cand(1, "13", "CANDIDATO 1", 650_000, 65.0)
    c2 = _make_cand(2, "22", "CANDIDATO 2", 350_000, 35.0)

    res = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_050_000,
        blank_votes_2t=25_000,
        null_votes_2t=25_000,
        turnout_votes_1t=1_200_000,
        total_electorate_2t=1_500_000,
        blank_null_rate_1t=0.05,
        pct_counted=88.0,
    )
    assert res.needed_share_pct_s is not None and res.needed_share_pct_s > 100.0
    assert res.status_code == "exceeds_remaining"
    assert (
        res.neutral_message
        == "Pelos dados atuais, a diferença supera o total estimado de votos restantes."
    )


def test_turnaround_edge_high_blanks_and_nulls() -> None:
    """Borda de brancos e nulos muito altos (ex.: 90% e 100%)."""
    c1 = _make_cand(1, "13", "CANDIDATO 1", 60_000, 60.0)
    c2 = _make_cand(2, "22", "CANDIDATO 2", 40_000, 40.0)

    # 90% de brancos e nulos (900k de 1M de votos totais)
    res_90 = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_000_000,
        blank_votes_2t=450_000,
        null_votes_2t=450_000,
        turnout_votes_1t=1_500_000,
        total_electorate_2t=2_000_000,
        blank_null_rate_1t=0.10,
        pct_counted=66.0,
    )
    assert res_90.observed_blank_null_rate == pytest.approx(0.90)
    assert res_90.estimated_remaining_valid_votes_r == 50_000

    # 100% de brancos e nulos nos votos restantes -> R = 0 sem divisão por zero
    res_100 = calculate_turnaround(
        cand1=c1,
        cand2=c2,
        turnout_votes_2t=1_000_000,
        blank_votes_2t=500_000,
        null_votes_2t=500_000,
        turnout_votes_1t=1_500_000,
        total_electorate_2t=2_000_000,
        blank_null_rate_1t=0.10,
        pct_counted=66.0,
    )
    assert res_100.observed_blank_null_rate == pytest.approx(1.0)
    assert res_100.estimated_remaining_valid_votes_r == 0
    assert res_100.needed_share_pct_s is None


def test_turnaround_edge_0pct_and_100pct_and_slider() -> None:
    """Bordas de 0% apurado, 100% apurado e ajuste pelo controle deslizante."""
    c1_0 = _make_cand(1, "13", "CANDIDATO 1", 0, 0.0)
    c2_0 = _make_cand(2, "22", "CANDIDATO 2", 0, 0.0)

    res_0 = calculate_turnaround(
        cand1=c1_0,
        cand2=c2_0,
        turnout_votes_2t=0,
        blank_votes_2t=0,
        null_votes_2t=0,
        turnout_votes_1t=1_000_000,
        total_electorate_2t=1_250_000,
        blank_null_rate_1t=0.05,
        pct_counted=0.0,
    )
    assert res_0.status_code == "waiting_0pct"
    assert res_0.used_1t_blank_null_fallback is True
    assert res_0.estimated_remaining_valid_votes_r == 950_000
    assert res_0.needed_share_pct_s == 50.0

    # 100% apurado
    c1_100 = _make_cand(1, "13", "CANDIDATO 1", 510_000, 51.0)
    c2_100 = _make_cand(2, "22", "CANDIDATO 2", 490_000, 49.0)
    res_100 = calculate_turnaround(
        cand1=c1_100,
        cand2=c2_100,
        turnout_votes_2t=1_050_000,
        blank_votes_2t=25_000,
        null_votes_2t=25_000,
        turnout_votes_1t=1_100_000,
        total_electorate_2t=1_250_000,
        blank_null_rate_1t=0.05,
        pct_counted=100.0,
    )
    assert res_100.status_code == "completed_100pct"
    assert res_100.estimated_remaining_valid_votes_r == 0

    # Slider reduzindo o comparecimento esperado em -10%
    res_slider = calculate_turnaround(
        cand1=_make_cand(1, "13", "CANDIDATO 1", 420_000, 52.5),
        cand2=_make_cand(2, "22", "CANDIDATO 2", 380_000, 47.5),
        turnout_votes_2t=840_000,
        blank_votes_2t=20_000,
        null_votes_2t=20_000,
        turnout_votes_1t=1_000_000,
        total_electorate_2t=1_250_000,
        blank_null_rate_1t=0.05,
        pct_counted=80.0,
        turnout_adjustment_pct=-10.0,
    )
    # 1.000.000 * 0.90 = 900.000 -> restantes totais = 60.000
    assert res_slider.expected_turnout_total == 900_000
    assert res_slider.estimated_remaining_total_votes == 60_000


def test_pending_summary_and_reference_scenario() -> None:
    """Testa a agregação de votos restantes por liderança no 1º turno e o Cenário de Referência."""
    c1 = _make_cand(1, "13", "CANDIDATO 1", 500_000, 50.0)
    c2 = _make_cand(2, "22", "CANDIDATO 2", 500_000, 50.0)

    locs = [
        LocalityDataItem(
            code_tse="SP",
            uf="SP",
            name="São Paulo",
            scope_type="uf",
            total_sections=1000,
            counted_sections=500,
            pct_counted=50.0,
            pct_remaining=50.0,
            low_reliability=False,
            total_electorate=1_000_000,
            turnout_votes_2t=400_000,
            turnout_votes_1t=800_000,
            valid_votes_2t=380_000,
            blank_votes_2t=10_000,
            null_votes_2t=10_000,
            blank_null_rate_1t=0.05,
            cand1_votes_2t=180_000,
            cand2_votes_2t=200_000,
            cand1_pct_2t=47.37,
            cand2_pct_2t=52.63,
            cand1_norm_1t=46.0,
            cand2_norm_1t=54.0,
            leader_1t_slot=2,
            leader_1t_name="CANDIDATO 2",
            net_swing_cand1_pp=1.37,
            estimated_remaining_valid_votes=380_000,
            source_json_url="https://resultados.tse.jus.br/sp.json",
            source_portal_url="https://resultados.tse.jus.br",
        ),
        LocalityDataItem(
            code_tse="BA",
            uf="BA",
            name="Bahia",
            scope_type="uf",
            total_sections=1000,
            counted_sections=600,
            pct_counted=60.0,
            pct_remaining=40.0,
            low_reliability=False,
            total_electorate=800_000,
            turnout_votes_2t=400_000,
            turnout_votes_1t=650_000,
            valid_votes_2t=380_000,
            blank_votes_2t=10_000,
            null_votes_2t=10_000,
            blank_null_rate_1t=0.05,
            cand1_votes_2t=270_000,
            cand2_votes_2t=110_000,
            cand1_pct_2t=71.05,
            cand2_pct_2t=28.95,
            cand1_norm_1t=70.0,
            cand2_norm_1t=30.0,
            leader_1t_slot=1,
            leader_1t_name="CANDIDATO 1",
            net_swing_cand1_pp=1.05,
            estimated_remaining_valid_votes=240_000,
            source_json_url="https://resultados.tse.jus.br/ba.json",
            source_portal_url="https://resultados.tse.jus.br",
        ),
    ]

    pending, ref = summarize_pending_and_reference(
        cand1=c1, cand2=c2, localities=locs, feature_reference_enabled=True
    )
    assert pending.total_remaining_valid_votes == 620_000
    assert pending.remaining_in_cand1_1t_lead == 240_000
    assert pending.remaining_in_cand2_1t_lead == 380_000
    assert ref.enabled is True
    assert ref.has_sufficient_sample is True
    assert ref.disclaimer == OFFICIAL_DISCLAIMER
    assert ref.cand1_projected_pct_center is not None
    assert ref.cand1_projected_pct_low <= ref.cand1_projected_pct_center <= ref.cand1_projected_pct_high
