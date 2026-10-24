import { Globe, Info } from 'lucide-react'
import type { DisputeSnapshot } from '../../types/election'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import {
  formatCompactNumber,
  formatPct,
  formatPP,
} from '../../utils/formatters'

interface RegionBreakdownCardProps {
  snapshot: DisputeSnapshot
}

interface RegionDef {
  id: string
  name: string
  ufs: string[]
}

const REGIONS: RegionDef[] = [
  { id: 'norte', name: 'Norte', ufs: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'] },
  { id: 'nordeste', name: 'Nordeste', ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  { id: 'centro-oeste', name: 'Centro-Oeste', ufs: ['DF', 'GO', 'MT', 'MS'] },
  { id: 'sudeste', name: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
  { id: 'sul', name: 'Sul', ufs: ['PR', 'RS', 'SC'] },
]

function getShortCandidateName(ballotName: string): string {
  const norm = ballotName.trim().toUpperCase()
  if (norm.includes('LULA')) return 'Lula'
  if (norm.includes('FLAVIO') || norm.includes('FLÁVIO') || norm.includes('BOLSONARO')) {
    return 'Flávio'
  }
  const clean = ballotName.replace(
    /^(PROFESSOR[A]?|DEPUTAD[OA]|CORONEL|PASTOR[A]?|CAPIT[AÃ]O)\s+/i,
    '',
  )
  const parts = clean.trim().split(/\s+/)
  return parts[0] || ballotName
}

export function RegionBreakdownCard({ snapshot }: RegionBreakdownCardProps) {
  // Apenas relevante para a disputa presidencial (cargo_code === '1')
  if (snapshot.cargo_code !== '1') {
    return null
  }

  const [cand1, cand2] = snapshot.candidates
  const [theme1, theme2] = getDisputePairThemes(cand1, cand2)
  const cand1Short = getShortCandidateName(cand1.ballot_name)
  const cand2Short = getShortCandidateName(cand2.ballot_name)

  // Mapear localidades por UF (ignorando 'BR' ou 'ZZ' que é exterior)
  const ufMap = new Map<string, (typeof snapshot.localities)[number]>()
  for (const loc of snapshot.localities) {
    if (loc.scope_type === 'uf') {
      ufMap.set(loc.uf.toUpperCase(), loc)
    }
  }

  const regionData = REGIONS.map((region) => {
    let totalSections = 0
    let countedSections = 0
    let cand1Votes = 0
    let cand2Votes = 0
    let remainingVotes = 0

    for (const uf of region.ufs) {
      const loc = ufMap.get(uf)
      if (loc) {
        totalSections += loc.total_sections
        countedSections += loc.counted_sections
        cand1Votes += loc.cand1_votes_2t
        cand2Votes += loc.cand2_votes_2t
        remainingVotes += loc.estimated_remaining_valid_votes ?? 0
      }
    }

    const pctCounted =
      totalSections > 0 ? (countedSections / totalSections) * 100 : 0
    const totalVotes = cand1Votes + cand2Votes
    const cand1Pct = totalVotes > 0 ? (cand1Votes / totalVotes) * 100 : 50
    const cand2Pct = totalVotes > 0 ? (cand2Votes / totalVotes) * 100 : 50
    const diffPP = Math.abs(cand1Pct - cand2Pct)
    const leader = cand1Pct >= cand2Pct ? cand1 : cand2
    const leaderTheme = cand1Pct >= cand2Pct ? theme1 : theme2
    const leaderShort = cand1Pct >= cand2Pct ? cand1Short : cand2Short

    return {
      id: region.id,
      name: region.name,
      pctCounted,
      cand1Pct,
      cand2Pct,
      diffPP,
      remainingVotes,
      hasVotes: totalVotes > 0,
      leader,
      leaderTheme,
      leaderShort,
    }
  })

  // Identificar destaques neutros
  const regionsWithVotes = regionData.filter((r) => r.hasVotes)
  let tightestRegionId: string | null = null
  let mostPendingRegionId: string | null = null

  if (regionsWithVotes.length > 0) {
    const sortedByDiff = [...regionsWithVotes].sort(
      (a, b) => a.diffPP - b.diffPP,
    )
    tightestRegionId = sortedByDiff[0]?.id ?? null

    const sortedByPending = [...regionsWithVotes].sort(
      (a, b) => a.pctCounted - b.pctCounted,
    )
    mostPendingRegionId = sortedByPending[0]?.id ?? null
  }

  return (
    <section
      aria-label="Votação e apuração por macrorregião"
      data-testid="region-breakdown-card"
      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs sm:p-4 dark:border-[#1F1F24] dark:bg-[#0A0A0C]"
    >
      {/* 1. Cabeçalho com Tile Colorido (Ciano) e Ponto Verde de Status */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-[#1F1F24]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm">
            <Globe className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span
              className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
              title="Indicador de dados ao vivo"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          <h2 className="text-base font-bold text-slate-900 sm:text-lg dark:text-white truncate">
            Por Região
          </h2>

          <div className="group relative inline-flex items-center">
            <button
              type="button"
              className="rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300"
              aria-label="Informações sobre a divisão por macrorregiões"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-72 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">
              <p className="font-medium text-white">Macrorregiões do Brasil</p>
              <p className="mt-1 text-slate-300">
                Soma agregada de votos válidos e seções apuradas dos estados em cada uma das 5 macrorregiões geográficas oficiais do IBGE/TSE.
              </p>
            </div>
          </div>
        </div>

        {/* Legenda dos candidatos com peso visual simétrico */}
        <div className="flex items-center gap-2.5 text-xs font-bold shrink-0">
          <span className={`inline-flex items-center gap-1.5 ${theme1.textAccentClass}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${theme1.dotClass}`} />
            {cand1Short.toUpperCase()}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className={`inline-flex items-center gap-1.5 ${theme2.textAccentClass}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${theme2.dotClass}`} />
            {cand2Short.toUpperCase()}
          </span>
        </div>
      </div>

      {/* 2. Lista Redesenhada das 5 Regiões */}
      <div className="mt-3.5 space-y-4">
        {regionData.map((reg) => {
          const isTightest = reg.id === tightestRegionId
          const isMostPending = reg.id === mostPendingRegionId && !isTightest

          return (
            <div
              key={reg.id}
              className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-white/[0.04] dark:bg-white/[0.02]"
            >
              {/* LINHA 1: Nome da Região (15-16px, bold) + Destaque neutro à esquerda e Selo de Líder à direita */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[15px] sm:text-[16px] font-bold text-slate-900 dark:text-white leading-tight">
                    {reg.name}
                  </span>

                  {isTightest && (
                    <span className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                      Mais apertada
                    </span>
                  )}

                  {isMostPending && (
                    <span className="inline-flex items-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 shrink-0">
                      Mais urnas por apurar
                    </span>
                  )}
                </div>

                {/* Selo neutro de liderança na cor do candidato à frente */}
                {reg.hasVotes ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-bold border shrink-0 ${reg.leaderTheme.badgeClass} ${reg.leaderTheme.borderClass}`}
                  >
                    <span>{reg.leaderShort}</span>
                    <span>+{formatPP(reg.diffPP)}</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    Aguardando votos
                  </span>
                )}
              </div>

              {/* LINHA 2: Percentuais GRANDES nas pontas (18-20px, tabular-nums) + Barra de 12-14px com marca de 50% */}
              <div className="flex items-center justify-between gap-2">
                {/* % Candidato 1 Grande */}
                <span
                  className={`text-[18px] sm:text-[20px] font-bold tabular-nums leading-none shrink-0 ${theme1.textAccentClass}`}
                >
                  {reg.hasVotes ? formatPct(reg.cand1Pct) : '—'}
                </span>

                {/* Barra Proporcional de Duelo (12 a 14px de altura) */}
                <div className="relative flex flex-1 h-3 sm:h-3.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 mx-1.5">
                  {reg.hasVotes ? (
                    <>
                      <div
                        style={{
                          width: `${reg.cand1Pct}%`,
                          backgroundColor: theme1.hexLight,
                        }}
                        className="h-full transition-all duration-300"
                      />
                      <div
                        style={{
                          width: `${reg.cand2Pct}%`,
                          backgroundColor: theme2.hexLight,
                        }}
                        className="h-full transition-all duration-300"
                      />
                    </>
                  ) : (
                    <div className="h-full w-full bg-slate-300/40 dark:bg-slate-700/40" />
                  )}

                  {/* Marcador dos 50% */}
                  <div
                    className="pointer-events-none absolute left-1/2 inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-xs z-10"
                    title="Marca de 50%"
                  />
                </div>

                {/* % Candidato 2 Grande */}
                <span
                  className={`text-[18px] sm:text-[20px] font-bold tabular-nums leading-none shrink-0 text-right ${theme2.textAccentClass}`}
                >
                  {reg.hasVotes ? formatPct(reg.cand2Pct) : '—'}
                </span>
              </div>

              {/* LINHA 3: Apurado % com mini barra de 4px + Votos restantes estimados */}
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">
                    Apurado:{' '}
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">
                      {formatPct(reg.pctCounted)}
                    </strong>
                  </span>
                  <div className="h-1 w-12 sm:w-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 inline-flex">
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, reg.pctCounted))}%` }}
                      className="h-full bg-emerald-500 transition-all duration-300"
                    />
                  </div>
                </div>

                {reg.remainingVotes > 0 && (
                  <span className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300">
                    Faltam ~{formatCompactNumber(reg.remainingVotes)} votos est.
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
