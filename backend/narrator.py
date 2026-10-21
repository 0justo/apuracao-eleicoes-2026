"""Narrador Automático Neutro baseado em Templates Determinísticos (sem LLM em execução).

Gera frases curtas e variadas por disputa a cada ciclo de apuração, respeitando
rigorosamente a regra de Neutralidade Política Absoluta e a proibição de declaração própria.
"""

from __future__ import annotations

import re
from typing import Sequence

from backend.models import (
    CandidateResult,
    LocalityDataItem,
    NarratorMessage,
    SectionsSummary,
    TimelinePoint,
    TurnaroundAnalysis,
)

# Termos proibidos por conta própria (só "Eleito (segundo o TSE)" é permitido quando e=='s')
FORBIDDEN_PATTERNS = [
    r"\bvencedor(?:a|es)?\b",
    r"\bganhou\b",
    r"\bganha\b",
    r"\bvit[oó]ria\b",
    r"\bderrota(?:do|da)?\b",
    r"\bperd(?:eu|endo)\b",
    r"\bfavorito\b",
    r"\bvantagem irrevers[ií]vel\b",
]


def fmt_br_num(val: int) -> str:
    """Formata inteiro com separador de milhar brasileiro (ex.: 1.234.567)."""
    return f"{val:,}".replace(",", ".")


def fmt_br_pct(val: float, decimals: int = 2) -> str:
    """Formata float com vírgula decimal (ex.: 47,03)."""
    return f"{val:.{decimals}f}".replace(".", ",")


def assert_neutral_text(
    text: str,
    allow_tse_elected: bool = False,
    allowed_proper_nouns: Sequence[str] | None = None,
) -> str:
    """Audita uma frase contra qualquer termo proibido pelas Regras Inegociáveis,
    preservando nomes próprios oficiais de municípios (ex.: 'VITÓRIA' - capital do ES).
    """
    cleaned = text
    if allowed_proper_nouns:
        for noun in allowed_proper_nouns:
            if noun:
                cleaned = cleaned.replace(noun, "<LOCAL>")

    for pat in FORBIDDEN_PATTERNS:
        if re.search(pat, cleaned, flags=re.IGNORECASE):
            raise ValueError(f"Violação de neutralidade detectada na frase: '{text}'")

    # Verifica a palavra "eleito(a)" — só permitida dentro de "Eleito (segundo o TSE)"
    if allow_tse_elected:
        cleaned = cleaned.replace("Eleito (segundo o TSE)", "")
    if re.search(r"\beleit[oa]s?\b", cleaned, flags=re.IGNORECASE):
        raise ValueError(
            f"Menção a 'eleito' sem atribuição oficial do TSE detectada: '{text}'"
        )
    return text


PROGRESS_TEMPLATES = [
    (
        "Já foram apuradas {pct_apurado}% das urnas ({secoes_apuradas} de {secoes_total} seções). "
        "{cand1_nome} registra {cand1_pct}% dos votos válidos ({cand1_votos} votos) e "
        "{cand2_nome} registra {cand2_pct}% ({cand2_votos} votos). "
        "A diferença entre os candidatos é de {margem_pp} pontos percentuais."
    ),
    (
        "Com {pct_apurado}% das seções totalizadas pelo TSE, a diferença entre os dois candidatos "
        "é de {margem_pp} pontos percentuais ({diff_votos} votos válidos): "
        "{cand1_nome} tem {cand1_pct}% e {cand2_nome} tem {cand2_pct}%."
    ),
    (
        "Totalização em {pct_apurado}% das urnas: {cand1_nome} soma {cand1_votos} votos válidos "
        "({cand1_pct}%) e {cand2_nome} soma {cand2_votos} votos válidos ({cand2_pct}%), "
        "uma diferença de {margem_pp} pontos percentuais."
    ),
]

WAITING_TEMPLATES = [
    (
        "Apuração com 0,00% das urnas totalizadas ({secoes_total} seções cadastradas no TSE). "
        "A divulgação oficial dos votos ocorre a partir das 17h (horário de Brasília)."
    ),
    (
        "Aguardando os primeiros boletins de urna totalizados pelo TSE para as {secoes_total} seções desta disputa. "
        "Nenhum voto computado até o momento (0,00%)."
    ),
]

