import { useMemo } from 'react'
import { Check, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import type { DisputeSnapshot } from '../../types/election'
import { formatCompactNumber, formatInt } from '../../utils/formatters'

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

    const remainingSections = sections.remaining_sections
    const effectiveSpeed = Math.max(600, urnasPerMin)
    const estMinutesRemaining = Math.max(
      1,
      Math.round(remainingSections / effectiveSpeed),
    )

    let statusText = `Ritmo de cruzeiro • Conclusão est. em ~${estMinutesRemaining} min`
    if (estMinutesRemaining > 60) {
      const h = Math.floor(estMinutesRemaining / 60)
      const m = estMinutesRemaining % 60
      statusText = `Ritmo de cruzeiro • Conclusão est. em ~${h}h${m > 0 ? ` ${m}min` : ''}`
    }

    // Normaliza medidor do velocímetro (0 a 8.000 urnas/min)
    const gaugePercent = Math.min(100, Math.round((urnasPerMin / 8000) * 100))

    return {
      urnasPerMin,
      votesPerMin,
      estMinutesRemaining,
      statusText,
      trend,
      trendPercent,
      gaugePercent,
    }
  }, [pctCounted, sections, timeline])

  // Cálculo do arco SVG para o velocímetro
  // Raio 34, centro (44, 42), semi-círculo de 180° a 0°
  const radius = 32
  const circumference = Math.PI * radius // ~100.5
  const strokeDashoffset =
    circumference - (speedData.gaugePercent / 100) * circumference

  // Ângulo do ponteiro (de 180° a 0°)
  const angleDeg = 180 - (speedData.gaugePercent / 100) * 180
  const angleRad = (angleDeg * Math.PI) / 180
  const needleX = 44 + Math.cos(angleRad) * (radius - 2)
  const needleY = 40 - Math.sin(angleRad) * (radius - 2)

  return (
    <div
      data-testid="counting-speedometer-widget"
      className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-1.5 shadow-2xs backdrop-blur-sm sm:px-3.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]"
      title="Ritmo estimado de apuração oficial em urnas e votos por minuto"
    >
      {/* Mini-medidor em arco circular SVG */}
      <div className="relative flex h-11 w-16 shrink-0 items-end justify-center overflow-hidden">
        <svg
          viewBox="0 0 88 46"
          className="h-full w-full select-none"
          role="img"
          aria-label={`Velocímetro de apuração: ${speedData.gaugePercent}% da capacidade`}
        >
          <defs>
            <linearGradient id="speed-neon-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="55%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Trilho de fundo (arco de 180° a 0°) */}
          <path
            d="M 12 40 A 32 32 0 0 1 76 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            className="text-slate-200 dark:text-[#1F1F24]"
          />

          {/* Arco preenchido com gradiente neon */}
          <path
            d="M 12 40 A 32 32 0 0 1 76 40"
            fill="none"
            stroke="url(#speed-neon-grad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#neon-glow)"
            style={{
              transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />

          {/* Ponto indicador / ponteiro luminoso */}
          {pctCounted > 0 && pctCounted < 100 && (
            <circle
              cx={needleX}
              cy={needleY}
              r="3.5"
              fill="#ffffff"
              stroke="#10B981"
              strokeWidth="1.5"
              className="drop-shadow-[0_0_4px_#10B981]"
            />
          )}
        </svg>

        {/* Ícone no centro da base do arco */}
        <div className="absolute bottom-0 flex items-center justify-center">
          <Zap
            className="h-3.5 w-3.5 text-amber-500 animate-pulse dark:text-amber-400"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Métricas e status do ritmo de apuração */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-black tracking-tight text-slate-900 sm:text-sm dark:text-white">
            {speedData.urnasPerMin > 0 ? (
              <>
                <Zap className="mr-1 inline-block h-3.5 w-3.5 text-amber-500 fill-amber-500" strokeWidth={1.75} aria-hidden="true" />
                {formatInt(speedData.urnasPerMin)}{' '}
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  urnas/min
                </span>
                <span className="hidden font-mono text-[11px] font-semibold text-slate-400 sm:inline">
                  {' '}(~{formatCompactNumber(speedData.votesPerMin)} votos/min)
                </span>
              </>
            ) : pctCounted >= 100 ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Apuração concluída
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Aguardando início
              </span>
            )}
          </span>

          {/* Badge de aceleração / desaceleração */}
          {speedData.trend === 'accelerating' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              title="Ritmo acelerando em relação ao ciclo anterior"
            >
              <TrendingUp className="h-2.5 w-2.5" />
              {speedData.trendPercent > 0 ? `+${speedData.trendPercent}%` : 'Rápido'}
            </span>
          )}
          {speedData.trend === 'decelerating' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              title="Ritmo desacelerando em relação ao ciclo anterior"
            >
              <TrendingDown className="h-2.5 w-2.5" />
              {speedData.trendPercent < 0 ? `${speedData.trendPercent}%` : 'Lento'}
            </span>
          )}
        </div>

        {/* Linha secundária de estimativa */}
        <p className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {speedData.statusText}
        </p>
      </div>
    </div>
  )
}
