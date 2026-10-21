"""Motor matemático da Calculadora da Virada, Votos Restantes e Cenário de Referência.

Todas as funções são puras e determinísticas, seguindo rigorosamente as Regras Inegociáveis:
- NUNCA declarar "eleito", "vencedor" ou "ganhou" por conta própria.
- Toda estimativa é rotulada como "Estimativa do site, não é resultado oficial".
"""

from __future__ import annotations

import math
from typing import Sequence

from backend.models import (
    CandidateResult,
    LocalityDataItem,
    PendingSummary,
    ReferenceScenario,
    TurnaroundAnalysis,
)

OFFICIAL_DISCLAIMER = "Estimativa do site, não é resultado oficial"


def compute_locality_remaining_valid_votes(
    turnout_1t: int,
    turnout_2t: int,
    total_electorate_2t: int,
    blank_votes_2t: int,
    null_votes_2t: int,
    blank_null_rate_1t: float,
    pct_counted: float,
    turnout_adjustment_pct: float = 0.0,
) -> tuple[int, int, float, bool]:
    """Calcula votos totais restantes e votos válidos restantes estimados para um local.

    Retorna:
        (expected_turnout_total, remaining_valid_votes_r, used_blank_null_rate, used_1t_fallback)
    """
    if pct_counted >= 100.0:
        obs_rate = (
            min(1.0, max(0.0, (blank_votes_2t + null_votes_2t) / turnout_2t))
            if turnout_2t > 0
            else min(1.0, max(0.0, blank_null_rate_1t))
        )
        return turnout_2t, 0, obs_rate, turnout_2t == 0

    factor = max(0.0, 1.0 + (turnout_adjustment_pct / 100.0))
    base_expected = int(round(max(0, turnout_1t) * factor))
    if total_electorate_2t > 0:
        base_expected = min(total_electorate_2t, base_expected)

    expected_turnout = max(turnout_2t, base_expected)
    remaining_total = max(0, expected_turnout - turnout_2t)

    if turnout_2t > 0:
        blank_null_rate = min(1.0, max(0.0, (blank_votes_2t + null_votes_2t) / turnout_2t))
        used_fallback = False
    else:
        blank_null_rate = min(1.0, max(0.0, blank_null_rate_1t))
        used_fallback = True

    remaining_valid = int(round(remaining_total * (1.0 - blank_null_rate)))
    return expected_turnout, max(0, remaining_valid), blank_null_rate, used_fallback


