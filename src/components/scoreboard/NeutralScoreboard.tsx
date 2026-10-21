import {
  ArrowLeftRight,
  CheckCircle2,
  Info,
  Users,
  Vote,
} from 'lucide-react'
import type { DisputeSnapshot } from '../../types/election'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import {
  formatCompactNumber,
  formatInt,
  formatPct,
  formatPP,
  formatSignedPP,
} from '../../utils/formatters'
import { CountingSpeedometer } from './CountingSpeedometer'

interface NeutralScoreboardProps {
  snapshot: DisputeSnapshot
}

export function NeutralScoreboard({ snapshot }: NeutralScoreboardProps) {
  const [cand1, cand2] = snapshot.candidates
  const [theme1, theme2] = getDisputePairThemes(cand1, cand2)
  const themes = [theme1, theme2]
  const { sections, electorate, votes } = snapshot
  const voteDiff = Math.abs(cand1.votes - cand2.votes)
  const marginPP = Math.abs(cand1.pct_valid - cand2.pct_valid)

  const totalPct = cand1.pct_valid + cand2.pct_valid
  const bar1Width = totalPct > 0 ? cand1.pct_valid : 50
  const bar2Width = totalPct > 0 ? cand2.pct_valid : 50

  return (
    <section
      aria-label={`Placar oficial de votos apurados para ${snapshot.cargo_name} (${snapshot.uf_name})`}
      data-testid="neutral-scoreboard"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-[#1F1F24] dark:bg-[#0A0A0C]"
    >
      {/* Cabeçalho da Disputa + Velocímetro de Ritmo de Apuração + Progresso de Seções */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-[#0F0F12] dark:border dark:border-[#1F1F24] dark:text-slate-300">
              2º Turno • {snapshot.cargo_name}
            </span>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
              {snapshot.cargo_code === '1'
                ? 'Presidente da República — Brasil'
                : `Governador — ${snapshot.uf_name} (${snapshot.uf})`}
            </h2>
            <div
              className="group relative inline-flex cursor-help"
              tabIndex={0}
              aria-label="Informações sobre o placar oficial"
            >
              <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200" />
              <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-100 shadow-lg group-hover:block group-focus:block dark:border-[#1F1F24] dark:bg-[#0F0F12]">
                Ordem oficial do TSE (seq) • Dados oficiais em tempo real
              </div>
            </div>
          </div>
        </div>

        {/* Velocímetro de Ritmo de Apuração + Percentual Geral */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Widget do Velocímetro de Ritmo de Apuração */}
          <CountingSpeedometer snapshot={snapshot} />

          {/* Progresso Geral de Urnas */}
          <div className="flex flex-col items-end pl-1">
            <div className="flex items-baseline gap-1">
              <span
                data-testid="scoreboard-pct-counted"
                className="font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white"
              >
                {formatPct(sections.pct_counted)}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                apurado
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {formatInt(sections.counted_sections)} de {formatInt(sections.total_sections)} seções
            </span>
          </div>
        </div>
      </div>

      {/* Barra de progresso geral das urnas */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#1F1F24]"
        role="progressbar"
        aria-valuenow={sections.pct_counted}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Percentual de seções totalizadas"
      >
        <div
          className="h-full rounded-full bg-slate-700 transition-all duration-500 dark:bg-slate-300"
          style={{
            width: `${Math.min(100, Math.max(0, sections.pct_counted))}%`,
          }}
        />
      </div>

      {/* Termômetro Frente a Frente: Cabo de Guerra Encorpado com Pino Central dos 50% */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
          <span className={`flex items-center gap-1.5 ${theme1.textAccentClass}`}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${theme1.dotClass}`} />
            {cand1.ballot_name} ({cand1.party_acronym}) • {formatPct(cand1.pct_valid)}
          </span>
          <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Marca de 50%
          </span>
          <span className={`flex items-center gap-1.5 ${theme2.textAccentClass}`}>
            {formatPct(cand2.pct_valid)} • {cand2.ballot_name} ({cand2.party_acronym})
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${theme2.dotClass}`} />
          </span>
        </div>
        <div className="relative flex h-5 sm:h-6 w-full overflow-hidden rounded-full bg-slate-200 shadow-inner dark:bg-[#1F1F24]">
          <div
            className={`h-full transition-all duration-500 ${theme1.barClass}`}
            style={{ width: `${bar1Width}%` }}
          />
          <div
            className={`h-full transition-all duration-500 ${theme2.barClass}`}
            style={{ width: `${bar2Width}%` }}
          />
          {/* Pino Central Destacado nos 50% */}
          <div
            className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)] z-10 dark:bg-white"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-900 border border-white px-2 py-0.5 text-[10px] font-black text-white shadow-md dark:bg-black dark:border-white">
            50%
          </div>
        </div>
      </div>

      {/* Cartões de Perfil dos Candidatos na ordem oficial do TSE */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[cand1, cand2].map((cand, idx) => {
          const theme = themes[idx]
          const primaryPhotoSrc = `/avatars/${cand.sqcand}.jpg`
          const fallbackSvgSrc = `/avatars/${cand.sqcand}.svg`
          const avatarSrc =
            cand.photo_url && cand.photo_url.startsWith('/avatars/')
              ? cand.photo_url
              : primaryPhotoSrc
          const tseOfficialPhotoUrl =
            cand.tse_photo_url ??
            `https://resultados.tse.jus.br/oficial/${snapshot.cycle}/${snapshot.election_code_2t}/fotos/${snapshot.uf.toLowerCase()}/f${snapshot.election_code_2t}${cand.sqcand}_div.jpg`

          return (
            <article
              key={cand.number}
              data-testid={`candidate-card-${cand.seq}`}
              data-theme-color={theme.key}
              className={`flex flex-col justify-between rounded-xl border-2 p-3.5 transition sm:p-4 ${theme.borderClass} ${theme.cardBgClass}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Foto oficial 64x64px com anel de realce na cor do candidato */}
                    <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
                      <img
                        src={avatarSrc}
                        data-tse-photo-url={tseOfficialPhotoUrl}
                        alt={`Foto oficial de ${cand.ballot_name} (${cand.party_acronym} - ${cand.number})`}
                        title={`Foto oficial TSE (${cand.tse_photo_filename ?? `f${snapshot.election_code_2t}${cand.sqcand}_div.jpg`})`}
                        data-testid={`candidate-photo-${cand.seq}`}
                        loading="eager"
                        decoding="async"
                        onError={(e) => {
                          const target = e.currentTarget
                          if (!target.src.endsWith(fallbackSvgSrc)) {
                            target.src = fallbackSvgSrc
                          }
                        }}
                        className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-slate-200 object-cover object-top shadow-md ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#0A0A0C] dark:bg-slate-800 ${theme.avatarRingClass}`}
                      />
                      <span
                        className={`-bottom-1 -right-1 absolute inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-black shadow-xs ${theme.badgeClass}`}
                        title={`Número de urna ${cand.number}`}
                      >
                        {cand.number}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-base font-black leading-tight text-slate-900 sm:text-lg dark:text-white">
                          {cand.ballot_name}
                        </h3>
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${theme.softPillClass}`}
                        >
                          {cand.party_acronym} • {cand.number}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {cand.vice_name
                          ? `Vice: ${cand.vice_name} (${cand.vice_party})`
                          : cand.party_name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      data-testid={`candidate-pct-${cand.seq}`}
                      className={`font-mono text-2xl font-black tracking-tight sm:text-3xl ${theme.textAccentClass}`}
                    >
                      {formatPct(cand.pct_valid)}
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatInt(cand.votes)} votos
                    </div>
                  </div>
                </div>

                {/* Status Oficial do TSE: só exibe se e == 's' no próprio arquivo do TSE */}
                {cand.tse_elected_flag && cand.tse_official_attribution && (
                  <div
                    data-testid={`tse-official-elected-badge-${cand.seq}`}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/70 dark:text-emerald-200"
                  >
                    <span>{cand.tse_official_attribution}</span>
                  </div>
                )}

                {/* Barra principal de proporção de votos válidos com a cor do candidato/partido */}
                <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-[#1F1F24]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${theme.barClass}`}
                    style={{
                      width: `${Math.min(100, Math.max(0, cand.pct_valid))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Comparativo com o 1º turno do mesmo cargo */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 text-xs text-slate-600 dark:border-[#1F1F24] dark:text-slate-400">
                <span>
                  1º turno: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatPct(cand.pct_valid_1t)}</strong> (~{formatCompactNumber(cand.votes_1t)})
                </span>
                {cand.swing_pp !== null && (
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    Variação: {formatSignedPP(cand.swing_pp)}
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* KPIs no Rodapé do Placar: Cápsulas Visuais Compactas com Ícones */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Diferença */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100/80 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Diferença
            </span>
            <strong className="font-mono text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
              {formatCompactNumber(voteDiff)}
            </strong>
            <span className="ml-1 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              ({formatPP(marginPP)})
            </span>
          </div>
        </div>

        {/* Votos Válidos */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Votos Válidos
            </span>
            <strong className="font-mono text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
              {formatCompactNumber(votes.valid_votes)}
            </strong>
            <span className="ml-1 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              ({formatPct(votes.pct_valid_votes, 1)})
            </span>
          </div>
        </div>

        {/* Comparecimento */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Users className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Comparecimento
            </span>
            <strong className="font-mono text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
              {formatPct(electorate.pct_turnout, 1)}
            </strong>
            <span className="ml-1 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              (~{formatCompactNumber(electorate.turnout_votes)})
            </span>
          </div>
        </div>

        {/* Urnas Apuradas */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Vote className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Urnas
            </span>
            <strong className="font-mono text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
              {formatCompactNumber(sections.counted_sections)}
            </strong>
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {' '}/ {formatCompactNumber(sections.total_sections)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
