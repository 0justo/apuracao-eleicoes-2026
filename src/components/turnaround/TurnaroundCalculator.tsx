import { useMemo, useState } from 'react'
import {
  Calculator,
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
  formatPct,
} from '../../utils/formatters'
import { recalculateTurnaroundClient } from '../../utils/turnaroundMath'
import { HowWeCalculateModal } from './HowWeCalculateModal'

interface TurnaroundCalculatorProps {
  snapshot: DisputeSnapshot
}

export function TurnaroundCalculator({ snapshot }: TurnaroundCalculatorProps) {
  const [turnoutAdjustmentPct, setTurnoutAdjustmentPct] = useState<number>(0)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
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

  // Proporções gráficas para as 4 variáveis
  const totalExpected = turnaround.expected_turnout_total || 1
  const vPct = Math.min(100, Math.max(0, (turnaround.valid_votes_counted_v / totalExpected) * 100))
  const aPct = turnaround.valid_votes_counted_v > 0
    ? Math.min(100, Math.max(0, (turnaround.trailing_candidate_votes_a / turnaround.valid_votes_counted_v) * 100))
    : 0
  const rPct = Math.min(100, Math.max(0, (turnaround.estimated_remaining_valid_votes_r / totalExpected) * 100))
  const bnPct = Math.min(100, Math.max(0, turnaround.observed_blank_null_rate * 100))

  // Zona de probabilidade matemática
  const zoneInfo = useMemo(() => {
    if (sVal === null) {
      return {
        label: 'Concluído ou sem dados',
        badge: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
        textColor: 'text-slate-400',
      }
    }
    if (sVal < 50) {
      return {
        label: 'Cenário Favorável (<50%)',
        badge: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        textColor: 'text-emerald-600 dark:text-emerald-400',
      }
    }
    if (sVal <= 60) {
      return {
        label: 'Cenário Disputado (50% a 60%)',
        badge: 'border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        textColor: 'text-amber-600 dark:text-amber-400',
      }
    }
    return {
      label: 'Alta Complexidade (>60%)',
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
      {/* 1. Cabeçalho Limpo: Título + Ícone ⓘ com Tooltip Dinâmico + Botão Como Calculamos */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-base font-bold text-slate-900 sm:text-lg dark:text-white">
            <Calculator
              className="h-5 w-5 text-slate-700 dark:text-slate-300"
              aria-hidden="true"
            />
            Calculadora da Virada
          </span>

          {/* Ícone ⓘ discreto com Tooltip dinâmico */}
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
                Calcula a porcentagem exata dos votos válidos restantes estimados (R)
                que o candidato em desvantagem precisa obter para atingir 50% + 1 voto.
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

      {/* 2. Destaque Visual Direto: [Candidato Atrás] + 51,62% + dos votos restantes para virar */}
      <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {turnaround.trailing_candidate_seq !== null && (
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold shadow-xs ${accentBadgeClass}`}
              >
                {turnaround.trailing_candidate_name}
              </span>
            )}
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              precisa de
            </span>
            <div
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
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              dos votos restantes para virar
            </span>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${zoneInfo.badge}`}
            >
              {zoneInfo.label}
            </span>
          </div>
        </div>

        {turnaround.needed_votes_absolute > 0 &&
          sVal !== null &&
          sVal <= 100 && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Aproximadamente{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {formatCompactNumber(turnaround.needed_votes_absolute)}
              </strong>{' '}
              ({formatInt(turnaround.needed_votes_absolute)}) votos válidos
            </div>
          )}

        <p data-testid="turnaround-neutral-message" className="sr-only">
          {turnaround.neutral_message}
        </p>

        {/* 3. Medidor Graduado Visual com 3 Zonas de Probabilidade Matemática */}
        <div className="mt-4">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            {/* Zonas em Gradiente */}
            <div className="absolute inset-0 flex">
              {/* Zona 1: 0% a 50% — Favorável (<50%) */}
              <div
                className="h-full bg-emerald-500/30 dark:bg-emerald-500/25"
                style={{ width: '50%' }}
                title="Zona Favorável: precisa de menos de 50% dos votos restantes"
              />
              {/* Zona 2: 50% a 60% — Disputado (50-60%) */}
              <div
                className="h-full bg-amber-500/40 dark:bg-amber-500/30"
                style={{ width: '10%' }}
                title="Zona Disputada: precisa entre 50% e 60% dos votos restantes"
              />
              {/* Zona 3: 60% a 100% — Alta Complexidade (>60%) */}
              <div
                className="h-full bg-rose-500/30 dark:bg-rose-500/20"
                style={{ width: '40%' }}
                title="Zona de Alta Complexidade: precisa de mais de 60% dos votos restantes"
              />
            </div>

            {/* Linha de Referência nos 50% */}
            <div
              className="absolute inset-y-0 left-1/2 z-10 w-0.5 bg-slate-900 dark:bg-white"
              title="Equilíbrio (50%)"
            />
            {/* Linha nos 60% */}
            <div
              className="absolute inset-y-0 left-[60%] z-10 w-0.5 bg-slate-500/60 dark:bg-slate-400/60"
              title="Limite de Disputa (60%)"
            />

            {/* Ponteiro / Marcador de Posição de sVal */}
            {sVal !== null && (
              <div
                className="absolute inset-y-0 z-20 flex -translate-x-1/2 items-center transition-all duration-500"
                style={{
                  left: `${Math.min(99, Math.max(1, sVal))}%`,
                }}
              >
                <div className="h-4 w-2 rounded-full border border-white bg-slate-950 shadow-md ring-2 ring-emerald-400 dark:border-slate-950 dark:bg-white dark:ring-emerald-400" />
              </div>
            )}
          </div>

          {/* Rótulos das 3 Zonas de Probabilidade */}
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400">
              &lt;50% Favorável
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              50–60% Disputado
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              &gt;60% Alta Complexidade
            </span>
          </div>
        </div>
      </div>

      {/* 4. Quatro Cartões de Dados (V, A, R, Brancos) com Números Compactos e Barras de Proporção */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {/* V: Válidos Apurados */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            V (Válidos apurados)
          </span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <strong
              data-testid="turnaround-var-v"
              className="text-base font-extrabold text-slate-900 dark:text-white"
            >
              {formatCompactNumber(turnaround.valid_votes_counted_v)}
            </strong>
            <span className="text-[10px] text-slate-500 font-mono">
              ({formatInt(turnaround.valid_votes_counted_v)})
            </span>
          </div>
          {/* Mini Barra de Proporção */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-slate-700 transition-all dark:bg-slate-300"
              style={{ width: `${vPct}%` }}
              title={`${formatPct(vPct)} do comparecimento esperado`}
            />
          </div>
        </div>

        {/* A: Votos de Quem Está Atrás */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            A (Votos do candidato atrás)
          </span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <strong
              data-testid="turnaround-var-a"
              className="text-base font-extrabold text-slate-900 dark:text-white"
            >
              {formatCompactNumber(turnaround.trailing_candidate_votes_a)}
            </strong>
            <span className="truncate text-[10px] text-slate-500">
              {turnaround.trailing_candidate_name}
            </span>
          </div>
          {/* Mini Barra de Proporção */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${
                isTrailingSlot1
                  ? theme1.barClass
                  : isTrailingSlot2
                    ? theme2.barClass
                    : 'bg-slate-600'
              }`}
              style={{ width: `${aPct}%` }}
              title={`${formatPct(aPct)} dos válidos apurados`}
            />
          </div>
        </div>

        {/* R: Válidos Restantes Estimados */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            R (Válidos restantes est.)
          </span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <strong
              data-testid="turnaround-var-r"
              className="text-base font-extrabold text-slate-900 dark:text-white"
            >
              {formatCompactNumber(turnaround.estimated_remaining_valid_votes_r)}
            </strong>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              Estimativa
            </span>
          </div>
          {/* Mini Barra de Proporção */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${rPct}%` }}
              title={`${formatPct(rPct)} do eleitorado esperado`}
            />
          </div>
        </div>

        {/* Brancos e Nulos */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Brancos & Nulos
          </span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <strong className="text-base font-extrabold text-slate-900 dark:text-white">
              {formatPct(turnaround.observed_blank_null_rate * 100)}
            </strong>
            <span className="text-[10px] text-slate-500">
              {turnaround.used_1t_blank_null_fallback
                ? 'Base 1ºT'
                : 'Observada 2ºT'}
            </span>
          </div>
          {/* Mini Barra de Proporção */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-slate-400 transition-all dark:bg-slate-600"
              style={{ width: `${bnPct}%` }}
              title="Taxa observada de brancos e nulos"
            />
          </div>
        </div>
      </div>

      {/* 5. Controle Deslizante Compacto: Simular Comparecimento */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="turnout-adjustment-slider"
            className="text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            Simular comparecimento vs 1ºT:{' '}
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
              Restaurar
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

      <HowWeCalculateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        turnaround={turnaround}
      />
    </section>
  )
}
