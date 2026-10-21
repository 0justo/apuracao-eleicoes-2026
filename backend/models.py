"""Modelos de domínio normalizados e contratos de Snapshot JSON para o app Apuração 2º Turno."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


def parse_tse_int(val: str | int | None, default: int = 0) -> int:
    """Converte string inteira do TSE (ex.: '56104503') para int."""
    if val is None or val == "":
        return default
    if isinstance(val, int):
        return val
    cleaned = str(val).strip().replace(".", "")
    try:
        return int(cleaned)
    except ValueError:
        return default


def parse_tse_float(val: str | float | int | None, default: float = 0.0) -> float:
    """Converte string decimal do TSE com vírgula (ex.: '47,03' ou '47,027772356') para float."""
    if val is None or val == "":
        return default
    if isinstance(val, (float, int)):
        return float(val)
    cleaned = str(val).strip().replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return default


class CandidateResult(BaseModel):
    """Resultado normalizado de um candidato na ordem oficial do TSE (`seq`)."""

    seq: int = Field(description="Ordem oficial de apresentação no arquivo EA20 do TSE")
    number: str = Field(description="Número de urna do candidato (ex.: '13', '22')")
    sqcand: str = Field(description="Identificador sequencial do candidato no TSE")
    full_name: str = Field(description="Nome completo no registro do TSE (nm)")
    ballot_name: str = Field(description="Nome de urna no TSE (nmu)")
    party_acronym: str = Field(description="Sigla do partido (sg)")
    party_name: str = Field(description="Nome do partido (nm)")
    coalition_name: str = Field(default="", description="Nome da coligação/federação (agr.nm)")
    vice_name: str = Field(default="", description="Nome de urna do vice (vs[0].nmu)")
    vice_party: str = Field(default="", description="Partido do vice (vs[0].sgp)")
    votes: int = Field(description="Votos válidos computados no 2º turno (vap)")
    pct_valid: float = Field(description="Percentual sobre votos válidos com precisão (pvapn)")
    pct_valid_display: str = Field(description="Percentual formatado do TSE (pvap)")
    tse_elected_flag: bool = Field(
        default=False,
        description="True SOMENTE se o próprio arquivo do TSE trouxer e == 's' no 2º turno",
    )
    tse_status_text: str = Field(
        default="",
        description="Texto oficial do campo 'st' do TSE (ex.: 'Eleito', 'Matematicamente definido', '')",
    )
    tse_official_attribution: str | None = Field(
        default=None,
        description="Se tse_elected_flag for True, traz 'Eleito (segundo o TSE)'; caso contrário None",
    )
    votes_1t: int = Field(default=0, description="Votos válidos no 1º turno na mesma abrangência")
    pct_valid_1t: float = Field(
        default=0.0,
        description="Percentual sobre o total de votos válidos do 1º turno na mesma abrangência",
    )
    pct_two_cand_1t: float = Field(
        default=0.0,
        description="Percentual normalizado apenas entre os dois finalistas no 1º turno",
    )
    swing_pp: float | None = Field(
        default=None,
        description="Variação em pontos percentuais (pct_valid_2t - pct_valid_1t) quando há votos apurados",
    )
    color_Slot: Literal[1, 2] = Field(
        default=1,
        description="Slot visual fixo (1 ou 2)",
    )
    color_slot: Literal[1, 2] = Field(
        default=1,
        description="Slot visual fixo (1 ou 2)",
    )
    photo_url: str = Field(
        default="",
        description="Caminho estático no CDN próprio (/avatars/<sqcand>.svg) espelhado a partir do metadado sqcand do TSE (o navegador nunca requisita resultados.tse.jus.br)",
    )
    tse_photo_url: str = Field(
        default="",
        description="Metadado da URL oficial da foto de urna no TSE (espelhada localmente pelo backend/CDN)",
    )
    tse_photo_filename: str = Field(
        default="",
        description="Nome oficial do arquivo de foto de urna no TSE (f<cd_pleito><sqcand>_div.jpg)",
    )


class SectionsSummary(BaseModel):
    """Resumo de seções eleitorais (bloco 's' do EA20/EA14)."""

    total_sections: int = Field(description="Total de seções (ts)")
    counted_sections: int = Field(description="Seções totalizadas (st)")
    remaining_sections: int = Field(description="Seções não totalizadas (snt)")
    pct_counted: float = Field(description="Percentual de seções totalizadas numérico (pstn)")
    pct_counted_display: str = Field(description="Percentual de seções totalizadas texto (pst)")


class ElectorateSummary(BaseModel):
    """Resumo de eleitorado e comparecimento (bloco 'e' do EA20/EA14)."""

    total_electorate: int = Field(description="Eleitorado total (te)")
    counted_electorate: int = Field(description="Eleitorado das seções totalizadas (est)")
    turnout_votes: int = Field(description="Comparecimento em votos já apurados (c)")
    pct_turnout: float = Field(description="Percentual de comparecimento nas seções apuradas (pcn)")
    abstention_votes: int = Field(description="Abstenção nas seções apuradas (a)")
    pct_abstention: float = Field(description="Percentual de abstenção nas seções apuradas (pan)")
    turnout_1t: int = Field(default=0, description="Comparecimento total observado no 1º turno")
    pct_turnout_1t: float = Field(default=0.0, description="Percentual de comparecimento no 1º turno")


class VotesSummary(BaseModel):
    """Resumo de votos apurados (bloco 'v' do EA20)."""

    total_votes: int = Field(description="Total de votos apurados (tv)")
    valid_votes: int = Field(description="Votos válidos (vv)")
    pct_valid_votes: float = Field(description="Percentual de votos válidos (pvvn)")
    blank_votes: int = Field(description="Votos em branco (vb)")
    pct_blank_votes: float = Field(description="Percentual de votos em branco (pvbn)")
    null_votes: int = Field(description="Total de votos nulos (tvn = vn + vnt)")
    pct_null_votes: float = Field(description="Percentual de votos nulos (ptvnn)")
    annulled_votes: int = Field(default=0, description="Votos anulados + sub judice (van + vansj)")
    blank_null_rate_1t: float = Field(
        default=0.0,
        description="Taxa de brancos e nulos observada no 1º turno nesta abrangência",
    )


class TurnaroundAnalysis(BaseModel):
    """Resultado da Calculadora da Virada para uma disputa."""

    disclaimer: str = Field(
        default="Estimativa do site, não é resultado oficial",
        description="Rótulo obrigatório para qualquer estimativa",
    )
    valid_votes_counted_v: int = Field(description="V = votos válidos já apurados dos 2 candidatos")
    trailing_candidate_seq: int | None = Field(
        default=None, description="seq do candidato que está atrás (None se empate exato)"
    )
    trailing_candidate_name: str = Field(description="Nome de urna do candidato de referência (A)")
    trailing_candidate_votes_a: int = Field(description="A = votos válidos do candidato atrás")
    leading_candidate_name: str = Field(description="Nome de urna do outro candidato")
    leading_candidate_votes: int = Field(description="Votos válidos do outro candidato")
    vote_difference: int = Field(description="Diferença atual em votos válidos")
    margin_pp: float = Field(description="Diferença atual em pontos percentuais dos votos válidos")
    expected_turnout_total: int = Field(description="Comparecimento total esperado na disputa")
    turnout_adjustment_pct: float = Field(
        default=0.0, description="Ajuste percentual aplicado ao comparecimento esperado"
    )
    observed_blank_null_rate: float = Field(
        description="Taxa de brancos e nulos usada (observada no 2ºT ou fallback do 1ºT quando tv=0)"
    )
    used_1t_blank_null_fallback: bool = Field(
        default=False,
        description="True se tv=0 e foi usada a taxa de brancos/nulos do 1º turno como base inicial",
    )
    estimated_remaining_total_votes: int = Field(
        description="Votos totais restantes estimados (comparecimento esperado - votos já apurados)"
    )
    estimated_remaining_valid_votes_r: int = Field(
        description="R = votos válidos restantes estimados"
    )
    needed_share_pct_s: float | None = Field(
        default=None,
        description="s = (((V + R) / 2 - A) / R) * 100, em % dos votos válidos restantes",
    )
    needed_votes_absolute: int = Field(
        default=0,
        description="Quantidade absoluta de votos válidos restantes necessários para ultrapassar 50%",
    )
    status_code: Literal[
        "waiting_0pct",
        "exact_tie",
        "in_dispute",
        "exceeds_remaining",
        "already_above_half",
        "completed_100pct",
    ]
    neutral_message: str = Field(
        description="Mensagem estritamente neutra explicando o valor de s sem declarar vencedor"
    )


class LocalityDataItem(BaseModel):
    """Dados de uma unidade geográfica (UF ou Município) para ranking, mapa e calculadora."""

    code_tse: str = Field(description="Código da UF ('sp') ou código TSE de 5 dígitos ('71072')")
    code_ibge: str = Field(default="", description="Código IBGE de 7 dígitos (cdi) ou UF")
    uf: str = Field(description="Sigla da UF em maiúsculas (ex.: 'SP', 'AC', 'ZZ')")
    name: str = Field(description="Nome oficial da UF ou município")
    is_capital: bool = Field(default=False, description="Indica se é capital de estado")
    scope_type: Literal["uf", "mu"] = Field(description="Tipo de unidade geográfica")
    updated_at: str = Field(default="", description="Data/hora da última totalização do local (dt ht)")

    total_sections: int
    counted_sections: int
    pct_counted: float
    pct_remaining: float
    low_reliability: bool = Field(
        description="True se pct_counted < 30.0 (exibe hachura/transparência no mapa)"
    )

    total_electorate: int
    turnout_votes_2t: int
    turnout_votes_1t: int
    valid_votes_2t: int
    blank_votes_2t: int
    null_votes_2t: int
    blank_null_rate_1t: float

    cand1_votes_2t: int = 0
    cand2_votes_2t: int = 0
    cand1_pct_2t: float = 0.0
    cand2_pct_2t: float = 0.0
    margin_2t_pp: float = 0.0

    cand1_votes_1t: int = 0
    cand2_votes_1t: int = 0
    valid_votes_1t: int = 0
    cand1_pct_1t: float = 0.0
    cand2_pct_1t: float = 0.0
    cand1_norm_1t: float = 50.0
    cand2_norm_1t: float = 50.0
    leader_1t_slot: Literal[1, 2, 0] = Field(
        default=0, description="Qual finalista teve mais votos neste local no 1º turno (1, 2 ou 0=empate)"
    )
    leader_1t_name: str = ""
    margin_1t_pp: float = Field(
        default=0.0, description="Diferença em p.p. no 1º turno entre os dois finalistas"
    )

    cand1_swing_pp: float | None = Field(
        default=None,
        description="Variação em p.p. do Candidato 1 entre 1º e 2º turno (cand1_pct_2t - cand1_pct_1t)",
    )
    cand2_swing_pp: float | None = Field(
        default=None,
        description="Variação em p.p. do Candidato 2 entre 1º e 2º turno (cand2_pct_2t - cand2_pct_1t)",
    )
    net_swing_cand1_pp: float | None = Field(
        default=None,
        description="Variação líquida na divisão entre os 2 candidatos (cand1_pct_2t - cand1_norm_1t)",
    )
    estimated_remaining_valid_votes: int = Field(
        default=0, description="Votos válidos restantes estimados neste local (Estimativa do site)"
    )
    changed_in_last_cycle: bool = Field(
        default=False, description="True se teve atualização neste ciclo (destaque no mapa)"
    )
    delta_pct_counted_last_cycle: float = Field(
        default=0.0, description="Aumento no % de urnas apuradas no último ciclo"
    )
    source_json_url: str = Field(description="URL direta do arquivo JSON oficial do TSE para este local")
    source_portal_url: str = Field(description="URL do Portal Resultados do TSE para este local")


class PendingSummary(BaseModel):
    """Resumo de 'Onde ainda falta contar' (barras empilhadas e cenário de referência)."""

    disclaimer: str = "Estimativa do site, não é resultado oficial"
    total_remaining_valid_votes: int
    remaining_in_cand1_1t_lead: int = Field(
        description="Votos válidos restantes estimados onde Candidato 1 liderou no 1º turno"
    )
    remaining_in_cand2_1t_lead: int = Field(
        description="Votos válidos restantes estimados onde Candidato 2 liderou no 1º turno"
    )
    remaining_in_tied_1t: int = 0
    pct_remaining_in_cand1_1t_lead: float = 0.0
    pct_remaining_in_cand2_1t_lead: float = 0.0


class ReferenceScenario(BaseModel):
    """Cenário de referência opcional (variação uniforme aplicada aos locais pendentes)."""

    enabled: bool = Field(description="Controlado por FEATURE_REFERENCE_SCENARIO (false por padrão)")
    disclaimer: str = "Estimativa do site, não é resultado oficial"
    methodology_note: str = (
        "Aplica a variação média ponderada observada nos locais com pelo menos 30% das urnas "
        "apuradas aos votos válidos restantes estimados de cada local pendente."
    )
    has_sufficient_sample: bool = False
    sample_localities_count: int = 0
    observed_mean_swing_cand1_pp: float = 0.0
    uncertainty_band_pp: float = Field(
        default=0.0, description="Faixa de incerteza (±2 desvios-padrão ponderados, mín ±1.5 p.p.)"
    )
    cand1_projected_pct_center: float | None = None
    cand1_projected_pct_low: float | None = None
    cand1_projected_pct_high: float | None = None
    cand2_projected_pct_center: float | None = None
    cand2_projected_pct_low: float | None = None
    cand2_projected_pct_high: float | None = None


class TimelinePoint(BaseModel):
    """Ponto histórico da linha do tempo da apuração de uma disputa."""

    timestamp: str = Field(description="Horário da medição (HH:MM:SS)")
    iso_timestamp: str = Field(description="Timestamp ISO-8601")
    pct_counted: float = Field(description="% de seções totalizadas")
    cand1_pct: float = Field(description="% de votos válidos do Candidato 1")
    cand2_pct: float = Field(description="% de votos válidos do Candidato 2")
    margin_cand1_minus_cand2_pp: float = Field(
        description="Margem (Cand 1 - Cand 2) em pontos percentuais"
    )
    cand1_votes: int
    cand2_votes: int
    valid_votes: int


class NarratorMessage(BaseModel):
    """Frase curta gerada por template determinístico para o feed do Narrador Automático."""

    id: str
    timestamp: str = Field(description="Horário da frase (HH:MM:SS)")
    category: Literal[
        "progress",
        "margin_change",
        "pending_hotspots",
        "turnaround_math",
        "swing_highlight",
        "official_status",
    ]
    text: str
    is_estimate: bool = False


class FeatureFlagsPayload(BaseModel):
    """Flags enviadas no snapshot para permitir desligar recursos sem novo deploy do frontend."""

    reference_scenario: bool = False
    narrator: bool = True
    replay: bool = True


class DisputeSnapshot(BaseModel):
    """Snapshot estático completo de uma disputa (Presidente ou Governador de UF)."""

    dispute_id: str = Field(description="Ex.: 'presidente' ou 'governador-ac'")
    cargo_code: Literal["1", "3"]
    cargo_name: Literal["Presidente", "Governador"]
    uf: str = Field(description="'BR' para Presidente, ou sigla da UF ('AC', 'AM', etc.)")
    uf_name: str = Field(description="'Brasil' ou nome por extenso do estado")
    election_code_2t: str = Field(description="Código TSE do 2º turno (ex.: '6258' ou '6260')")
    election_code_1t: str = Field(description="Código TSE do 1º turno (ex.: '6257' ou '6259')")
    cycle: str = Field(default="ele2026")
    is_replay: bool = Field(default=False, description="True somente quando no modo Replay 2022")
    replay_label: str | None = Field(
        default=None, description="Rótulo claro caso seja replay histórico de 2022"
    )

    generated_at_iso: str = Field(description="Timestamp ISO-8601 da publicação deste snapshot")
    generated_at_hms: str = Field(description="Horário HH:MM:SS de Brasília da última atualização")
    tse_file_dg: str = Field(description="Data de geração do arquivo no TSE (dg)")
    tse_file_hg: str = Field(description="Hora de geração do arquivo no TSE (hg)")
    tse_totalization_dt: str = Field(description="Data da última totalização no TSE (dt)")
    tse_totalization_ht: str = Field(description="Hora da última totalização no TSE (ht)")

    validation_status: Literal["ok", "em_verificacao"] = Field(
        default="ok",
        description="Se a validação de sanidade do último ciclo falhou, mantém o anterior e marca 'em_verificacao'",
    )
    validation_message: str | None = None

    source_json_url: str = Field(description="URL do arquivo EA20 oficial no TSE")
    source_portal_url: str = Field(description="URL direta do Portal Resultados do TSE")
    fixed_banner_text: str = Field(
        description="Resultado parcial até 100% das urnas apuradas. Fonte: TSE. Atualizado às HH:MM:SS"
    )

    sections: SectionsSummary
    electorate: ElectorateSummary
    votes: VotesSummary
    candidates: list[CandidateResult] = Field(
        description="Sempre na ordem fixa e consistente oficial do TSE (seq)"
    )
    turnaround: TurnaroundAnalysis
    pending_summary: PendingSummary
    reference_scenario: ReferenceScenario
    localities: list[LocalityDataItem] = Field(
        description="Para Presidente: 27 UFs + ZZ. Para Governador: municípios do estado."
    )
    highlighted_locality_code: str | None = Field(
        default=None, description="Código do local que mais avançou no último ciclo"
    )
    timeline: list[TimelinePoint] = Field(default_factory=list)
    narrator_messages: list[NarratorMessage] = Field(default_factory=list)
    feature_flags: FeatureFlagsPayload = Field(default_factory=FeatureFlagsPayload)


class DisputeCatalogItem(BaseModel):
    """Item do catálogo de disputas disponíveis descobertas a partir do ele-c.json do TSE."""

    dispute_id: str
    cargo_code: Literal["1", "3"]
    cargo_name: Literal["Presidente", "Governador"]
    uf: str
    uf_name: str
    route_path: str
    snapshot_url: str
    pct_counted: float
    cand1_name: str
    cand1_number: str
    cand1_pct: float
    cand1_photo_url: str = ""
    cand2_name: str
    cand2_number: str
    cand2_pct: float
    cand2_photo_url: str = ""
    updated_at_hms: str
    validation_status: Literal["ok", "em_verificacao"] = "ok"


class ElectionCatalogSnapshot(BaseModel):
    """Catálogo geral publicado em /snapshots/catalog.json."""

    cycle: str
    election_date: str = "25/10/2026"
    generated_at_iso: str
    generated_at_hms: str
    source_mode: str
    feature_flags: FeatureFlagsPayload
    disputes: list[DisputeCatalogItem]