COMPLETED_TEMPLATES = [
    (
        "100,00% das seções foram totalizadas pelo TSE ({secoes_total} seções). "
        "{cand1_nome} obteve {cand1_pct}% dos votos válidos ({cand1_votos} votos) e "
        "{cand2_nome} obteve {cand2_pct}% ({cand2_votos} votos), com diferença final de {margem_pp} pontos percentuais."
    ),
    (
        "Totalização concluída em 100,00% das urnas: {cand1_nome} registra {cand1_votos} votos válidos ({cand1_pct}%) "
        "e {cand2_nome} registra {cand2_votos} votos válidos ({cand2_pct}%). "
        "A diferença entre os candidatos é de {margem_pp} pontos percentuais."
    ),
]

PENDING_TEMPLATES = [
    (
        "Ainda faltam {pct_restante}% das urnas; as maiores quantidades pendentes estão em "
        "{loc1}, {loc2} e {loc3}."
    ),
    (
        "Restam {pct_restante}% das seções para totalizar. Os locais com maior volume estimado "
        "de votos válidos pendentes são {loc1}, {loc2} e {loc3}."
    ),
    (
        "Faltando {pct_restante}% das urnas, a maior concentração de votos restantes estimados "
        "encontra-se em {loc1}, {loc2} e {loc3}."
    ),
]

MARGIN_CHANGE_TEMPLATES = [
    "Nos últimos ciclos de atualização, a diferença em pontos percentuais entre os candidatos {direcao} {delta_pp} pontos (de {prev_pp} p.p. para {curr_pp} p.p.).",
    "Em comparação com a leitura anterior ({prev_hms}), a margem entre os candidatos {direcao} {delta_pp} pontos percentuais.",
    "A diferença percentual entre os dois candidatos {direcao} {delta_pp} pontos desde as {prev_hms}, situando-se agora em {curr_pp} pontos percentuais.",
]


