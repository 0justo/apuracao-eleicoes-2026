import { useState } from 'react'
import {
  Clock,
  History,
  Info,
  LineChart,
  Pause,
  Percent,
  Play,
  Radio,
  RotateCcw,
} from 'lucide-react'
import type {
  DisputeSnapshot,
  ReplayBundle,
  TimelinePoint,
} from '../../types/election'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import {
  formatPct,
  formatPP,
  formatSignedPP,
} from '../../utils/formatters'

interface MarginTimelineChartProps {
  snapshot: DisputeSnapshot
  isReplayMode: boolean
  replayBundle: ReplayBundle | null
  replayFrameIndex: number
  isReplayPlaying: boolean
  replaySpeedMs: number
  onStartReplay: () => void
  onStopReplay: () => void
  onSelectReplayFrame: (idx: number) => void
  onToggleReplayPlay: () => void
  onChangeReplaySpeed: (ms: number) => void
}

const SVG_WIDTH = 720
const SVG_HEIGHT = 270
const PAD_LEFT = 54
const PAD_RIGHT = 56
const PAD_TOP = 24
const PAD_BOTTOM = 42

export function MarginTimelineChart({
  snapshot,
  isReplayMode,
  replayBundle,
  replayFrameIndex,
  isReplayPlaying,
  replaySpeedMs,
  onStartReplay,
  onStopReplay,
  onSelectReplayFrame,
  onToggleReplayPlay,
  onChangeReplaySpeed,
}: MarginTimelineChartProps) {
  const [cand1, cand2] = snapshot.candidates
  const [theme1, theme2] = getDisputePairThemes(cand1, cand2)
  const [xAxisMode, setXAxisMode] = useState<'pct' | 'time'>('pct')
  const [chartType, setChartType] = useState<'margin' | 'both_candidates'>(
    'both_candidates',
  )
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const points: TimelinePoint[] = snapshot.timeline ?? []
  const plotW = SVG_WIDTH - PAD_LEFT - PAD_RIGHT
  const plotH = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM

  const activePoint: TimelinePoint | null =
    points.length > 0
      ? (points[hoveredIdx ?? points.length - 1] ?? points[points.length - 1])
      : null

  // Escala horizontal X: por % de urnas apuradas (0..100) ou por índice temporal
  const getX = (pt: TimelinePoint, idx: number): number => {
    if (points.length <= 1) return PAD_LEFT + plotW / 2
    if (xAxisMode === 'pct') {
      return PAD_LEFT + (Math.max(0, Math.min(100, pt.pct_counted)) / 100) * plotW
    }
    return PAD_LEFT + (idx / (points.length - 1)) * plotW
  }

  // Escala vertical Y para o gráfico de Margem (Candidato 1 - Candidato 2 em p.p.)
  const maxAbsMargin = Math.max(
    4,
    ...points.map((p) => Math.abs(p.margin_cand1_minus_cand2_pp)),
  )
  const yBoundMargin = Math.ceil(maxAbsMargin * 1.15)
  const zeroY = PAD_TOP + plotH / 2

  const getYMargin = (marginPP: number): number => {
    const clamped = Math.max(-yBoundMargin, Math.min(yBoundMargin, marginPP))
    return zeroY - (clamped / yBoundMargin) * (plotH / 2)
  }

  // Escala vertical Y para o gráfico de ambos os candidatos (% válidos)
  // Foca dinamicamente na faixa útil dos candidatos (ex: min 35% a max 65% quando ambos estiverem perto de 50%),
  // evitando que as linhas fiquem esmagadas no topo do gráfico.
  const validPcts = points
    .flatMap((p) => [p.cand1_pct, p.cand2_pct])
    .filter((v) => v > 0 && Number.isFinite(v))

  const minObserved = validPcts.length > 0 ? Math.min(...validPcts) : 48
  const maxObserved = validPcts.length > 0 ? Math.max(...validPcts) : 52

  let minCandPct = Math.max(0, Math.floor(minObserved - 3))
  let maxCandPct = Math.min(100, Math.ceil(maxObserved + 3))

  if (maxCandPct - minCandPct < 30) {
    const mid = (minCandPct + maxCandPct) / 2
    minCandPct = Math.max(0, Math.round(mid - 15))
    maxCandPct = Math.min(100, Math.round(mid + 15))
  }
  const spanCandPct = Math.max(4, maxCandPct - minCandPct)

  const getYCandPct = (pct: number): number => {
    return PAD_TOP + (1 - (pct - minCandPct) / spanCandPct) * plotH
  }

  const marginPolyline = points
    .map((pt, idx) => `${getX(pt, idx).toFixed(1)},${getYMargin(pt.margin_cand1_minus_cand2_pp).toFixed(1)}`)
    .join(' ')

  const marginAreaPath =
    points.length > 1
      ? `M ${getX(points[0], 0).toFixed(1)},${zeroY.toFixed(1)} ` +
        points
          .map(
            (pt, idx) =>
              `L ${getX(pt, idx).toFixed(1)},${getYMargin(pt.margin_cand1_minus_cand2_pp).toFixed(1)}`,
          )
          .join(' ') +
        ` L ${getX(points[points.length - 1], points.length - 1).toFixed(1)},${zeroY.toFixed(1)} Z`
      : ''

  const cand1Polyline = points
    .map((pt, idx) => `${getX(pt, idx).toFixed(1)},${getYCandPct(pt.cand1_pct).toFixed(1)}`)
    .join(' ')
  const cand2Polyline = points
    .map((pt, idx) => `${getX(pt, idx).toFixed(1)},${getYCandPct(pt.cand2_pct).toFixed(1)}`)
    .join(' ')

  const bottomY = PAD_TOP + plotH
  const cand1AreaPath =
    points.length > 1
      ? `M ${getX(points[0], 0).toFixed(1)},${bottomY.toFixed(1)} ` +
        points
          .map(
            (pt, idx) =>
              `L ${getX(pt, idx).toFixed(1)},${getYCandPct(pt.cand1_pct).toFixed(1)}`,
          )
          .join(' ') +
        ` L ${getX(points[points.length - 1], points.length - 1).toFixed(1)},${bottomY.toFixed(1)} Z`
      : ''
  const cand2AreaPath =
    points.length > 1
      ? `M ${getX(points[0], 0).toFixed(1)},${bottomY.toFixed(1)} ` +
        points
          .map(
            (pt, idx) =>
              `L ${getX(pt, idx).toFixed(1)},${getYCandPct(pt.cand2_pct).toFixed(1)}`,
          )
          .join(' ') +
        ` L ${getX(points[points.length - 1], points.length - 1).toFixed(1)},${bottomY.toFixed(1)} Z`
      : ''

  const lastPt = points.length > 0 ? points[points.length - 1] : null
  const lastIdx = points.length - 1
  const lastX = lastPt ? getX(lastPt, lastIdx) : 0
  const rawLastY1 = lastPt ? getYCandPct(lastPt.cand1_pct) : 0
  const rawLastY2 = lastPt ? getYCandPct(lastPt.cand2_pct) : 0

  let badgeY1 = rawLastY1
  let badgeY2 = rawLastY2
  if (Math.abs(badgeY1 - badgeY2) < 20) {
    if (badgeY1 <= badgeY2) {
      badgeY1 -= 9
      badgeY2 += 9
    } else {
      badgeY1 += 9
      badgeY2 -= 9
    }
  }
  const badgeX =
    lastX + 54 > SVG_WIDTH - 4 ? Math.max(PAD_LEFT + 4, lastX - 52) : lastX + 6

  return (
    <section
      aria-label="Linha do tempo da apuração e Replay 2022"
      data-testid="margin-timeline-section"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-[#1F1F24] dark:bg-[#0A0A0C]"
    >
      {/* 1. Cabeçalho Limpo: Ícone Azul + Título Lado a Lado na Primeira Linha Inteira */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-[#1F1F24]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <LineChart className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span
              className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
              title="Indicador da Linha do Tempo"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          <h2 className="text-base font-bold text-slate-900 sm:text-lg dark:text-white whitespace-nowrap">
            Linha do Tempo da Apuração
          </h2>

          {/* Ícone ⓘ discreto com Tooltip dinâmico */}
          <div className="group relative inline-flex items-center shrink-0">
            <button
              type="button"
              className="rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300"
              aria-label="Informações sobre a linha do tempo"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-72 rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">
              <p className="font-medium text-white">Trajetória e Cruzamento</p>
              <p className="mt-1 text-slate-300">
                Evolução temporal da diferença em pontos percentuais ({cand1.ballot_name} − {cand2.ballot_name}) correlacionada com a porcentagem de urnas apuradas e o horário oficial de divulgação do TSE.
              </p>
            </div>
          </div>
        </div>

        {/* Badge Sutil de Modo */}
        <div className="shrink-0">
          {isReplayMode ? (
            <span
              data-testid="timeline-replay-badge"
              className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-slate-950 whitespace-nowrap"
            >
              <History className="h-3 w-3" aria-hidden="true" />
              REPLAY 2022
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-[#0F0F12] dark:border dark:border-[#1F1F24] dark:text-slate-300 whitespace-nowrap">
              <Radio className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Ao Vivo
            </span>
          )}
        </div>
      </div>

      {/* 2. Barra de Controles Segmentados Compactos (Abaixo do Título em Linha Organizada) */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pb-1">
        {/* Alternador de Séries: % Candidatos vs Margem */}
        <div
          role="group"
          aria-label="Série exibida no gráfico"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs whitespace-nowrap dark:border-white/[0.07] dark:bg-white/[0.04]"
        >
          <button
            type="button"
            data-testid="timeline-series-both-btn"
            aria-pressed={chartType === 'both_candidates'}
            onClick={() => setChartType('both_candidates')}
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              chartType === 'both_candidates'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            % Candidatos
          </button>
          <button
            type="button"
            data-testid="timeline-series-margin-btn"
            aria-pressed={chartType === 'margin'}
            onClick={() => setChartType('margin')}
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              chartType === 'margin'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Margem
          </button>
        </div>

        {/* Eixo X: % Urnas vs Horário */}
        <div
          role="group"
          aria-label="Eixo horizontal da linha do tempo"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs whitespace-nowrap dark:border-white/[0.07] dark:bg-white/[0.04]"
        >
          <button
            type="button"
            data-testid="timeline-xaxis-pct-btn"
            aria-pressed={xAxisMode === 'pct'}
            onClick={() => setXAxisMode('pct')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              xAxisMode === 'pct'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Percent className="h-2.5 w-2.5" aria-hidden="true" />
            % Urnas
          </button>
          <button
            type="button"
            data-testid="timeline-xaxis-time-btn"
            aria-pressed={xAxisMode === 'time'}
            onClick={() => setXAxisMode('time')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              xAxisMode === 'time'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            Horário
          </button>
        </div>

        {/* Alternador 2026 vs Replay 22 */}
        <div
          role="group"
          aria-label="Alternar entre Apuração 2026 e Replay Histórico 2022"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs whitespace-nowrap dark:border-white/[0.07] dark:bg-white/[0.04]"
        >
          <button
            type="button"
            data-testid="timeline-mode-live-btn"
            aria-pressed={!isReplayMode}
            onClick={() => {
              if (isReplayMode) onStopReplay()
            }}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              !isReplayMode
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            2026
          </button>
          <button
            type="button"
            data-testid="timeline-mode-replay-btn"
            aria-pressed={isReplayMode}
            onClick={() => {
              if (!isReplayMode) onStartReplay()
            }}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              isReplayMode
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <History className="h-2.5 w-2.5" aria-hidden="true" />
            Replay 22
          </button>
        </div>
      </div>

      {/* Painel de controle do Replay 2022 integrado */}
      {isReplayMode && replayBundle && (
        <div
          data-testid="timeline-replay-controls"
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">
                {replayBundle.title} — Quadro {replayFrameIndex + 1} de{' '}
                {replayBundle.frames.length}
              </p>
              <p className="text-[11px] opacity-90">
                {replayBundle.disclaimer}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="timeline-replay-play-pause"
                onClick={onToggleReplayPlay}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
              >
                {isReplayPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    Reproduzir
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onSelectReplayFrame(0)}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-2 py-1 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200"
                title="Voltar ao início do Replay 2022 (0%)"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                0%
              </button>
              <select
                aria-label="Velocidade do Replay 2022 na linha do tempo"
                value={replaySpeedMs}
                onChange={(e) => onChangeReplaySpeed(Number(e.target.value))}
                className="rounded-lg border border-amber-400 bg-white px-2 py-1 text-xs font-semibold text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={2500}>Velocidade 1x</option>
                <option value={1200}>Velocidade 2x</option>
                <option value={600}>Velocidade 4x</option>
              </select>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[11px]">17:00 (0%)</span>
            <input
              type="range"
              aria-label="Selecionar instante do Replay 2022"
              min={0}
              max={Math.max(0, replayBundle.frames.length - 1)}
              value={replayFrameIndex}
              onChange={(e) => onSelectReplayFrame(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-amber-600"
            />
            <span className="font-mono text-[11px]">21:30 (100%)</span>
          </div>
        </div>
      )}

      {/* Gráfico SVG ou Estado Inicial (0% apurado) */}
      {points.length === 0 ? (
        <div
          data-testid="timeline-empty-state"
          className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-xs text-slate-600 dark:border-[#1F1F24] dark:bg-[#0F0F12] dark:text-slate-400"
        >
          Aguardando os primeiros snapshots com votos válidos apurados para
          traçar a curva da margem ao longo do tempo. Experimente acionar o
          botão <strong>Replay 2022</strong> acima para ver a curva histórica
          completa de 0% a 100%.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Resumo do ponto em foco (último ou sob o cursor) */}
          {activePoint && (
            <div
              data-testid="timeline-active-point-summary"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs dark:border-[#1F1F24] dark:bg-[#0F0F12]"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  Horário TSE: {activePoint.timestamp}
                </span>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                  {formatPct(activePoint.pct_counted)} das urnas
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1 font-medium ${theme1.textAccentClass}`}>
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${theme1.dotClass}`}
                    aria-hidden="true"
                  />
                  {cand1.ballot_name}:{' '}
                  <strong className="font-mono">
                    {formatPct(activePoint.cand1_pct)}
                  </strong>
                </span>
                <span className={`inline-flex items-center gap-1 font-medium ${theme2.textAccentClass}`}>
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${theme2.dotClass}`}
                    aria-hidden="true"
                  />
                  {cand2.ballot_name}:{' '}
                  <strong className="font-mono">
                    {formatPct(activePoint.cand2_pct)}
                  </strong>
                </span>
                {(() => {
                  const diff = activePoint.margin_cand1_minus_cand2_pp
                  if (diff > 0) {
                    return (
                      <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${theme1.badgeClass}`}>
                        Vantagem atual: {cand1.ballot_name.toUpperCase()} +{formatPP(diff)}
                      </span>
                    )
                  }
                  if (diff < 0) {
                    return (
                      <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${theme2.badgeClass}`}>
                        Vantagem atual: {cand2.ballot_name.toUpperCase()} +{formatPP(diff)}
                      </span>
                    )
                  }
                  return (
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      Empate técnico
                    </span>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Área gráfica SVG responsiva */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-2 dark:border-[#1F1F24] dark:bg-[#0F0F12]">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              role="img"
              aria-label={`Gráfico da linha do tempo da apuração (${points.length} snapshots registrados)`}
              className="h-auto w-full min-w-[300px] select-none"
            >
              <defs>
                <linearGradient
                  id="margin-area-grad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={theme1.hexLight} stopOpacity="0.28" />
                  <stop offset="50%" stopColor="#64748b" stopOpacity="0.05" />
                  <stop offset="100%" stopColor={theme2.hexLight} stopOpacity="0.28" />
                </linearGradient>
                <linearGradient
                  id="cand1-area-grad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={theme1.hexLight} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={theme1.hexLight} stopOpacity="0.02" />
                </linearGradient>
                <linearGradient
                  id="cand2-area-grad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={theme2.hexLight} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={theme2.hexLight} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grade Horizontal */}
              {chartType === 'margin' ? (
                <>
                  {[-yBoundMargin, -yBoundMargin / 2, 0, yBoundMargin / 2, yBoundMargin].map(
                    (val) => {
                      const y = getYMargin(val)
                      const isZero = Math.abs(val) < 1e-6
                      return (
                        <g key={val}>
                          <line
                            x1={PAD_LEFT}
                            y1={y}
                            x2={SVG_WIDTH - PAD_RIGHT}
                            y2={y}
                            stroke={
                              isZero
                                ? '#64748b'
                                : 'rgba(148, 163, 184, 0.25)'
                            }
                            strokeWidth={isZero ? 1.5 : 1}
                            strokeDasharray={isZero ? '4 3' : undefined}
                          />
                          <text
                            x={PAD_LEFT - 6}
                            y={y}
                            textAnchor="end"
                            dominantBaseline="central"
                            className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                          >
                            {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                          </text>
                        </g>
                      )
                    },
                  )}
                </>
              ) : (
                <>
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const val = minCandPct + t * spanCandPct
                    const y = getYCandPct(val)
                    return (
                      <g key={t}>
                        <line
                          x1={PAD_LEFT}
                          y1={y}
                          x2={SVG_WIDTH - PAD_RIGHT}
                          y2={y}
                          stroke="rgba(148, 163, 184, 0.25)"
                          strokeWidth="1"
                        />
                        <text
                          x={PAD_LEFT - 6}
                          y={y}
                          textAnchor="end"
                          dominantBaseline="central"
                          className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                        >
                          {val.toFixed(1)}%
                        </text>
                      </g>
                    )
                  })}
                </>
              )}

              {/* Eixo X: marcas de % de urnas apuradas ou horários */}
              {xAxisMode === 'pct'
                ? [0, 20, 40, 60, 80, 100].map((pctTick) => {
                    const x = PAD_LEFT + (pctTick / 100) * plotW
                    return (
                      <g key={pctTick}>
                        <line
                          x1={x}
                          y1={PAD_TOP}
                          x2={x}
                          y2={SVG_HEIGHT - PAD_BOTTOM}
                          stroke="rgba(148, 163, 184, 0.18)"
                          strokeWidth="1"
                        />
                        <text
                          x={x}
                          y={SVG_HEIGHT - PAD_BOTTOM + 16}
                          textAnchor="middle"
                          className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                        >
                          {pctTick}%
                        </text>
                      </g>
                    )
                  })
                : points.map((pt, idx) => {
                    const step = Math.max(1, Math.floor(points.length / 5))
                    if (idx % step !== 0 && idx !== points.length - 1) {
                      return null
                    }
                    const x = getX(pt, idx)
                    return (
                      <text
                        key={`t-${pt.timestamp}-${idx}`}
                        x={x}
                        y={SVG_HEIGHT - PAD_BOTTOM + 16}
                        textAnchor="middle"
                        className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                      >
                        {pt.timestamp.slice(0, 5)}
                      </text>
                    )
                  })}

              {/* Rótulo do eixo X */}
              <text
                x={PAD_LEFT + plotW / 2}
                y={SVG_HEIGHT - 6}
                textAnchor="middle"
                className="fill-slate-500 font-sans text-[10px] font-semibold dark:fill-slate-400"
              >
                {xAxisMode === 'pct'
                  ? 'Percentual de urnas apuradas (%)'
                  : 'Horário oficial do snapshot (Brasília)'}
              </text>

              {/* Séries de Dados */}
              {chartType === 'margin' ? (
                <>
                  {marginAreaPath && (
                    <path d={marginAreaPath} fill="url(#margin-area-grad)" />
                  )}
                  <polyline
                    fill="none"
                    stroke="#475569"
                    strokeWidth="2.4"
                    points={marginPolyline}
                  />
                  {points.map((pt, idx) => {
                    const cx = getX(pt, idx)
                    const cy = getYMargin(pt.margin_cand1_minus_cand2_pp)
                    const isHovered =
                      (hoveredIdx ?? points.length - 1) === idx
                    const dotColor =
                      pt.margin_cand1_minus_cand2_pp > 0
                        ? theme1.hexLight
                        : pt.margin_cand1_minus_cand2_pp < 0
                          ? theme2.hexLight
                          : '#64748b'
                    return (
                      <g
                        key={`pt-${pt.timestamp}-${idx}`}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onClick={() => setHoveredIdx(idx)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 5.5 : 3.5}
                          fill={dotColor}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <title>
                          {`${pt.timestamp} (${formatPct(pt.pct_counted)} apurado): Margem ${formatSignedPP(pt.margin_cand1_minus_cand2_pp)}`}
                        </title>
                      </g>
                    )
                  })}
                </>
              ) : (
                <>
                  {/* Suave degradê/brilho sob as curvas */}
                  {cand1AreaPath && (
                    <path d={cand1AreaPath} fill="url(#cand1-area-grad)" />
                  )}
                  {cand2AreaPath && (
                    <path d={cand2AreaPath} fill="url(#cand2-area-grad)" />
                  )}

                  {/* Curva Candidato 1 */}
                  <polyline
                    fill="none"
                    stroke={theme1.hexLight}
                    strokeWidth="2.5"
                    points={cand1Polyline}
                  />
                  {/* Curva Candidato 2 */}
                  <polyline
                    fill="none"
                    stroke={theme2.hexLight}
                    strokeWidth="2.5"
                    points={cand2Polyline}
                  />

                  {/* Pontos nítidos em cada snapshot */}
                  {points.map((pt, idx) => {
                    const cx = getX(pt, idx)
                    const cy1 = getYCandPct(pt.cand1_pct)
                    const cy2 = getYCandPct(pt.cand2_pct)
                    const isHovered =
                      (hoveredIdx ?? points.length - 1) === idx
                    return (
                      <g
                        key={`both-${pt.timestamp}-${idx}`}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onClick={() => setHoveredIdx(idx)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy1}
                          r={isHovered ? 5 : 3.5}
                          fill={theme1.hexLight}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx={cx}
                          cy={cy2}
                          r={isHovered ? 5 : 3.5}
                          fill={theme2.hexLight}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <title>
                          {`${pt.timestamp} (${formatPct(pt.pct_counted)} apurado): ${cand1.ballot_name} ${formatPct(pt.cand1_pct)} × ${cand2.ballot_name} ${formatPct(pt.cand2_pct)}`}
                        </title>
                      </g>
                    )
                  })}

                  {/* Rótulos com a porcentagem final no final da linha */}
                  {lastPt && (
                    <g data-testid="timeline-final-pct-badges">
                      <g>
                        <rect
                          x={badgeX}
                          y={badgeY1 - 9}
                          width={48}
                          height={18}
                          rx={4}
                          fill={theme1.hexLight}
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                        <text
                          x={badgeX + 24}
                          y={badgeY1}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-white font-mono text-[10px] font-bold"
                        >
                          {formatPct(lastPt.cand1_pct)}
                        </text>
                      </g>
                      <g>
                        <rect
                          x={badgeX}
                          y={badgeY2 - 9}
                          width={48}
                          height={18}
                          rx={4}
                          fill={theme2.hexLight}
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                        <text
                          x={badgeX + 24}
                          y={badgeY2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-white font-mono text-[10px] font-bold"
                        >
                          {formatPct(lastPt.cand2_pct)}
                        </text>
                      </g>
                    </g>
                  )}
                </>
              )}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            {chartType === 'margin' ? (
              <span>
                Acima de 0,00 p.p.:{' '}
                <strong className={theme1.textAccentClass}>
                  {cand1.ballot_name}
                </strong>{' '}
                à frente · Abaixo de 0,00 p.p.:{' '}
                <strong className={theme2.textAccentClass}>
                  {cand2.ballot_name}
                </strong>{' '}
                à frente
              </span>
            ) : (
              <span>
                Linha <strong className={theme1.textAccentClass}>{cand1.ballot_name}</strong> vs.{' '}
                Linha <strong className={theme2.textAccentClass}>{cand2.ballot_name}</strong> (% dos votos válidos ao longo da contagem)
              </span>
            )}
            <span>
              Maior diferença registrada: {formatPP(maxAbsMargin)}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
