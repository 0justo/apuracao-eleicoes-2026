import { BadgeCheck, ExternalLink } from 'lucide-react'
import type { DisputeSnapshot } from '../../types/election'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import { formatInt, formatOfficialCandidateName } from '../../utils/formatters'

interface ElectedHeroProps {
  snapshot: DisputeSnapshot
}

/**
 * Destaque do resultado final (versão de arquivo do site).
 * Só aparece quando o próprio arquivo do TSE marca o candidato como eleito (e == "s"),
 * sempre com a atribuição "Eleito (segundo o TSE)". Os demais dados seguem abaixo.
 */
export function ElectedHero({ snapshot }: ElectedHeroProps) {
  const idx = snapshot.candidates.findIndex(
    (c) => c.tse_elected_flag && c.tse_official_attribution,
  )
  if (idx < 0) return null

  const cand = snapshot.candidates[idx]
  const theme = getDisputePairThemes(snapshot.candidates[0], snapshot.candidates[1])[idx]
  // Mesma regra de foto do placar (CADU tem foto própria em melhor resolução)
  const isCadu =
    cand.sqcand === '200002534001' || cand.ballot_name.toUpperCase().includes('CADU')
  const photoSrc = isCadu
    ? '/avatars/cadu-xavier-real.jpg?v=3'
    : cand.photo_url && cand.photo_url.startsWith('/avatars/')
      ? cand.photo_url
      : `/avatars/${cand.sqcand}.jpg`
  const fallbackSvgSrc = `/avatars/${cand.sqcand}.svg`
  const scope =
    snapshot.cargo_code === '1' ? 'Presidente da República' : `Governador — ${snapshot.uf_name}`

  return (
    <section
      aria-label={`Resultado final: ${cand.ballot_name}, ${cand.tse_official_attribution}`}
      data-testid="elected-hero"
      className={`overflow-hidden rounded-2xl border-2 shadow-sm ${theme.borderClass} ${theme.cardBgClass}`}
    >
      <div className="flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:items-center sm:gap-8 sm:p-8 sm:text-left">
        <img
          src={photoSrc}
          alt={`Foto oficial de ${cand.ballot_name} (${cand.party_acronym} - ${cand.number})`}
          loading="eager"
          decoding="async"
          onError={(e) => {
            const target = e.currentTarget
            if (!target.src.endsWith(fallbackSvgSrc)) target.src = fallbackSvgSrc
          }}
          className={`h-56 w-44 shrink-0 rounded-2xl bg-slate-200 object-cover object-top shadow-md ring-4 ring-offset-4 ring-offset-white sm:h-72 sm:w-56 dark:bg-slate-800 dark:ring-offset-[#0A0A0C] ${theme.avatarRingClass}`}
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Resultado final • {scope} • 2º turno 2026
          </p>

          <span
            data-testid="elected-hero-badge"
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-lg font-black uppercase tracking-wide shadow-sm sm:text-2xl ${theme.badgeClass}`}
          >
            <BadgeCheck className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
            {cand.tse_official_attribution}
          </span>

          <h2 className="mt-3 text-3xl font-black leading-tight text-slate-900 sm:text-5xl dark:text-white">
            {formatOfficialCandidateName(cand.ballot_name)}
          </h2>
          <p className="mt-1 text-sm text-slate-600 sm:text-base dark:text-slate-300">
            {cand.party_acronym} • {cand.number}
            {cand.vice_name ? ` • Vice: ${cand.vice_name} (${cand.vice_party})` : ''}
          </p>

          <div className="mt-4 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
            <strong className={`text-4xl font-black tracking-tight sm:text-6xl ${theme.textAccentClass}`}>
              {cand.pct_valid_display}%
            </strong>
            <span className="text-sm font-medium text-slate-600 sm:text-base dark:text-slate-300">
              dos votos válidos • {formatInt(cand.votes)} votos
            </span>
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {snapshot.sections.pct_counted_display}% das seções apuradas • Fonte: TSE •{' '}
            <a
              href={snapshot.source_portal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-200"
            >
              ver na fonte
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
