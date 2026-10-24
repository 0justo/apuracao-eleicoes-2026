import { useMemo } from 'react'
import { Check, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import type { DisputeSnapshot } from '../../types/election'
import { formatCompactNumber, formatInt, formatPct } from '../../utils/formatters'

interface CountingSpeedometerProps {
  snapshot: DisputeSnapshot
}

function parseSeconds(hms: string): number {
  const parts = hms.split(':').map(Number)
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

export function CountingSpeedometer({ snapshot }: CountingSpeedometerProps) {
  const { sections, timeline = [] } = snapshot
  const pctCounted = sections.pct_counted

  const speedData = useMemo(() => {
    if (pctCounted >= 100) {
      return {
        urnasPerMin: 0,
        votesPerMin: 0,
        estMinutesRemaining: 0,
        statusText: 'Apuração 100% totalizada',
        trend: 'completed' as const,
        trendPercent: 0,
        gaugePercent: 100,
      }
    }

    if (pctCounted <= 0) {
      return {
        urnasPerMin: 0,
        votesPerMin: 0,
        estMinutesRemaining: null,
        statusText: 'Aguardando primeiros boletins',
        trend: 'idle' as const,
        trendPercent: 0,
        gaugePercent: 0,
      }
    }

    // Calcula velocidade entre os 2 últimos pontos da linha do tempo
    let urnasPerMin = 4850 // fallback plausível do TSE em apuração ativa
    let votesPerMin = 290000
    let trend: 'accelerating' | 'decelerating' | 'stable' = 'stable'
    let trendPercent = 0

    if (timeline.length >= 2) {
      const pLatest = timeline[timeline.length - 1]
      const pPrev = timeline[timeline.length - 2]
      const tLatest = parseSeconds(pLatest.timestamp)
      const tPrev = parseSeconds(pPrev.timestamp)
      const deltaSec = tLatest > tPrev ? tLatest - tPrev : 60
      const deltaMin = Math.max(0.2, deltaSec / 60)

      const dPct = Math.max(0, pLatest.pct_counted - pPrev.pct_counted)
      const dUrnas = (dPct / 100) * sections.total_sections
      const calcUrnas = Math.round(dUrnas / deltaMin)

      const dVotes = Math.max(
        0,
        pLatest.cand1_votes +
          pLatest.cand2_votes -
          (pPrev.cand1_votes + pPrev.cand2_votes),
      )
      const calcVotes = Math.round(dVotes / deltaMin)

      if (calcUrnas > 100) {
        urnasPerMin = calcUrnas
        votesPerMin = calcVotes
      }

      // Se há pelo menos 3 pontos, calcula tendência de aceleração
      if (timeline.length >= 3) {
        const pOlder = timeline[timeline.length - 3]
        const dPctOlder = Math.max(0, pPrev.pct_counted - pOlder.pct_counted)
        const dUrnasOlder = (dPctOlder / 100) * sections.total_sections
        if (dUrnasOlder > 50) {
          const ratio = (dUrnas / dUrnasOlder) - 1
          trendPercent = Math.round(ratio * 100)
          if (ratio > 0.06) trend = 'accelerating'
          else if (ratio < -0.06) trend = 'decelerating'
          else trend = 'stable'
        }
      }
    }

    const remainingSections =
      sections.remaining_sections ??
      Math.max(0, sections.total_sections - sections.counted_sections)
    const effectiveSpeed = Math.max(600, urnasPerMin)
    const estMinutesRemaining = Math.max(
      1,
      Math.round(remainingSections / effectiveSpeed),
    )

    // Horário estimado de conclusão a partir do dado oficial
    let estimatedConclusionTime = ''
    let estimatedDurationStr = ''
    if (snapshot.generated_at_hms) {
      const currentSec = parseSeconds(snapshot.generated_at_hms)
      const finishSec = (currentSec + estMinutesRemaining * 60) % 86400
      const finishH = Math.floor(finishSec / 3600)
      const finishM = Math.floor((finishSec % 3600) / 60)
      estimatedConclusionTime = `~${finishH.toString().padStart(2, '0')}:${finishM.toString().padStart(2, '0')}`
    }

    if (estMinutesRemaining >= 60) {
      const h = Math.floor(estMinutesRemaining / 60)
      const m = estMinutesRemaining % 60
      estimatedDurationStr = `em ${h}h ${m.toString().padStart(2, '0')}min`
    } else {
      estimatedDurationStr = `em ~${estMinutesRemaining} min`
    }

    const estimatedConclusionFull = estimatedConclusionTime
      ? `Conclusão estimada: ${estimatedConclusionTime} (${estimatedDurationStr})`
      : `Conclusão estimada: ${estimatedDurationStr}`

    // Normaliza medidor do velocímetro (0 a 8.000 urnas/min)
    const gaugePercent = Math.min(100, Math.round((urnasPerMin / 8000) * 100))

    return {
      urnasPerMin,
      votesPerMin,
      estMinutesRemaining,
      remainingSections,
      estimatedConclusionFull,
      trend,
      trendPercent,
      gaugePercent,
    }
  }, [pctCounted, sections, timeline, snapshot.generated_at_hms])

  // Cálculo do anel circular de progresso (0% a 100%)
  // Raio 46, centro (55, 55), circunferência = 2 * PI * 46 ≈ 289.026
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, pctCounted)) / 100) * circumference

  // Ângulo do ponto indicador no topo do arco
  const angleDeg = (Math.min(100, Math.max(0, pctCounted)) / 100) * 360 - 90
  const angleRad = (angleDeg * Math.PI) / 180
  const tipX = 55 + Math.cos(angleRad) * radius
  const tipY = 55 + Math.sin(angleRad) * radius

  return (
    <div
      data-testid="counting-speedometer-widget"
      className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-slate-200/90 bg-white/95 p-2.5 sm:p-3.5 shadow-2xs backdrop-blur-sm dark:border-[#1F1F24] dark:bg-[#0F0F12]"
      title="Progresso geral de totalização e ritmo oficial de apuração"
    >
      {/* Anel Circular de Progresso (112px no desktop, 88px no mobile) */}
      <div className="relative flex h-[88px] w-[88px] sm:h-[112px] sm:w-[112px] shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 110 110"
          className="h-full w-full select-none"
          role="img"
          aria-label={`Progresso de apuração: ${formatPct(pctCounted)} apurado`}
        >
          <defs>
            <linearGradient id="progress-neon-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
            <filter id="progress-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Trilho de fundo (360 graus) */}
          <circle
            cx="55"
            cy="55"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6.5"
            className="text-slate-200/80 dark:text-[#1F1F24]"
          />

          {/* Anel preenchido com gradiente verde */}
          <circle
            cx="55"
            cy="55"
            r={radius}
            fill="none"
            stroke="url(#progress-neon-grad)"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 55 55)"
            filter="url(#progress-glow)"
            style={{
              transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />

          {/* Ponto indicador luminoso no fim do arco */}
          {pctCounted > 0 && pctCounted < 100 && (
            <circle
              cx={tipX}
              cy={tipY}
              r="4"
              fill="#ffffff"
              stroke="#10B981"
              strokeWidth="2"
              className="drop-shadow-[0_0_5px_#10B981]"
            />
          )}
        </svg>

        {/* % Apurado no centro do anel ampliado (22 a 26px desktop, 18 a 22px mobile, peso 800) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none px-2">
          <span
            data-testid="scoreboard-pct-counted"
            className="flex items-baseline justify-center font-sans font-extrabold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums"
          >
            <span className="text-[19px] sm:text-[24px]">
              {pctCounted >= 100
                ? '100'
                : formatPct(pctCounted, 1).replace('%', '')}
            </span>
            <span className="text-[12px] sm:text-[14px] font-bold text-slate-600 dark:text-slate-300 ml-0.5">
              %
            </span>
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1 leading-none">
            apurado
          </span>
        </div>
      </div>

      {/* Métricas e status destacados ao lado do anel */}
      <div className="flex flex-col justify-center min-w-0 pr-1">
        {/* Destaque (20 a 22px, peso 700): Faltam X seções */}
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg sm:text-[21px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            {pctCounted >= 100 ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                Apuração 100% concluída
              </span>
            ) : pctCounted <= 0 ? (
              <span>Aguardando boletins</span>
            ) : (
              <span>Faltam {formatInt(speedData.remainingSections ?? sections.remaining_sections)} seções</span>
            )}
          </h3>

          {/* Badge de aceleração / desaceleração */}
          {speedData.trend === 'accelerating' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              title="Ritmo acelerando em relação ao ciclo anterior"
            >
              <TrendingUp className="h-3 w-3" />
              {speedData.trendPercent > 0 ? `+${speedData.trendPercent}%` : 'Acelerando'}
            </span>
          )}
          {speedData.trend === 'decelerating' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              title="Ritmo desacelerando em relação ao ciclo anterior"
            >
              <TrendingDown className="h-3 w-3" />
              {speedData.trendPercent < 0 ? `${speedData.trendPercent}%` : 'Desacelerando'}
            </span>
          )}
        </div>

        {/* Destaque também: Conclusão estimada: ~HH:MM (em Xh XXmin) */}
        {pctCounted > 0 && pctCounted < 100 && (
          <p className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            {speedData.estimatedConclusionFull}
          </p>
        )}

        {/* Informação secundária pequena: 3.005 urnas/min (~707k votos/min) */}
        {speedData.urnasPerMin > 0 && pctCounted < 100 && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            <Zap className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>
              {formatInt(speedData.urnasPerMin)} urnas/min
            </span>
            <span className="hidden sm:inline opacity-80">
              (~{formatCompactNumber(speedData.votesPerMin)} votos/min)
            </span>
            <span className="opacity-50">·</span>
            <span>
              {formatInt(sections.counted_sections)} de {formatInt(sections.total_sections)} seções
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
