/**
 * Motor matemático no cliente para recálculo instantâneo da Calculadora da Virada
 * quando o usuário move o controle deslizante de comparecimento esperado.
 *
 * Mantém paridade matemática exata com `backend/calculator.py`.
 */

import type {
  DisputeSnapshot,
  LocalityDataItem,
  TurnaroundAnalysis,
} from '../types/election'
import { formatNumberComma } from './formatters'

export const OFFICIAL_ESTIMATE_DISCLAIMER =
  'Estimativa do site, não é resultado oficial'

export function computeLocalityRemainingValid(
  loc: LocalityDataItem,
  turnoutAdjustmentPct: number,
): { expectedTurnout: number; remainingValid: number } {
  if (loc.pct_counted >= 100.0) {
    return { expectedTurnout: loc.turnout_votes_2t, remainingValid: 0 }
  }
  const factor = Math.max(0, 1 + turnoutAdjustmentPct / 100)
  let baseExpected = Math.round(Math.max(0, loc.turnout_votes_1t) * factor)
  if (loc.total_electorate > 0) {
    baseExpected = Math.min(loc.total_electorate, baseExpected)
  }
  const expectedTurnout = Math.max(loc.turnout_votes_2t, baseExpected)
  const remainingTotal = Math.max(0, expectedTurnout - loc.turnout_votes_2t)

  const bnRate =
    loc.turnout_votes_2t > 0
      ? Math.min(
          1,
          Math.max(
            0,
            (loc.blank_votes_2t + loc.null_votes_2t) / loc.turnout_votes_2t,
          ),
        )
      : Math.min(1, Math.max(0, loc.blank_null_rate_1t))

  const remainingValid = Math.max(
    0,
    Math.round(remainingTotal * (1 - bnRate)),
  )
  return { expectedTurnout, remainingValid }
}

