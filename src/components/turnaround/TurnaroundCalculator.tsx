import { useMemo, useState } from 'react'
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  RotateCcw,
} from 'lucide-react'
import type { DisputeSnapshot } from '../../types/election'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import {
  formatCompactNumber,
  formatInt,
  formatNumberComma,
} from '../../utils/formatters'
import { recalculateTurnaroundClient } from '../../utils/turnaroundMath'
import { HowWeCalculateModal } from './HowWeCalculateModal'

interface TurnaroundCalculatorProps {
  snapshot: DisputeSnapshot
}

export function TurnaroundCalculator({ snapshot }: TurnaroundCalculatorProps) {
  const [turnoutAdjustmentPct, setTurnoutAdjustmentPct] = useState<number>(0)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [isSimulateOpen, setIsSimulateOpen] = useState<boolean>(false)
  const [cand1, cand2] = snapshot.candidates
  const [theme1, theme2] = getDisputePairThemes(cand1, cand2)

  const turnaround = useMemo(
    () => recalculateTurnaroundClient(snapshot, turnoutAdjustmentPct),
    [snapshot, turnoutAdjustmentPct],
  )

  const sVal = turnaround.needed_share_pct_s
  const isTrailingSlot1 =
    turnaround.trailing_candidate_seq === snapshot.candidates[0].seq
  const isTrailingSlot2 =
    turnaround.trailing_candidate_seq === snapshot.candidates[1].seq

  const accentBadgeClass = isTrailingSlot1
    ? theme1.badgeClass
    : isTrailingSlot2
      ? theme2.badgeClass
      : 'bg-slate-700 text-white dark:bg-slate-600'

  const trailingTheme = isTrailingSlot2 ? theme2 : theme1
  const leaderTheme = isTrailingSlot2 ? theme1 : theme2

  // Zona de probabilidade matemática e dificuldade intuitiva
  const zoneInfo = useMemo(() => {
    if (sVal === null) {
      return {
        label: 'Definido pelo TSE',
        badge: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
        textColor: 'text-slate-400',
      }
    }
    if (sVal < 50) {
      return {
        label: 'Fácil (<50%)',
        badge: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        textColor: 'text-emerald-600 dark:text-emerald-400',
      }
    }
    if (sVal <= 60) {
      return {
        label: 'Disputado (50% a 60%)',
        badge: 'border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        textColor: 'text-amber-600 dark:text-amber-400',
      }
    }
    return {
      label: 'Difícil (>60%)',
      badge: 'border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
      textColor: 'text-rose-600 dark:text-rose-400',
    }
  }, [sVal])

  return (
    <section
      aria-label="Calculadora da virada"
      data-testid="turnaround-calculator"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1F1F24] dark:bg-[#0A0A0C]"
    >
      {/* 1. Cabeçalho: Título + Tooltip Informativo + Como Calculamos */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
            <Calculator className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span
              className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
              title="Indicador da Calculadora da Virada"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          <h2 className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">
            Calculadora da Virada
          </h2>

          {/* Ícone ⓘ com Tooltip dinâmico */}
          <div className="group relative inline-flex items-center">
            <button
              type="button"
              className="rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300"
              aria-label="Informações sobre o cálculo da virada"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-72 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">
              <p className="font-medium text-white">
                Fórmula de Necessidade Matemática (s)
              </p>
              <p className="mt-1 text-slate-300">
                Calcula a porcentagem exata dos votos válidos restantes estimados que o candidato em desvantagem precisa obter para ultrapassar 50% dos votos válidos.
              </p>
              <div
                data-testid="turnaround-estimate-disclaimer"
                className="mt-2 rounded border border-amber-500/30 bg-amber-950/60 px-2 py-1 text-[11px] font-semibold text-amber-300"
              >
                {turnaround.disclaimer}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          data-testid="open-how-we-calculate-btn"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#1F1F24] dark:bg-[#0F0F12] dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Como calculamos
        </button>
      </div>

      {/* 2. Destaque Principal com Linguagem Clara e Frase Direta */}
      <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cenário para a virada
          </span>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider shrink-0 ${zoneInfo.badge}`}>
            {zoneInfo.label}
          </span>
        </div>

        <div>
          {turnaround.trailing_candidate_name ? (
            <div className="text-sm font-medium text-slate-700 sm:text-base dark:text-slate-200">
              <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                <span>Para virar,</span>
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-black shadow-xs shrink-0 ${accentBadgeClass}`}>
                  {turnaround.trailing_candidate_name}
                </span>
                <span>precisa conquistar</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                <strong
                  data-testid="turnaround-needed-pct"
                  className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white"
                >
                  {sVal === null
                    ? '—'
                    : sVal > 100
                      ? `> 100% (${formatNumberComma(sVal)}%)`
                      : sVal <= 0
                        ? '≤ 0%'
                        : `${formatNumberComma(sVal)}%`}
                </strong>
                <span className="text-sm font-medium text-slate-600 sm:text-base dark:text-slate-300">
                  dos votos que ainda faltam.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm font-medium text-slate-700 sm:text-base dark:text-slate-200">
              <span data-testid="turnaround-needed-pct" className="font-mono text-xl font-black text-slate-900 dark:text-white">
                {sVal === null ? '—' : `${formatNumberComma(sVal)}%`}
              </span>{' '}
              {turnaround.leading_candidate_name ? (
                <>
                  Vantagem consolidada de <strong>{turnaround.leading_candidate_name}</strong> ({formatInt(turnaround.vote_difference)} votos à frente).
                </>
              ) : (
                'Apuração concluída ou aguardando dados oficiais.'
              )}
            </div>
          )}
        </div>

        <p data-testid="turnaround-neutral-message" className="sr-only">
          {turnaround.neutral_message}
        </p>

        {/* 3. Barra Visual Simples: Régua Limpa de Dificuldade */}
        <div className="mt-4">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            {/* Zonas Coloridas */}
            <div className="absolute inset-0 flex">
              {/* Fácil: 0% a 50% */}
              <div
                className="h-full bg-emerald-500/35 dark:bg-emerald-500/25"
                style={{ width: '50%' }}
                title="Fácil: precisa de menos de 50% dos votos restantes"
              />
              {/* Disputado: 50% a 60% */}
              <div
                className="h-full bg-amber-500/45 dark:bg-amber-500/35"
                style={{ width: '10%' }}
                title="Disputado: precisa entre 50% e 60% dos votos restantes"
              />
              {/* Difícil: 60% a 100% */}
              <div
                className="h-full bg-rose-500/35 dark:bg-rose-500/25"
                style={{ width: '40%' }}
                title="Difícil: precisa de mais de 60% dos votos restantes"
              />
            </div>

            {/* Linha divisória de 50% */}
            <div
              className="absolute inset-y-0 left-1/2 z-10 w-0.5 bg-slate-900 dark:bg-white"
              title="Equilíbrio (50%)"
            />
            {/* Linha divisória de 60% */}
            <div
              className="absolute inset-y-0 left-[60%] z-10 w-0.5 bg-slate-500/60 dark:bg-slate-400/60"
              title="Limite Disputado (60%)"
            />

            {/* Ponteiro indicador da porcentagem necessária */}
            {sVal !== null && (
              <div
                className="absolute inset-y-0 z-20 flex -translate-x-1/2 items-center transition-all duration-500"
                style={{
                  left: `${Math.min(99, Math.max(1, sVal))}%`,
                }}
              >
                <div className="h-4 w-2.5 rounded-full border border-white bg-slate-950 shadow-md ring-2 ring-emerald-400 dark:border-slate-950 dark:bg-white dark:ring-emerald-400" />
              </div>
            )}
          </div>

          {/* Rótulos Intuitivos das 3 Zonas */}
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">
              Fácil (&lt;50%)
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              Disputado (50% a 60%)
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              Difícil (&gt;60%)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Três Cartões com Destaques Visuais Distintos (Líder, Válidos Restantes, Meta da Virada) */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {/* 1. Diferença atual (Destaque na cor do Líder) */}
        <div className={`rounded-xl border p-3 shadow-xs transition overflow-hidden ${leaderTheme.borderClass} ${leaderTheme.cardBgClass}`}>
          <span className={`block text-xs font-medium ${leaderTheme.textAccentClass}`}>
            Diferença atual
          </span>
          <div className="mt-1">
            <strong
              data-testid="turnaround-var-v"
              className={`block text-xl font-bold leading-tight ${leaderTheme.textAccentClass}`}
            >
              {formatCompactNumber(turnaround.vote_difference)}
            </strong>
            <span className="block text-[11px] opacity-75 truncate font-mono">
              {formatInt(turnaround.vote_difference)} votos
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug opacity-85">
            {turnaround.leading_candidate_name ?? 'Líder'} à frente por{' '}
            <strong className="font-bold">
              {formatNumberComma(turnaround.margin_pp)} p.p.
            </strong>
          </p>
        </div>

        {/* 2. Votos válidos restantes (Destaque em Âmbar/Dourado) */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3 shadow-xs transition overflow-hidden dark:border-amber-500/25 dark:bg-amber-500/[0.05]">
          <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">
            Votos válidos restantes
          </span>
          <div className="mt-1">
            <strong
              data-testid="turnaround-var-r"
              className="block text-xl font-bold leading-tight text-amber-700 dark:text-amber-300"
            >
              {formatCompactNumber(turnaround.estimated_remaining_valid_votes_r)}
            </strong>
            <span className="block text-[11px] opacity-75 truncate font-mono text-amber-700 dark:text-amber-400">
              {formatInt(turnaround.estimated_remaining_valid_votes_r)} est.
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-amber-700/80 dark:text-amber-400/80">
            Estimativa de urnas pendentes
          </p>
        </div>

        {/* 3. Meta para a virada (Destaque na cor do Candidato que busca a virada) */}
        <div className={`rounded-xl border p-3 shadow-xs transition overflow-hidden ${trailingTheme.borderClass} ${trailingTheme.cardBgClass}`}>
          <span className={`block text-xs font-medium ${trailingTheme.textAccentClass}`}>
            Meta para a virada
          </span>
          <div className="mt-1">
            <strong
              data-testid="turnaround-var-a"
              className={`block text-xl font-bold leading-tight ${trailingTheme.textAccentClass}`}
            >
              {sVal !== null && sVal > 100
                ? 'Irreversível'
                : formatCompactNumber(turnaround.needed_votes_absolute)}
            </strong>
            <span className="block text-[11px] opacity-75 truncate font-mono">
              {sVal !== null && sVal > 100
                ? '> 100% dos restantes'
                : `${formatInt(turnaround.needed_votes_absolute)} votos`}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug opacity-85">
            {turnaround.trailing_candidate_name ?? '2º colocado'} precisa somar
          </p>
        </div>
      </div>

      {/* 5. Painel Expansível Discreto: Simulação de Abstenção / Comparecimento */}
      <div className="mt-3 border-t border-slate-200/80 pt-2.5 dark:border-[#1F1F24]">
        <button
          type="button"
          data-testid="toggle-simulate-turnout-btn"
          onClick={() => setIsSimulateOpen(!isSimulateOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#1F1F24] dark:bg-[#0F0F12] dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span>⚙️ Simular abstenção / comparecimento</span>
          {turnoutAdjustmentPct !== 0 && (
            <span className="rounded bg-slate-200 px-1.5 py-0.2 font-mono text-[10px] font-bold text-slate-900 dark:bg-slate-700 dark:text-white">
              {turnoutAdjustmentPct > 0 ? `+${turnoutAdjustmentPct}%` : `${turnoutAdjustmentPct}%`}
            </span>
          )}
          {isSimulateOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>

        {isSimulateOpen && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="turnout-adjustment-slider"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Ajuste de comparecimento vs 1ºT:{' '}
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900 dark:bg-slate-800 dark:text-white">
                  {turnoutAdjustmentPct > 0
                    ? `+${turnoutAdjustmentPct}%`
                    : `${turnoutAdjustmentPct}%`}
                </span>
              </label>

              {turnoutAdjustmentPct !== 0 && (
                <button
                  type="button"
                  onClick={() => setTurnoutAdjustmentPct(0)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Restaurar padrão
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2.5">
              <span className="text-[10px] font-medium text-slate-500">-20%</span>
              <input
                id="turnout-adjustment-slider"
                data-testid="turnout-adjustment-slider"
                type="range"
                min={-20}
                max={10}
                step={1}
                value={turnoutAdjustmentPct}
                onChange={(e) => setTurnoutAdjustmentPct(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-300 accent-slate-900 dark:bg-slate-700 dark:accent-white"
                aria-label="Ajustar comparecimento esperado em relação ao 1º turno"
              />
              <span className="text-[10px] font-medium text-slate-500">+10%</span>
            </div>

            <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              Comparecimento esperado:{' '}
              <strong>{formatCompactNumber(turnaround.expected_turnout_total)}</strong> ({formatInt(turnaround.expected_turnout_total)}) votos
              (1ºT: <strong>{formatCompactNumber(snapshot.electorate.turnout_1t)}</strong>).
            </p>
          </div>
        )}
      </div>

      <HowWeCalculateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        turnaround={turnaround}
      />
    </section>
  )
}
