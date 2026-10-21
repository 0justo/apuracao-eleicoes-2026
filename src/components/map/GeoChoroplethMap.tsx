import { useEffect, useMemo, useRef } from 'react'
import type { LocalityDataItem } from '../../types/election'
import { formatPct, formatSignedPP } from '../../utils/formatters'
import {
  type DecodedGeoFeature,
  getDivergentSwingFill,
  getLiveLeaderFill,
  type MapMetricMode,
  type ProjectedFeature,
  projectFeaturesMercator,
} from '../../utils/geoProjection'

interface GeoChoroplethMapProps {
  features: DecodedGeoFeature[]
  localities: LocalityDataItem[]
  scope: 'uf' | 'mu'
  selectedCode: string | null
  highlightedCode: string | null
  focusedCode?: string | null
  metricMode?: MapMetricMode
  perspectiveSlot: 1 | 2
  isDark: boolean
  renderMode: 'svg' | 'canvas'
  cand1Hex?: string
  cand2Hex?: string
  cand1Name?: string
  cand2Name?: string
  onSelectLocality: (loc: LocalityDataItem) => void
  onZoomToUf?: (uf: string) => void
  onResetFocus?: () => void
}

const MAP_WIDTH = 680
const MAP_HEIGHT = 540

function pointInProjectedRing(
  px: number,
  py: number,
  ring: Array<[number, number]>,
): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function GeoChoroplethMap({
  features,
  localities,
  scope,
  selectedCode,
  highlightedCode,
  focusedCode = null,
  metricMode = 'live_2t',
  perspectiveSlot,
  isDark,
  renderMode,
  cand1Hex,
  cand2Hex,
  cand1Name = 'Cand. 1',
  cand2Name = 'Cand. 2',
  onSelectLocality,
  onZoomToUf,
  onResetFocus,
}: GeoChoroplethMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const localityMap = useMemo(() => {
    const m = new Map<string, LocalityDataItem>()
    for (const loc of localities) {
      m.set(loc.code_tse.toUpperCase(), loc)
      m.set(loc.uf.toUpperCase(), loc)
      if (loc.code_ibge) m.set(loc.code_ibge, loc)
    }
    return m
  }, [localities])

  const projected: ProjectedFeature[] = useMemo(
    () => projectFeaturesMercator(features, MAP_WIDTH, MAP_HEIGHT, 22),
    [features],
  )

  const findLocalityForFeature = useMemo(
    () =>
      (feat: ProjectedFeature): LocalityDataItem | undefined => {
        const codeTse = String(feat.properties.code_tse ?? feat.id).toUpperCase()
        const ufProp = String(feat.properties.uf ?? feat.id).toUpperCase()
        const ibgeProp = String(feat.properties.code_ibge ?? '')
        if (scope === 'uf') {
          return localityMap.get(ufProp) ?? localityMap.get(codeTse)
        }
        return localityMap.get(codeTse) ?? localityMap.get(ibgeProp)
      },
    [localityMap, scope],
  )

  const getFeatureFill = useMemo(
    () =>
      (loc: LocalityDataItem | undefined): string => {
        if (metricMode === 'live_2t') {
          return getLiveLeaderFill(
            loc?.cand1_pct_2t ?? 0,
            loc?.cand2_pct_2t ?? 0,
            loc?.pct_counted ?? 0,
            isDark,
            cand1Hex,
            cand2Hex,
          )
        }
        const swingForColor =
          loc?.net_swing_cand1_pp ?? loc?.cand1_swing_pp ?? null
        return getDivergentSwingFill(
          swingForColor,
          isDark,
          2.5,
          cand1Hex,
          cand2Hex,
        )
      },
    [metricMode, isDark, cand1Hex, cand2Hex],
  )

  // Cálculo de caixa de zoom automático quando o usuário pesquisa uma UF ou município
  const zoomViewport = useMemo(() => {
    if (!focusedCode) {
      return {
        vx: 0,
        vy: 0,
        vw: MAP_WIDTH,
        vh: MAP_HEIGHT,
        scale: 1,
        isZoomed: false,
      }
    }
    const norm = focusedCode.toUpperCase()
    const target = projected.find((feat) => {
      const codeTse = String(feat.properties.code_tse ?? feat.id).toUpperCase()
      const ufProp = String(feat.properties.uf ?? feat.id).toUpperCase()
      const ibgeProp = String(feat.properties.code_ibge ?? '').toUpperCase()
      return (
        (scope === 'uf' && ufProp === norm) ||
        codeTse === norm ||
        ibgeProp === norm
      )
    })
    if (!target) {
      return {
        vx: 0,
        vy: 0,
        vw: MAP_WIDTH,
        vh: MAP_HEIGHT,
        scale: 1,
        isZoomed: false,
      }
    }
    const [x0, y0, x1, y1] = target.bboxPx
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const aspect = MAP_WIDTH / MAP_HEIGHT
    const minBoxW = scope === 'uf' ? 210 : 140
    const rawW = Math.max((x1 - x0) * 2.8, minBoxW)
    const rawH = Math.max((y1 - y0) * 2.8, minBoxW / aspect)
    const vw = Math.min(MAP_WIDTH, Math.max(rawW, rawH * aspect))
    const vh = vw / aspect
    const vx = Math.max(0, Math.min(MAP_WIDTH - vw, cx - vw / 2))
    const vy = Math.max(0, Math.min(MAP_HEIGHT - vh, cy - vh / 2))
    const scale = MAP_WIDTH / vw
    return { vx, vy, vw, vh, scale, isZoomed: scale > 1.08 }
  }, [focusedCode, projected, scope])

  // Renderização em Canvas 2D (para malhas municipais densas ou quando selecionado)
  useEffect(() => {
    if (renderMode !== 'canvas') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
    ctx.save()
    if (zoomViewport.isZoomed) {
      ctx.scale(zoomViewport.scale, zoomViewport.scale)
      ctx.translate(-zoomViewport.vx, -zoomViewport.vy)
    }

    for (const feat of projected) {
      const loc = findLocalityForFeature(feat)
      const fill = getFeatureFill(loc)
      const isSelected =
        loc &&
        (selectedCode === loc.code_tse ||
          (scope === 'uf' && selectedCode === loc.uf))

      ctx.beginPath()
      for (const ring of feat.projectedRings) {
        ring.forEach(([x, y], idx) => {
          if (idx === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
      }
      ctx.fillStyle = fill
      ctx.fill()

      // Se < 30% apurado, aplica transparência / tracejado
      if (loc?.low_reliability) {
        ctx.save()
        ctx.strokeStyle = isDark
          ? 'rgba(251, 191, 36, 0.55)'
          : 'rgba(180, 83, 9, 0.45)'
        ctx.setLineDash([3 / zoomViewport.scale, 3 / zoomViewport.scale])
        ctx.lineWidth = 1 / zoomViewport.scale
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.strokeStyle = isSelected
          ? isDark
            ? '#ffffff'
            : '#0f172a'
          : isDark
            ? '#0f172a'
            : '#ffffff'
        ctx.lineWidth = (isSelected ? 2.2 : 0.75) / zoomViewport.scale
        ctx.stroke()
      }
    }
    ctx.restore()
  }, [
    renderMode,
    projected,
    findLocalityForFeature,
    getFeatureFill,
    selectedCode,
    highlightedCode,
    isDark,
    scope,
    zoomViewport,
  ])

  const handleCanvasPointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = zoomViewport.vw / rect.width
    const scaleY = zoomViewport.vh / rect.height
    const px = zoomViewport.vx + (e.clientX - rect.left) * scaleX
    const py = zoomViewport.vy + (e.clientY - rect.top) * scaleY

    for (const feat of projected) {
      const [x0, y0, x1, y1] = feat.bboxPx
      if (px < x0 || px > x1 || py < y0 || py > y1) continue
      for (const ring of feat.projectedRings) {
        if (pointInProjectedRing(px, py, ring)) {
          const loc = findLocalityForFeature(feat)
          if (loc) onSelectLocality(loc)
          return
        }
      }
    }
  }

  const viewBoxStr = `${zoomViewport.vx.toFixed(1)} ${zoomViewport.vy.toFixed(1)} ${zoomViewport.vw.toFixed(1)} ${zoomViewport.vh.toFixed(1)}`

  if (renderMode === 'canvas') {
    return (
      <div
        data-testid="geo-choropleth-canvas-wrapper"
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100/50 dark:border-[#1F1F24] dark:bg-[#0F0F12]"
      >
        {zoomViewport.isZoomed && onResetFocus && (
          <button
            type="button"
            data-testid="reset-map-focus-btn"
            onClick={onResetFocus}
            className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
          >
            Redefinir zoom
          </button>
        )}
        <canvas
          ref={canvasRef}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          onClick={handleCanvasPointer}
          className="h-auto w-full cursor-pointer"
          aria-label={
            scope === 'uf'
              ? 'Mapa geográfico por UF em Canvas'
              : 'Mapa geográfico municipal em Canvas'
          }
        />
      </div>
    )
  }

  return (
    <div
      data-testid="geo-choropleth-svg-wrapper"
      className="relative mx-auto w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100/40 dark:border-[#1F1F24] dark:bg-[#0F0F12]"
    >
      {zoomViewport.isZoomed && onResetFocus && (
        <button
          type="button"
          data-testid="reset-map-focus-btn"
          onClick={onResetFocus}
          className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
        >
          Redefinir zoom
        </button>
      )}
      <svg
        viewBox={viewBoxStr}
        role="img"
        aria-label={
          scope === 'uf'
            ? 'Mapa geográfico oficial do IBGE por Unidade da Federação'
            : 'Mapa geográfico oficial do IBGE por município'
        }
        className="h-auto w-full select-none transition-all duration-300"
      >
        <defs>
          {/* Padrão diagonal de hachura para locais com < 30% das urnas apuradas */}
          <pattern
            id="map-low-reliability-hatch"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke={isDark ? '#f8fafc' : '#0f172a'}
              strokeWidth="2"
              strokeOpacity="0.32"
            />
          </pattern>
        </defs>

        <g>
          {projected.map((feat) => {
            const loc = findLocalityForFeature(feat)
            const fillColor = getFeatureFill(loc)
            const isSelected =
              loc &&
              (selectedCode === loc.code_tse ||
                (scope === 'uf' && selectedCode === loc.uf))
            const isHighlighted =
              loc &&
              (highlightedCode === loc.code_tse ||
                (scope === 'uf' && highlightedCode === loc.uf) ||
                loc.changed_in_last_cycle)
            const rawSwing =
              perspectiveSlot === 1
                ? (loc?.cand1_swing_pp ?? null)
                : (loc?.cand2_swing_pp ?? null)
            const codeAttr =
              scope === 'uf'
                ? String(feat.properties.uf ?? feat.id)
                : String(feat.properties.code_tse ?? feat.id)

            const tooltipDetail =
              metricMode === 'live_2t'
                ? `${cand1Name}: ${formatPct(loc?.cand1_pct_2t ?? null)} | ${cand2Name}: ${formatPct(loc?.cand2_pct_2t ?? null)}`
                : `Variação: ${rawSwing !== null ? formatSignedPP(rawSwing) : 'Sem dados'}`

            return (
              <g
                key={feat.id}
                data-testid={`geo-feature-${codeAttr}`}
                onClick={() => {
                  if (loc) onSelectLocality(loc)
                }}
                onDoubleClick={() => {
                  if (scope === 'uf' && loc && loc.uf !== 'ZZ' && onZoomToUf) {
                    onZoomToUf(loc.uf)
                  }
                }}
                className="cursor-pointer"
              >
                <title>
                  {loc
                    ? `${loc.name} (${loc.uf}) — ${formatPct(loc.pct_counted)} apurado | ${tooltipDetail}`
                    : String(feat.properties.name ?? feat.id)}
                </title>
                <path
                  d={feat.svgPath}
                  fill={fillColor}
                  fillOpacity={loc?.low_reliability ? 0.72 : 1}
                  stroke={
                    isSelected
                      ? isDark
                        ? '#ffffff'
                        : '#0f172a'
                      : isHighlighted
                        ? '#f59e0b'
                        : isDark
                          ? '#0f172a'
                          : '#ffffff'
                  }
                  strokeWidth={
                    (isSelected
                      ? 2.4
                      : isHighlighted
                        ? 1.8
                        : scope === 'uf'
                          ? 1.05
                          : 0.55) / Math.pow(zoomViewport.scale, 0.65)
                  }
                  style={{
                    transition:
                      'fill 420ms cubic-bezier(0.22, 1, 0.36, 1), stroke-width 180ms ease',
                  }}
                  className="hover:brightness-105"
                />

                {/* Sobreposição de hachura para locais com < 30% apurado */}
                {loc?.low_reliability && (
                  <path
                    d={feat.svgPath}
                    fill="url(#map-low-reliability-hatch)"
                    pointerEvents="none"
                  />
                )}
              </g>
            )
          })}
        </g>

        {/* Rótulos de sigla das UFs no mapa nacional (ou da capital / selecionado no mapa municipal) */}
        <g pointerEvents="none">
          {projected.map((feat) => {
            const loc = findLocalityForFeature(feat)
            const isSelected =
              loc &&
              (selectedCode === loc.code_tse ||
                (scope === 'uf' && selectedCode === loc.uf))
            if (scope === 'mu' && !loc?.is_capital && !isSelected) {
              return null
            }
            const label =
              scope === 'uf'
                ? String(feat.properties.uf ?? feat.id)
                : String(feat.properties.name ?? '')
            const [cx, cy] = feat.centroidPx
            const fontSize = Math.max(
              5.5,
              10 / Math.pow(zoomViewport.scale, 0.65),
            )
            return (
              <text
                key={`lbl-${feat.id}`}
                x={cx}
                y={cy}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-slate-950 font-sans font-extrabold drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)] dark:fill-white dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              >
                {label}
              </text>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
