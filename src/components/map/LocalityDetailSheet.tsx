import {
  AlertTriangle,
  Sparkles,
  X,
  ZoomIn,
} from 'lucide-react'
import type { CandidateResult, LocalityDataItem } from '../../types/election'
import { StateFlag } from '../common/StateFlag'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import {
  formatInt,
  formatOfficialCandidateName,
  formatPct,
  formatSignedPP,
} from '../../utils/formatters'

interface LocalityDetailSheetProps {
  locality: LocalityDataItem | null
  candidates: [CandidateResult, CandidateResult]
  canZoomToMunicipalities: boolean
  onZoomToUf?: (uf: string) => void
  onClose?: () => void
}

export function LocalityDetailSheet({
  locality,
  candidates,
  canZoomToMunicipalities,
  onZoomToUf,
  onClose,
}: LocalityDetailSheetProps) {
  const [cand1, cand2] = candidates
  const [c1Theme, c2Theme] = getDisputePairThemes(cand1, cand2)

  const isCadu1 =
    cand1.sqcand === '200002534001' ||
    cand1.ballot_name.toUpperCase().includes('CADU')
  const c1Avatar = isCadu1
    ? '/avatars/cadu-xavier-real.jpg?v=3'
    : cand1.photo_url || `/avatars/${cand1.sqcand}.jpg?v=3`

  const isCadu2 =
    cand2.sqcand === '200002534001' ||
    cand2.ballot_name.toUpperCase().includes('CADU')
  const c2Avatar = isCadu2
    ? '/avatars/cadu-xavier-real.jpg?v=3'
    : cand2.photo_url || `/avatars/${cand2.sqcand}.jpg?v=3`

  if (!locality) {
    return (
      <div
        data-testid="locality-detail-empty"
        className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center text-xs text-slate-600 dark:border-[#1F1F24] dark:bg-[#0F0F12] dark:text-slate-400"
      >
        Passe o cursor (no computador) ou toque (no celular) em qualquer estado
        ou município do mapa para inspecionar o resultado atual, o 1º turno e a
        variação em pontos percentuais.
      </div>
    )
  }

  return (
    <div
      data-testid="locality-detail-sheet"
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 shadow-xs transition-all sm:p-4 dark:border-[#1F1F24] dark:bg-[#0F0F12]"
    >
      {/* Linha superior: Nome do local, % apurado e botões de ação */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 pb-2.5 dark:border-[#1F1F24]">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StateFlag
              uf={locality.uf}
              className="w-6 h-4 rounded-xs object-cover ring-1 ring-black/15 dark:ring-white/15 shadow-2xs"
              alt={`Bandeira de ${locality.uf}`}
            />
            <h3 className="text-sm font-bold text-slate-900 sm:text-base dark:text-white">
              {locality.name}
            </h3>
            <span className="rounded bg-slate-200/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
              {locality.uf}
            </span>
            {locality.is_capital && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
                Capital
              </span>
            )}
            {locality.changed_in_last_cycle && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/70 dark:text-amber-300">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Maior avanço no ciclo (+
                {formatPct(locality.delta_pct_counted_last_cycle)})
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Seções apuradas:{' '}
            <strong className="font-mono text-slate-900 dark:text-white">
              {formatPct(locality.pct_counted)}
            </strong>{' '}
            ({formatInt(locality.counted_sections)} de{' '}
            {formatInt(locality.total_sections)}) · Votos válidos restantes
            estimados:{' '}
            <strong className="font-mono text-slate-800 dark:text-slate-200">
              {formatInt(locality.estimated_remaining_valid_votes)}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canZoomToMunicipalities &&
            locality.scope_type === 'uf' &&
            locality.uf !== 'ZZ' &&
            locality.uf !== 'BR' &&
            onZoomToUf && (
              <button
                type="button"
                data-testid={`zoom-uf-btn-${locality.uf}`}
                onClick={() => onZoomToUf(locality.uf)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                Ver municípios de {locality.uf}
              </button>
            )}
          {onClose && (
            <button
              type="button"
              data-testid="locality-detail-close-btn"
              onClick={onClose}
              aria-label="Fechar painel de detalhes"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Fechar</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta se < 30% apurado */}
      {locality.low_reliability && (
        <div
          data-testid="low-reliability-badge"
          className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-300/80 bg-amber-50/90 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Menos de 30% das urnas apuradas ({formatPct(locality.pct_counted)}):</strong>{' '}
            área exibida com hachura/transparência no mapa por baixa
            confiabilidade estatística da amostra parcial.
          </span>
        </div>
      )}

      {/* Comparação lado a lado dos 2 candidatos na ordem oficial seq */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {/* Candidato 1 */}
        <div className={`rounded-lg border p-2.5 ${c1Theme.borderClass} ${c1Theme.cardBgClass}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img
                src={c1Avatar}
                alt={cand1.ballot_name}
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.src.endsWith('.svg?v=3')) {
                    target.src = `/avatars/${cand1.sqcand}.svg?v=3`
                  }
                }}
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover object-top ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#0A0A0C] shrink-0 ${c1Theme.avatarRingClass}`}
              />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {formatOfficialCandidateName(cand1.ballot_name)} ({cand1.party_acronym} · {cand1.number})
              </span>
            </div>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-xs font-bold ${c1Theme.badgeClass}`}>
              {locality.cand1_swing_pp !== null ? (
                <>
                  {locality.cand1_swing_pp > 0
                    ? '▲ '
                    : locality.cand1_swing_pp < 0
                      ? '▼ '
                      : '• '}
                  {formatSignedPP(locality.cand1_swing_pp)}
                </>
              ) : (
                'Sem 2ºT apurado'
              )}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                2º Turno (Atual)
              </span>
              <strong className={`font-mono text-xs ${c1Theme.textAccentClass}`}>
                {formatPct(locality.cand1_pct_2t)}
              </strong>{' '}
              ({formatInt(locality.cand1_votes_2t)})
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                1º Turno (Oficial)
              </span>
              <strong className="font-mono text-xs text-slate-900 dark:text-slate-100">
                {formatPct(locality.cand1_pct_1t)}
              </strong>{' '}
              ({formatInt(locality.cand1_votes_1t)})
            </div>
          </div>
        </div>

        {/* Candidato 2 */}
        <div className={`rounded-lg border p-2.5 ${c2Theme.borderClass} ${c2Theme.cardBgClass}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img
                src={c2Avatar}
                alt={cand2.ballot_name}
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.src.endsWith('.svg?v=3')) {
                    target.src = `/avatars/${cand2.sqcand}.svg?v=3`
                  }
                }}
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover object-top ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#0A0A0C] shrink-0 ${c2Theme.avatarRingClass}`}
              />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {formatOfficialCandidateName(cand2.ballot_name)} ({cand2.party_acronym} · {cand2.number})
              </span>
            </div>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-xs font-bold ${c2Theme.badgeClass}`}>
              {locality.cand2_swing_pp !== null ? (
                <>
                  {locality.cand2_swing_pp > 0
                    ? '▲ '
                    : locality.cand2_swing_pp < 0
                      ? '▼ '
                      : '• '}
                  {formatSignedPP(locality.cand2_swing_pp)}
                </>
              ) : (
                'Sem 2ºT apurado'
              )}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                2º Turno (Atual)
              </span>
              <strong className={`font-mono text-xs ${c2Theme.textAccentClass}`}>
                {formatPct(locality.cand2_pct_2t)}
              </strong>{' '}
              ({formatInt(locality.cand2_votes_2t)})
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                1º Turno (Oficial)
              </span>
              <strong className="font-mono text-xs text-slate-900 dark:text-slate-100">
                {formatPct(locality.cand2_pct_1t)}
              </strong>{' '}
              ({formatInt(locality.cand2_votes_1t)})
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span>
          Mais votado no 1º turno neste local:{' '}
          <strong className="text-slate-900 dark:text-white">
            {formatOfficialCandidateName(locality.leader_1t_name)}
          </strong>{' '}
          (diferença de {formatPct(locality.margin_1t_pp).replace('%', ' p.p.')})
        </span>
      </div>
    </div>
  )
}
