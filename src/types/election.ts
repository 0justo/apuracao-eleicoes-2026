/**
 * Contratos TypeScript espelhando rigorosamente os snapshots JSON validados do backend.
 */

export interface CandidateResult {
  seq: number
  number: string
  sqcand: string
  full_name: string
  ballot_name: string
  party_acronym: string
  party_name: string
  coalition_name: string
  vice_name: string
  vice_party: string
  votes: number
  pct_valid: number
  pct_valid_display: string
  tse_elected_flag: boolean
  tse_status_text: string
  tse_official_attribution: string | null
  votes_1t: number
  pct_valid_1t: number
  pct_two_cand_1t: number
  swing_pp: number | null
  color_Slot: 1 | 2
  photo_url?: string
  tse_photo_url?: string
  tse_photo_filename?: string
}

export interface SectionsSummary {
  total_sections: number
  counted_sections: number
  remaining_sections: number
  pct_counted: number
  pct_counted_display: string
}

export interface ElectorateSummary {
  total_electorate: number
  counted_electorate: number
  turnout_votes: number
  pct_turnout: number
  abstention_votes: number
  pct_abstention: number
  turnout_1t: number
  pct_turnout_1t: number
}

export interface VotesSummary {
  total_votes: number
  valid_votes: number
  pct_valid_votes: number
  blank_votes: number
  pct_blank_votes: number
  null_votes: number
  pct_null_votes: number
  annulled_votes: number
  blank_null_rate_1t: number
}

export type TurnaroundStatusCode =
  | 'waiting_0pct'
  | 'exact_tie'
  | 'in_dispute'
  | 'exceeds_remaining'
  | 'already_above_half'
  | 'completed_100pct'

export interface TurnaroundAnalysis {
  disclaimer: string
  valid_votes_counted_v: number
  trailing_candidate_seq: number | null
  trailing_candidate_name: string
  trailing_candidate_votes_a: number
  leading_candidate_name: string
  leading_candidate_votes: number
  vote_difference: number
  margin_pp: number
  expected_turnout_total: number
  turnout_adjustment_pct: number
  observed_blank_null_rate: number
  used_1t_blank_null_fallback: boolean
  estimated_remaining_total_votes: number
  estimated_remaining_valid_votes_r: number
  needed_share_pct_s: number | null
  needed_votes_absolute: number
  status_code: TurnaroundStatusCode
  neutral_message: string
}

export interface LocalityDataItem {
  code_tse: string
  code_ibge: string
  uf: string
  name: string
  is_capital: boolean
  scope_type: 'uf' | 'mu'
  updated_at: string
  total_sections: number
  counted_sections: number
  pct_counted: number
  pct_remaining: number
  low_reliability: boolean
  total_electorate: number
  turnout_votes_2t: number
  turnout_votes_1t: number
  valid_votes_2t: number
  blank_votes_2t: number
  null_votes_2t: number
  blank_null_rate_1t: number
  cand1_votes_2t: number
  cand2_votes_2t: number
  cand1_pct_2t: number
  cand2_pct_2t: number
  margin_2t_pp: number
  cand1_votes_1t: number
  cand2_votes_1t: number
  valid_votes_1t: number
  cand1_pct_1t: number
  cand2_pct_1t: number
  cand1_norm_1t: number
  cand2_norm_1t: number
  leader_1t_slot: 1 | 2 | 0
  leader_1t_name: string
  margin_1t_pp: number
  cand1_swing_pp: number | null
  cand2_swing_pp: number | null
  net_swing_cand1_pp: number | null
  estimated_remaining_valid_votes: number
  changed_in_last_cycle: boolean
  delta_pct_counted_last_cycle: number
  source_json_url: string
  source_portal_url: string
}

export interface PendingSummary {
  disclaimer: string
  total_remaining_valid_votes: number
  remaining_in_cand1_1t_lead: number
  remaining_in_cand2_1t_lead: number
  remaining_in_tied_1t: number
  pct_remaining_in_cand1_1t_lead: number
  pct_remaining_in_cand2_1t_lead: number
}

export interface ReferenceScenario {
  enabled: boolean
  disclaimer: string
  methodology_note: string
  has_sufficient_sample: boolean
  sample_localities_count: number
  observed_mean_swing_cand1_pp: number
  uncertainty_band_pp: number
  cand1_projected_pct_center: number | null
  cand1_projected_pct_low: number | null
  cand1_projected_pct_high: number | null
  cand2_projected_pct_center: number | null
  cand2_projected_pct_low: number | null
  cand2_projected_pct_high: number | null
}

export interface TimelinePoint {
  timestamp: string
  iso_timestamp: string
  pct_counted: number
  cand1_pct: number
  cand2_pct: number
  margin_cand1_minus_cand2_pp: number
  cand1_votes: number
  cand2_votes: number
  valid_votes: number
}

export interface NarratorMessage {
  id: string
  timestamp: string
  category:
    | 'progress'
    | 'margin_change'
    | 'pending_hotspots'
    | 'turnaround_math'
    | 'swing_highlight'
    | 'official_status'
  text: string
  is_estimate: boolean
}

export interface FeatureFlagsPayload {
  reference_scenario: boolean
  narrator: boolean
  replay: boolean
}

export interface DisputeSnapshot {
  dispute_id: string
  cargo_code: '1' | '3'
  cargo_name: 'Presidente' | 'Governador'
  uf: string
  uf_name: string
  election_code_2t: string
  election_code_1t: string
  cycle: string
  is_replay: boolean
  replay_label: string | null
  generated_at_iso: string
  generated_at_hms: string
  tse_file_dg: string
  tse_file_hg: string
  tse_totalization_dt: string
  tse_totalization_ht: string
  validation_status: 'ok' | 'em_verificacao'
  validation_message: string | null
  source_json_url: string
  source_portal_url: string
  fixed_banner_text: string
  sections: SectionsSummary
  electorate: ElectorateSummary
  votes: VotesSummary
  candidates: [CandidateResult, CandidateResult]
  turnaround: TurnaroundAnalysis
  pending_summary: PendingSummary
  reference_scenario: ReferenceScenario
  localities: LocalityDataItem[]
  highlighted_locality_code: string | null
  timeline: TimelinePoint[]
  narrator_messages: NarratorMessage[]
  feature_flags: FeatureFlagsPayload
}

export interface DisputeCatalogItem {
  dispute_id: string
  cargo_code: '1' | '3'
  cargo_name: 'Presidente' | 'Governador'
  uf: string
  uf_name: string
  route_path: string
  snapshot_url: string
  pct_counted: number
  cand1_name: string
  cand1_number: string
  cand1_pct: number
  cand1_photo_url?: string
  cand2_name: string
  cand2_number: string
  cand2_pct: number
  cand2_photo_url?: string
  updated_at_hms: string
  validation_status: 'ok' | 'em_verificacao'
}

export interface ElectionCatalogSnapshot {
  cycle: string
  election_date: string
  generated_at_iso: string
  generated_at_hms: string
  source_mode: string
  feature_flags: FeatureFlagsPayload
  disputes: DisputeCatalogItem[]
}

export interface ReplayBundle {
  dispute_id: string
  title: string
  disclaimer: string
  total_frames: number
  frames: DisputeSnapshot[]
}

export interface OperationalStatusResponse {
  status: 'healthy' | 'degraded'
  running: boolean
  poll_cycles: number
  consecutive_errors: number
  last_poll_iso: string | null
  last_success_iso: string | null
  tse_client_stats: {
    requests_total: number
    not_modified_304: number
    errors_total: number
  }
}