export function recalculateTurnaroundClient(
  snapshot: DisputeSnapshot,
  turnoutAdjustmentPct: number,
): TurnaroundAnalysis {
  if (Math.abs(turnoutAdjustmentPct) < 1e-6) {
    return snapshot.turnaround
  }

  const [cand1, cand2] = snapshot.candidates
  const v1 = Math.max(0, cand1.votes)
  const v2 = Math.max(0, cand2.votes)
  const vTotal = v1 + v2

  const turnout2t = snapshot.electorate.turnout_votes
  const blank2t = snapshot.votes.blank_votes
  const null2t = snapshot.votes.null_votes
  const turnout1t = snapshot.electorate.turnout_1t
  const totalElectorate = snapshot.electorate.total_electorate
  const pctCounted = snapshot.sections.pct_counted

  const observedBnRate =
    turnout2t > 0
      ? Math.min(1, Math.max(0, (blank2t + null2t) / turnout2t))
      : Math.min(1, Math.max(0, snapshot.votes.blank_null_rate_1t))
  const usedFallback = turnout2t === 0

  let expectedTurnout = turnout2t
  let remainingTotalVotes = 0
  let rValid = 0

  if (pctCounted < 100.0) {
    if (snapshot.localities.length > 0) {
      let expSum = 0
      let rSum = 0
      for (const loc of snapshot.localities) {
        const { expectedTurnout: expLoc, remainingValid: rLoc } =
          computeLocalityRemainingValid(loc, turnoutAdjustmentPct)
        expSum += expLoc
        rSum += rLoc
      }
      expectedTurnout = Math.max(turnout2t, expSum)
      remainingTotalVotes = Math.max(0, expectedTurnout - turnout2t)
      rValid = Math.max(0, rSum)
    } else {
      const factor = Math.max(0, 1 + turnoutAdjustmentPct / 100)
      let rawExp = Math.round(Math.max(0, turnout1t) * factor)
      if (totalElectorate > 0) {
        rawExp = Math.min(totalElectorate, rawExp)
      }
      expectedTurnout = Math.max(turnout2t, rawExp)
      remainingTotalVotes = Math.max(0, expectedTurnout - turnout2t)
      rValid = Math.max(
        0,
        Math.round(remainingTotalVotes * (1 - observedBnRate)),
      )
    }
  }

  let trailingSeq: number | null = null
  let trailingName = `${cand1.ballot_name} / ${cand2.ballot_name}`
  let trailingVotesA = v1
  let leadingName = `${cand1.ballot_name} / ${cand2.ballot_name}`
  let leadingVotes = v2

  if (v1 < v2) {
    trailingSeq = cand1.seq
    trailingName = cand1.ballot_name
    trailingVotesA = v1
    leadingName = cand2.ballot_name
    leadingVotes = v2
  } else if (v2 < v1) {
    trailingSeq = cand2.seq
    trailingName = cand2.ballot_name
    trailingVotesA = v2
    leadingName = cand1.ballot_name
    leadingVotes = v1
  }

  const voteDiff = Math.abs(v1 - v2)
  const marginPP =
    vTotal > 0 ? Number(((Math.abs(v1 - v2) / vTotal) * 100).toFixed(2)) : 0

  if (vTotal === 0 && pctCounted === 0) {
    const neededAbs = rValid > 0 ? Math.floor(rValid / 2) + 1 : 0
    return {
      disclaimer: OFFICIAL_ESTIMATE_DISCLAIMER,
      valid_votes_counted_v: 0,
      trailing_candidate_seq: null,
      trailing_candidate_name: trailingName,
      trailing_candidate_votes_a: 0,
      leading_candidate_name: leadingName,
      leading_candidate_votes: 0,
      vote_difference: 0,
      margin_pp: 0,
      expected_turnout_total: expectedTurnout,
      turnout_adjustment_pct: turnoutAdjustmentPct,
      observed_blank_null_rate: observedBnRate,
      used_1t_blank_null_fallback: usedFallback,
      estimated_remaining_total_votes: remainingTotalVotes,
      estimated_remaining_valid_votes_r: rValid,
      needed_share_pct_s: rValid > 0 ? 50.0 : null,
      needed_votes_absolute: neededAbs,
      status_code: 'waiting_0pct',
      neutral_message:
        'Aguardando início da totalização de votos válidos. Com 0% apurado, qualquer candidato precisa de mais de 50,00% dos votos válidos restantes estimados.',
    }
  }

  if (rValid <= 0) {
    const isTie = v1 === v2
    return {
      disclaimer: OFFICIAL_ESTIMATE_DISCLAIMER,
      valid_votes_counted_v: vTotal,
      trailing_candidate_seq: trailingSeq,
      trailing_candidate_name: trailingName,
      trailing_candidate_votes_a: trailingVotesA,
      leading_candidate_name: leadingName,
      leading_candidate_votes: leadingVotes,
      vote_difference: voteDiff,
      margin_pp: marginPP,
      expected_turnout_total: expectedTurnout,
      turnout_adjustment_pct: turnoutAdjustmentPct,
      observed_blank_null_rate: observedBnRate,
      used_1t_blank_null_fallback: usedFallback,
      estimated_remaining_total_votes: remainingTotalVotes,
      estimated_remaining_valid_votes_r: 0,
      needed_share_pct_s: null,
      needed_votes_absolute: 0,
      status_code: isTie
        ? 'exact_tie'
        : pctCounted >= 100
          ? 'completed_100pct'
          : 'exceeds_remaining',
      neutral_message: isTie
        ? 'Com 0 votos válidos restantes estimados, os dois candidatos encontram-se com a mesma quantidade de votos válidos.'
        : pctCounted >= 100
          ? '100% das seções foram totalizadas. Não há votos restantes a apurar.'
          : 'Pelos dados atuais, a diferença supera o total estimado de votos restantes.',
    }
  }

  const sFraction = ((vTotal + rValid) / 2 - trailingVotesA) / rValid
  const sPct = Number((sFraction * 100).toFixed(2))
  const neededVotesAbs = Math.max(
    0,
    Math.floor((vTotal + rValid) / 2 - trailingVotesA) + 1,
  )

  if (sFraction <= 0) {
    return {
      disclaimer: OFFICIAL_ESTIMATE_DISCLAIMER,
      valid_votes_counted_v: vTotal,
      trailing_candidate_seq: trailingSeq,
      trailing_candidate_name: trailingName,
      trailing_candidate_votes_a: trailingVotesA,
      leading_candidate_name: leadingName,
      leading_candidate_votes: leadingVotes,
      vote_difference: voteDiff,
      margin_pp: marginPP,
      expected_turnout_total: expectedTurnout,
      turnout_adjustment_pct: turnoutAdjustmentPct,
      observed_blank_null_rate: observedBnRate,
      used_1t_blank_null_fallback: usedFallback,
      estimated_remaining_total_votes: remainingTotalVotes,
      estimated_remaining_valid_votes_r: rValid,
      needed_share_pct_s: sPct,
      needed_votes_absolute: 0,
      status_code: 'already_above_half',
      neutral_message:
        'Pelos dados atuais, o candidato já soma mais da metade do total estimado de votos válidos.',
    }
  }

  if (sFraction > 1) {
    return {
      disclaimer: OFFICIAL_ESTIMATE_DISCLAIMER,
      valid_votes_counted_v: vTotal,
      trailing_candidate_seq: trailingSeq,
      trailing_candidate_name: trailingName,
      trailing_candidate_votes_a: trailingVotesA,
      leading_candidate_name: leadingName,
      leading_candidate_votes: leadingVotes,
      vote_difference: voteDiff,
      margin_pp: marginPP,
      expected_turnout_total: expectedTurnout,
      turnout_adjustment_pct: turnoutAdjustmentPct,
      observed_blank_null_rate: observedBnRate,
      used_1t_blank_null_fallback: usedFallback,
      estimated_remaining_total_votes: remainingTotalVotes,
      estimated_remaining_valid_votes_r: rValid,
      needed_share_pct_s: sPct,
      needed_votes_absolute: neededVotesAbs,
      status_code: 'exceeds_remaining',
      neutral_message:
        'Pelos dados atuais, a diferença supera o total estimado de votos restantes.',
    }
  }

  if (v1 === v2) {
    return {
      disclaimer: OFFICIAL_ESTIMATE_DISCLAIMER,
      valid_votes_counted_v: vTotal,
      trailing_candidate_seq: null,
      trailing_candidate_name: trailingName,
      trailing_candidate_votes_a: trailingVotesA,
      leading_candidate_name: leadingName,
      leading_candidate_votes: leadingVotes,
      vote_difference: 0,
      margin_pp: 0,
      expected_turnout_total: expectedTurnout,
      turnout_adjustment_pct: turnoutAdjustmentPct,
      observed_blank_null_rate: observedBnRate,
      used_1t_blank_null_fallback: usedFallback,
      estimated_remaining_total_votes: remainingTotalVotes,
      estimated_remaining_valid_votes_r: rValid,
      needed_share_pct_s: 50.0,
      needed_votes_absolute: neededVotesAbs,
      status_code: 'exact_tie',
      neutral_message:
        'Os candidatos têm a mesma quantidade de votos válidos até o momento. Cada um precisa de mais de 50,00% dos votos válidos restantes estimados para passar à frente.',
    }
  }

  return {
    disclaimer: OFFICIAL_ESTIMATE_DISCLAIMER,
    valid_votes_counted_v: vTotal,
    trailing_candidate_seq: trailingSeq,
    trailing_candidate_name: trailingName,
    trailing_candidate_votes_a: trailingVotesA,
    leading_candidate_name: leadingName,
    leading_candidate_votes: leadingVotes,
    vote_difference: voteDiff,
    margin_pp: marginPP,
    expected_turnout_total: expectedTurnout,
    turnout_adjustment_pct: turnoutAdjustmentPct,
    observed_blank_null_rate: observedBnRate,
    used_1t_blank_null_fallback: usedFallback,
    estimated_remaining_total_votes: remainingTotalVotes,
    estimated_remaining_valid_votes_r: rValid,
    needed_share_pct_s: sPct,
    needed_votes_absolute: neededVotesAbs,
    status_code: 'in_dispute',
    neutral_message: `Pelos dados atuais, ${trailingName} precisa de ${formatNumberComma(sPct, 2)}% dos votos válidos restantes estimados para ultrapassar 50% dos votos válidos.`,
  }
}