def generate_narrator_messages(
    dispute_id: str,
    timestamp_hms: str,
    sections: SectionsSummary,
    candidates: Sequence[CandidateResult],
    turnaround: TurnaroundAnalysis,
    localities: Sequence[LocalityDataItem],
    timeline: Sequence[TimelinePoint],
    cycle_index: int = 0,
) -> list[NarratorMessage]:
    """Gera o conjunto de mensagens neutras do ciclo atual para compor o feed da disputa."""
    if len(candidates) < 2:
        return []

    c1, c2 = candidates[0], candidates[1]
    proper_nouns = [c1.ballot_name, c2.ballot_name] + [loc.name for loc in localities]
    messages: list[NarratorMessage] = []

    pct_apurado = fmt_br_pct(sections.pct_counted)
    pct_restante = fmt_br_pct(max(0.0, 100.0 - sections.pct_counted))
    margem_pp = fmt_br_pct(abs(c1.pct_valid - c2.pct_valid))
    diff_votos = fmt_br_num(abs(c1.votes - c2.votes))

    # 1. Frase principal de progresso da apuração
    if sections.pct_counted == 0.0 and (c1.votes + c2.votes) == 0:
        tpl = WAITING_TEMPLATES[cycle_index % len(WAITING_TEMPLATES)]
        text = tpl.format(secoes_total=fmt_br_num(sections.total_sections))
        messages.append(
            NarratorMessage(
                id=f"{dispute_id}-{cycle_index}-progress",
                timestamp=timestamp_hms,
                category="progress",
                text=assert_neutral_text(text, allowed_proper_nouns=proper_nouns),
                is_estimate=False,
            )
        )
        return messages

    if sections.pct_counted >= 100.0:
        tpl = COMPLETED_TEMPLATES[cycle_index % len(COMPLETED_TEMPLATES)]
    else:
        tpl = PROGRESS_TEMPLATES[cycle_index % len(PROGRESS_TEMPLATES)]

    prog_text = tpl.format(
        pct_apurado=pct_apurado,
        secoes_apuradas=fmt_br_num(sections.counted_sections),
        secoes_total=fmt_br_num(sections.total_sections),
        cand1_nome=c1.ballot_name,
        cand1_pct=fmt_br_pct(c1.pct_valid),
        cand1_votos=fmt_br_num(c1.votes),
        cand2_nome=c2.ballot_name,
        cand2_pct=fmt_br_pct(c2.pct_valid),
        cand2_votos=fmt_br_num(c2.votes),
        margem_pp=margem_pp,
        diff_votos=diff_votos,
    )
    messages.append(
        NarratorMessage(
            id=f"{dispute_id}-{cycle_index}-progress",
            timestamp=timestamp_hms,
            category="progress",
            text=assert_neutral_text(prog_text, allowed_proper_nouns=proper_nouns),
            is_estimate=False,
        )
    )

    # 2. Se o próprio TSE marcou status oficial de Eleito (e == 's'), exibir com atribuição obrigatória
    for cand in (c1, c2):
        if cand.tse_elected_flag:
            official_text = (
                f"Status oficial informado pelo sistema de totalização para {cand.ballot_name} ({cand.number}): "
                f"Eleito (segundo o TSE), com {fmt_br_pct(cand.pct_valid)}% dos votos válidos."
            )
            messages.append(
                NarratorMessage(
                    id=f"{dispute_id}-{cycle_index}-official-{cand.number}",
                    timestamp=timestamp_hms,
                    category="official_status",
                    text=assert_neutral_text(
                        official_text,
                        allow_tse_elected=True,
                        allowed_proper_nouns=proper_nouns,
                    ),
                    is_estimate=False,
                )
            )

    # 3. Evolução recente da margem (comparando com ponto anterior na linha do tempo)
    if len(timeline) >= 2:
        prev_pt = timeline[-2]
        curr_pt = timeline[-1]
        prev_abs_margin = abs(prev_pt.margin_cand1_minus_cand2_pp)
        curr_abs_margin = abs(curr_pt.margin_cand1_minus_cand2_pp)
        delta_abs = round(abs(curr_abs_margin - prev_abs_margin), 2)
        if delta_abs >= 0.01:
            direcao = "aumentou" if curr_abs_margin > prev_abs_margin else "diminuiu"
            m_tpl = MARGIN_CHANGE_TEMPLATES[cycle_index % len(MARGIN_CHANGE_TEMPLATES)]
            m_text = m_tpl.format(
                direcao=direcao,
                delta_pp=fmt_br_pct(delta_abs),
                prev_pp=fmt_br_pct(prev_abs_margin),
                curr_pp=fmt_br_pct(curr_abs_margin),
                prev_hms=prev_pt.timestamp,
            )
            messages.append(
                NarratorMessage(
                    id=f"{dispute_id}-{cycle_index}-margin",
                    timestamp=timestamp_hms,
                    category="margin_change",
                    text=assert_neutral_text(m_text, allowed_proper_nouns=proper_nouns),
                    is_estimate=False,
                )
            )

    # 4. Onde ainda falta contar (maiores volumes pendentes)
    if sections.pct_counted < 100.0:
        pending_locs = sorted(
            [loc for loc in localities if loc.estimated_remaining_valid_votes > 0],
            key=lambda x: x.estimated_remaining_valid_votes,
            reverse=True,
        )
        if len(pending_locs) >= 3:
            p_tpl = PENDING_TEMPLATES[cycle_index % len(PENDING_TEMPLATES)]
            p_text = p_tpl.format(
                pct_restante=pct_restante,
                loc1=f"{pending_locs[0].name} ({fmt_br_num(pending_locs[0].estimated_remaining_valid_votes)} votos est.)",
                loc2=f"{pending_locs[1].name} ({fmt_br_num(pending_locs[1].estimated_remaining_valid_votes)} votos est.)",
                loc3=f"{pending_locs[2].name} ({fmt_br_num(pending_locs[2].estimated_remaining_valid_votes)} votos est.)",
            )
            messages.append(
                NarratorMessage(
                    id=f"{dispute_id}-{cycle_index}-pending",
                    timestamp=timestamp_hms,
                    category="pending_hotspots",
                    text=assert_neutral_text(p_text, allowed_proper_nouns=proper_nouns),
                    is_estimate=True,
                )
            )
        elif len(pending_locs) > 0:
            names = ", ".join(
                f"{loc.name} ({fmt_br_num(loc.estimated_remaining_valid_votes)} votos est.)"
                for loc in pending_locs
            )
            p_text = (
                f"Ainda faltam {pct_restante}% das urnas; os votos restantes estimados concentram-se em "
                f"{names}."
            )
            messages.append(
                NarratorMessage(
                    id=f"{dispute_id}-{cycle_index}-pending",
                    timestamp=timestamp_hms,
                    category="pending_hotspots",
                    text=assert_neutral_text(p_text, allowed_proper_nouns=proper_nouns),
                    is_estimate=True,
                )
            )

    # 5. Frase da Calculadora da Virada (com rótulo explícito de estimativa)
    if sections.pct_counted < 100.0 and turnaround.estimated_remaining_valid_votes_r > 0:
        calc_text = f"{turnaround.neutral_message} ({turnaround.disclaimer})"
        messages.append(
            NarratorMessage(
                id=f"{dispute_id}-{cycle_index}-turnaround",
                timestamp=timestamp_hms,
                category="turnaround_math",
                text=assert_neutral_text(calc_text, allowed_proper_nouns=proper_nouns),
                is_estimate=True,
            )
        )

    return messages