def calculate_turnaround(
    cand1: CandidateResult,
    cand2: CandidateResult,
    turnout_votes_2t: int,
    blank_votes_2t: int,
    null_votes_2t: int,
    turnout_votes_1t: int,
    total_electorate_2t: int,
    blank_null_rate_1t: float,
    pct_counted: float,
    turnout_adjustment_pct: float = 0.0,
    localities: Sequence[LocalityDataItem] | None = None,
    override_Trailing_votes_a: int | None = None,
) -> TurnaroundAnalysis:
    """Calcula quanto o candidato atrás precisa dos votos válidos restantes para ultrapassar 50%.

    Fórmulas especificadas:
    - V = votos válidos já apurados dos dois candidatos
    - A = votos do candidato que está atrás
    - R = (comparecimento esperado - votos já apurados) * (1 - taxa de brancos e nulos observada)
    - s = ((V + R) / 2 - A) / R
    """
    v1 = max(0, cand1.votes)
    v2 = max(0, cand2.votes)
    v_total = v1 + v2

    # Taxa agregada de brancos e nulos observada até agora
    if turnout_votes_2t > 0:
        observed_bn_rate = min(
            1.0, max(0.0, (blank_votes_2t + null_votes_2t) / turnout_votes_2t)
        )
        used_fallback = False
    else:
        observed_bn_rate = min(1.0, max(0.0, blank_null_rate_1t))
        used_fallback = True

    # Comparecimento esperado e votos restantes estimados
    factor = max(0.0, 1.0 + (turnout_adjustment_pct / 100.0))
    if pct_counted >= 100.0:
        expected_turnout = turnout_votes_2t
        remaining_total_votes = 0
        r_valid = 0
    elif localities and len(localities) > 0 and abs(turnout_adjustment_pct) < 1e-9:
        # Soma por localidade quando disponível na linha de base (ajuste = 0)
        r_sum = 0
        exp_sum = 0
        for loc in localities:
            exp_loc, r_loc, _, _ = compute_locality_remaining_valid_votes(
                turnout_1t=loc.turnout_votes_1t,
                turnout_2t=loc.turnout_votes_2t,
                total_electorate_2t=loc.total_electorate,
                blank_votes_2t=loc.blank_votes_2t,
                null_votes_2t=loc.null_votes_2t,
                blank_null_rate_1t=loc.blank_null_rate_1t,
                pct_counted=loc.pct_counted,
                turnout_adjustment_pct=turnout_adjustment_pct,
            )
            exp_sum += exp_loc
            r_sum += r_loc
        expected_turnout = max(turnout_votes_2t, exp_sum)
        remaining_total_votes = max(0, expected_turnout - turnout_votes_2t)
        r_valid = max(0, r_sum)
    else:
        raw_expected = int(round(max(0, turnout_votes_1t) * factor))
        if total_electorate_2t > 0:
            raw_expected = min(total_electorate_2t, raw_expected)
        expected_turnout = max(turnout_votes_2t, raw_expected)
        remaining_total_votes = max(0, expected_turnout - turnout_votes_2t)
        r_valid = int(round(remaining_total_votes * (1.0 - observed_bn_rate)))
        r_valid = max(0, r_valid)

    # Identifica quem está atrás (ou empate) mantendo neutralidade estrita
    if v1 < v2:
        trailing_seq: int | None = cand1.seq
        trailing_name = cand1.ballot_name
        trailing_votes_a = v1
        leading_name = cand2.ballot_name
        leading_votes = v2
    elif v2 < v1:
        trailing_seq = cand2.seq
        trailing_name = cand2.ballot_name
        trailing_votes_a = v2
        leading_name = cand1.ballot_name
        leading_votes = v1
    else:
        trailing_seq = None
        trailing_name = f"{cand1.ballot_name} / {cand2.ballot_name}"
        trailing_votes_a = v1
        leading_name = f"{cand1.ballot_name} / {cand2.ballot_name}"
        leading_votes = v2

    # Permite teste unitário explícito de borda A > V/2
    if override_Trailing_votes_a is not None:
        trailing_votes_a = override_Trailing_votes_a

    vote_diff = abs(v1 - v2)
    margin_pp = (
        round(abs(v1 - v2) / v_total * 100.0, 2) if v_total > 0 else 0.0
    )

    # Caso 1: 0% apurado e nenhum voto computado ainda
    if v_total == 0 and pct_counted == 0.0:
        if r_valid > 0:
            s_fraction = ((v_total + r_valid) / 2.0 - trailing_votes_a) / r_valid
            s_pct = round(s_fraction * 100.0, 2)
            needed_abs = int(math.floor((v_total + r_valid) / 2.0)) + 1
            return TurnaroundAnalysis(
                disclaimer=OFFICIAL_DISCLAIMER,
                valid_votes_counted_v=0,
                trailing_candidate_seq=None,
                trailing_candidate_name=trailing_name,
                trailing_candidate_votes_a=0,
                leading_candidate_name=leading_name,
                leading_candidate_votes=0,
                vote_difference=0,
                margin_pp=0.0,
                expected_turnout_total=expected_turnout,
                turnout_adjustment_pct=turnout_adjustment_pct,
                observed_blank_null_rate=round(observed_bn_rate, 6),
                used_1t_blank_null_fallback=used_fallback,
                estimated_remaining_total_votes=remaining_total_votes,
                estimated_remaining_valid_votes_r=r_valid,
                needed_share_pct_s=s_pct,
                needed_votes_absolute=needed_abs,
                status_code="waiting_0pct",
                neutral_message=(
                    "Aguardando início da totalização de votos válidos. "
                    "Com 0% apurado, qualquer candidato precisa de mais de 50,00% dos votos válidos restantes estimados."
                ),
            )
        return TurnaroundAnalysis(
            disclaimer=OFFICIAL_DISCLAIMER,
            valid_votes_counted_v=0,
            trailing_candidate_seq=None,
            trailing_candidate_name=trailing_name,
            trailing_candidate_votes_a=0,
            leading_candidate_name=leading_name,
            leading_candidate_votes=0,
            vote_difference=0,
            margin_pp=0.0,
            expected_turnout_total=expected_turnout,
            turnout_adjustment_pct=turnout_adjustment_pct,
            observed_blank_null_rate=round(observed_bn_rate, 6),
            used_1t_blank_null_fallback=used_fallback,
            estimated_remaining_total_votes=remaining_total_votes,
            estimated_remaining_valid_votes_r=0,
            needed_share_pct_s=None,
            needed_votes_absolute=0,
            status_code="waiting_0pct",
            neutral_message="Aguardando dados de apuração e estimativa de votos restantes.",
        )

    # Caso 2: R == 0 (100% apurado ou votos restantes estimados zerados)
    if r_valid <= 0:
        if trailing_votes_a > v_total / 2.0:
            msg = "Pelos dados atuais, o candidato já soma mais da metade do total estimado de votos válidos."
            code = "already_above_half"
        elif v1 == v2:
            msg = "Com 0 votos válidos restantes estimados, os dois candidatos encontram-se com a mesma quantidade de votos válidos."
            code = "exact_tie"
        elif pct_counted >= 100.0:
            msg = "100% das seções foram totalizadas. Não há votos restantes a apurar."
            code = "completed_100pct"
        else:
            msg = "Pelos dados atuais, a diferença supera o total estimado de votos restantes."
            code = "exceeds_remaining"

        return TurnaroundAnalysis(
            disclaimer=OFFICIAL_DISCLAIMER,
            valid_votes_counted_v=v_total,
            trailing_candidate_seq=trailing_seq,
            trailing_candidate_name=trailing_name,
            trailing_candidate_votes_a=trailing_votes_a,
            leading_candidate_name=leading_name,
            leading_candidate_votes=leading_votes,
            vote_difference=vote_diff,
            margin_pp=margin_pp,
            expected_turnout_total=expected_turnout,
            turnout_adjustment_pct=turnout_adjustment_pct,
            observed_blank_null_rate=round(observed_bn_rate, 6),
            used_1t_blank_null_fallback=used_fallback,
            estimated_remaining_total_votes=remaining_total_votes,
            estimated_remaining_valid_votes_r=0,
            needed_share_pct_s=None,
            needed_votes_absolute=0,
            status_code=code,
            neutral_message=msg,
        )

    # Caso 3: R > 0 -> aplica fórmula exata s = ((V + R) / 2 - A) / R
    s_fraction = ((v_total + r_valid) / 2.0 - trailing_votes_a) / r_valid
    s_pct = round(s_fraction * 100.0, 2)
    needed_votes_abs = max(
        0, int(math.floor((v_total + r_valid) / 2.0 - trailing_votes_a)) + 1
    )

    if s_fraction <= 0.0:
        return TurnaroundAnalysis(
            disclaimer=OFFICIAL_DISCLAIMER,
            valid_votes_counted_v=v_total,
            trailing_candidate_seq=trailing_seq,
            trailing_candidate_name=trailing_name,
            trailing_candidate_votes_a=trailing_votes_a,
            leading_candidate_name=leading_name,
            leading_candidate_votes=leading_votes,
            vote_difference=vote_diff,
            margin_pp=margin_pp,
            expected_turnout_total=expected_turnout,
            turnout_adjustment_pct=turnout_adjustment_pct,
            observed_blank_null_rate=round(observed_bn_rate, 6),
            used_1t_blank_null_fallback=used_fallback,
            estimated_remaining_total_votes=remaining_total_votes,
            estimated_remaining_valid_votes_r=r_valid,
            needed_share_pct_s=s_pct,
            needed_votes_absolute=0,
            status_code="already_above_half",
            neutral_message="Pelos dados atuais, o candidato já soma mais da metade do total estimado de votos válidos.",
        )

    if s_fraction > 1.0:
        return TurnaroundAnalysis(
            disclaimer=OFFICIAL_DISCLAIMER,
            valid_votes_counted_v=v_total,
            trailing_candidate_seq=trailing_seq,
            trailing_candidate_name=trailing_name,
            trailing_candidate_votes_a=trailing_votes_a,
            leading_candidate_name=leading_name,
            leading_candidate_votes=leading_votes,
            vote_difference=vote_diff,
            margin_pp=margin_pp,
            expected_turnout_total=expected_turnout,
            turnout_adjustment_pct=turnout_adjustment_pct,
            observed_blank_null_rate=round(observed_bn_rate, 6),
            used_1t_blank_null_fallback=used_fallback,
            estimated_remaining_total_votes=remaining_total_votes,
            estimated_remaining_valid_votes_r=r_valid,
            needed_share_pct_s=s_pct,
            needed_votes_absolute=needed_votes_abs,
            status_code="exceeds_remaining",
            neutral_message="Pelos dados atuais, a diferença supera o total estimado de votos restantes.",
        )

    if v1 == v2:
        return TurnaroundAnalysis(
            disclaimer=OFFICIAL_DISCLAIMER,
            valid_votes_counted_v=v_total,
            trailing_candidate_seq=None,
            trailing_candidate_name=trailing_name,
            trailing_candidate_votes_a=trailing_votes_a,
            leading_candidate_name=leading_name,
            leading_candidate_votes=leading_votes,
            vote_difference=0,
            margin_pp=0.0,
            expected_turnout_total=expected_turnout,
            turnout_adjustment_pct=turnout_adjustment_pct,
            observed_blank_null_rate=round(observed_bn_rate, 6),
            used_1t_blank_null_fallback=used_fallback,
            estimated_remaining_total_votes=remaining_total_votes,
            estimated_remaining_valid_votes_r=r_valid,
            needed_share_pct_s=50.0,
            needed_votes_absolute=needed_votes_abs,
            status_code="exact_tie",
            neutral_message=(
                "Os candidatos têm a mesma quantidade de votos válidos até o momento. "
                "Cada um precisa de mais de 50,00% dos votos válidos restantes estimados para passar à frente."
            ),
        )

    formatted_s = f"{s_pct:.2f}".replace(".", ",")
    return TurnaroundAnalysis(
        disclaimer=OFFICIAL_DISCLAIMER,
        valid_votes_counted_v=v_total,
        trailing_candidate_seq=trailing_seq,
        trailing_candidate_name=trailing_name,
        trailing_candidate_votes_a=trailing_votes_a,
        leading_candidate_name=leading_name,
        leading_candidate_votes=leading_votes,
        vote_difference=vote_diff,
        margin_pp=margin_pp,
        expected_turnout_total=expected_turnout,
        turnout_adjustment_pct=turnout_adjustment_pct,
        observed_blank_null_rate=round(observed_bn_rate, 6),
        used_1t_blank_null_fallback=used_fallback,
        estimated_remaining_total_votes=remaining_total_votes,
        estimated_remaining_valid_votes_r=r_valid,
        needed_share_pct_s=s_pct,
        needed_votes_absolute=needed_votes_abs,
        status_code="in_dispute",
        neutral_message=(
            f"Pelos dados atuais, {trailing_name} precisa de {formatted_s}% dos votos válidos "
            f"restantes estimados para ultrapassar 50% dos votos válidos."
        ),
    )


def summarize_pending_and_reference(
    cand1: CandidateResult,
    cand2: CandidateResult,
    localities: Sequence[LocalityDataItem],
    feature_reference_enabled: bool = False,
) -> tuple[PendingSummary, ReferenceScenario]:
    """Agrega os votos válidos restantes por liderança no 1º turno e calcula o Cenário de Referência."""
    rem_cand1 = 0
    rem_cand2 = 0
    rem_tied = 0

    for loc in localities:
        r_loc = max(0, loc.estimated_remaining_valid_votes)
        if loc.leader_1t_slot == 1:
            rem_cand1 += r_loc
        elif loc.leader_1t_slot == 2:
            rem_cand2 += r_loc
        else:
            rem_tied += r_loc

    total_rem = rem_cand1 + rem_cand2 + rem_tied
    pct_c1 = round((rem_cand1 / total_rem * 100.0), 2) if total_rem > 0 else 0.0
    pct_c2 = round((rem_cand2 / total_rem * 100.0), 2) if total_rem > 0 else 0.0

    pending_summary = PendingSummary(
        disclaimer=OFFICIAL_DISCLAIMER,
        total_remaining_valid_votes=total_rem,
        remaining_in_cand1_1t_lead=rem_cand1,
        remaining_in_cand2_1t_lead=rem_cand2,
        remaining_in_tied_1t=rem_tied,
        pct_remaining_in_cand1_1t_lead=pct_c1,
        pct_remaining_in_cand2_1t_lead=pct_c2,
    )

    # Cenário de referência (variação uniforme nos locais pendentes)
    eligible = [
        loc
        for loc in localities
        if loc.pct_counted >= 30.0
        and loc.valid_votes_2t > 0
        and loc.net_swing_cand1_pp is not None
    ]

    if not eligible:
        return pending_summary, ReferenceScenario(
            enabled=feature_reference_enabled,
            disclaimer=OFFICIAL_DISCLAIMER,
            has_sufficient_sample=False,
            sample_localities_count=0,
        )

    total_weight = sum(loc.valid_votes_2t for loc in eligible)
    if total_weight <= 0:
        return pending_summary, ReferenceScenario(
            enabled=feature_reference_enabled,
            disclaimer=OFFICIAL_DISCLAIMER,
            has_sufficient_sample=False,
            sample_localities_count=0,
        )

    mean_swing = (
        sum(loc.valid_votes_2t * (loc.net_swing_cand1_pp or 0.0) for loc in eligible)
        / total_weight
    )
    variance = (
        sum(
            loc.valid_votes_2t * (((loc.net_swing_cand1_pp or 0.0) - mean_swing) ** 2)
            for loc in eligible
        )
        / total_weight
    )
    std_dev = math.sqrt(max(0.0, variance))
    uncertainty_pp = round(max(1.5, min(8.0, 2.0 * std_dev)), 2)

    # Projeta votos restantes de cada localidade aplicando a variação média sobre a base 1T (normalizada entre os 2)
    proj_c1_rem = 0.0
    for loc in localities:
        r_loc = max(0, loc.estimated_remaining_valid_votes)
        if r_loc <= 0:
            continue
        expected_c1_share = min(100.0, max(0.0, loc.cand1_norm_1t + mean_swing)) / 100.0
        proj_c1_rem += r_loc * expected_c1_share

    total_final_valid = cand1.votes + cand2.votes + total_rem
    if total_final_valid <= 0:
        return pending_summary, ReferenceScenario(
            enabled=feature_reference_enabled,
            disclaimer=OFFICIAL_DISCLAIMER,
            has_sufficient_sample=False,
            sample_localities_count=len(eligible),
        )

    c1_center = round((cand1.votes + proj_c1_rem) / total_final_valid * 100.0, 2)
    c2_center = round(100.0 - c1_center, 2)

    # A banda de incerteza incide apenas sobre a parcela de votos ainda pendentes
    remaining_ratio = total_rem / total_final_valid
    effective_band = round(uncertainty_pp * remaining_ratio, 2)

    c1_low = round(max(0.0, c1_center - effective_band), 2)
    c1_high = round(min(100.0, c1_center + effective_band), 2)
    c2_low = round(max(0.0, 100.0 - c1_high), 2)
    c2_high = round(min(100.0, 100.0 - c1_low), 2)

    return pending_summary, ReferenceScenario(
        enabled=feature_reference_enabled,
        disclaimer=OFFICIAL_DISCLAIMER,
        has_sufficient_sample=True,
        sample_localities_count=len(eligible),
        observed_mean_swing_cand1_pp=round(mean_swing, 2),
        uncertainty_band_pp=effective_band,
        cand1_projected_pct_center=c1_center,
        cand1_projected_pct_low=c1_low,
        cand1_projected_pct_high=c1_high,
        cand2_projected_pct_center=c2_center,
        cand2_projected_pct_low=c2_low,
        cand2_projected_pct_high=c2_high,
    )
