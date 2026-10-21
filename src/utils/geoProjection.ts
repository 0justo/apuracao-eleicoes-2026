/**
 * Utilitário de decodificação TopoJSON 3.0 (malhas oficiais do IBGE), projeção cartográfica
 * Mercator (padrão d3-geo) para SVG e HTML5 Canvas, e escalas de cores temáticas por candidato/partido:
 * 1. "Ao Vivo (2º Turno)" (liderança atual no 2º turno por UF/Município)
 * 2. "Variação vs. 1º Turno" (diferença em pontos percentuais 1ºT → 2ºT)
 */

export type MapMetricMode = 'live_2t' | 'swing_1t'

export interface TopoJSONTopology {
  type: 'Topology'
  bbox?: [number, number, number, number]
  transform?: {
    scale: [number, number]
    translate: [number, number]
  }
  objects: Record<
    string,
    {
      type: 'GeometryCollection'
      geometries: Array<{
        type: 'Polygon' | 'MultiPolygon'
        id?: string | number
        properties?: Record<string, unknown>
        arcs: number[][] | number[][][]
      }>
    }
  >
  arcs: number[][][]
}

export interface DecodedGeoFeature {
  id: string
  properties: Record<string, unknown>
  rings: Array<Array<[number, number]>>
  bbox: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  centroid: [number, number] // [lon, lat]
}

function mercatorY(latDeg: number): number {
  const clamped = Math.max(-85, Math.min(85, latDeg))
  const rad = (clamped * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

function computePolygonRingCentroidAndArea(
  ring: Array<[number, number]>,
): { centroid: [number, number]; absArea: number } {
  if (ring.length < 3) {
    const p = ring[0] ?? [0, 0]
    return { centroid: [p[0], p[1]], absArea: 0 }
  }
  let signedArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    const cross = x0 * y1 - x1 * y0
    signedArea += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  const area = signedArea / 2
  if (Math.abs(area) < 1e-9) {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return {
      centroid: [(minX + maxX) / 2, (minY + maxY) / 2],
      absArea: (maxX - minX) * (maxY - minY),
    }
  }
  return {
    centroid: [cx / (6 * area), cy / (6 * area)],
    absArea: Math.abs(area),
  }
}

export function decodeTopoJSON(
  topology: TopoJSONTopology,
  objectName?: string,
): DecodedGeoFeature[] {
  const key = objectName ?? Object.keys(topology.objects)[0]
  const obj = topology.objects[key]
  if (!obj || obj.type !== 'GeometryCollection') {
    return []
  }

  const scale = topology.transform?.scale ?? [1, 1]
  const translate = topology.transform?.translate ?? [0, 0]

  const decodedArcs: Array<Array<[number, number]>> = topology.arcs.map(
    (arc) => {
      let x = 0
      let y = 0
      return arc.map(([dx, dy]) => {
        x += dx
        y += dy
        return [x * scale[0] + translate[0], y * scale[1] + translate[1]]
      })
    },
  )

  const stitchRing = (arcIndices: number[]): Array<[number, number]> => {
    const pts: Array<[number, number]> = []
    for (const idx of arcIndices) {
      const arc =
        idx >= 0
          ? decodedArcs[idx]
          : [...(decodedArcs[~idx] ?? [])].reverse()
      if (!arc) continue
      for (let i = 0; i < arc.length; i++) {
        if (pts.length > 0 && i === 0) continue
        pts.push(arc[i])
      }
    }
    return pts
  }

  return obj.geometries.map((geom, idx) => {
    const rings: Array<Array<[number, number]>> = []
    if (geom.type === 'Polygon') {
      for (const ringArcs of geom.arcs as number[][]) {
        rings.push(stitchRing(ringArcs))
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const polyArcs of geom.arcs as number[][][]) {
        for (const ringArcs of polyArcs) {
          rings.push(stitchRing(ringArcs))
        }
      }
    }

    let minLon = Infinity
    let minLat = Infinity
    let maxLon = -Infinity
    let maxLat = -Infinity
    let bestRingCentroid: [number, number] | null = null
    let bestRingArea = -1

    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
      const { centroid: rc, absArea } = computePolygonRingCentroidAndArea(ring)
      if (absArea > bestRingArea) {
        bestRingArea = absArea
        bestRingCentroid = rc
      }
    }

    const centroid: [number, number] = bestRingCentroid ?? [
      (minLon + maxLon) / 2,
      (minLat + maxLat) / 2,
    ]

    return {
      id: String(geom.id ?? idx),
      properties: (geom.properties ?? {}) as Record<string, unknown>,
      rings,
      bbox: [minLon, minLat, maxLon, maxLat],
      centroid,
    }
  })
}

export interface ProjectedFeature {
  id: string
  properties: Record<string, unknown>
  svgPath: string
  projectedRings: Array<Array<[number, number]>>
  centroidPx: [number, number]
  bboxPx: [number, number, number, number]
}

export function projectFeaturesMercator(
  features: DecodedGeoFeature[],
  width: number,
  height: number,
  padding = 18,
): ProjectedFeature[] {
  if (features.length === 0) return []

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const f of features) {
    const [lon0, lat0, lon1, lat1] = f.bbox
    const x0 = (lon0 * Math.PI) / 180
    const x1 = (lon1 * Math.PI) / 180
    const y0 = mercatorY(lat0)
    const y1 = mercatorY(lat1)
    if (x0 < minX) minX = x0
    if (x1 > maxX) maxX = x1
    if (y0 < minY) minY = y0
    if (y1 > maxY) maxY = y1
  }

  const spanX = Math.max(1e-5, maxX - minX)
  const spanY = Math.max(1e-5, maxY - minY)
  const availW = Math.max(10, width - padding * 2)
  const availH = Math.max(10, height - padding * 2)
  const k = Math.min(availW / spanX, availH / spanY)

  const offsetX = padding + (availW - spanX * k) / 2
  const offsetY = padding + (availH - spanY * k) / 2

  const projectPoint = (lon: number, lat: number): [number, number] => {
    const mx = (lon * Math.PI) / 180
    const my = mercatorY(lat)
    const px = offsetX + (mx - minX) * k
    const py = offsetY + (maxY - my) * k
    return [Number(px.toFixed(1)), Number(py.toFixed(1))]
  }

  return features.map((f) => {
    let minPxX = Infinity
    let minPxY = Infinity
    let maxPxX = -Infinity
    let maxPxY = -Infinity

    const projectedRings = f.rings.map((ring) =>
      ring.map(([lon, lat]) => {
        const [px, py] = projectPoint(lon, lat)
        if (px < minPxX) minPxX = px
        if (px > maxPxX) maxPxX = px
        if (py < minPxY) minPxY = py
        if (py > maxPxY) maxPxY = py
        return [px, py] as [number, number]
      }),
    )

    const pathParts: string[] = []
    for (const ring of projectedRings) {
      if (ring.length === 0) continue
      pathParts.push(`M${ring.map(([x, y]) => `${x},${y}`).join('L')}Z`)
    }

    const centroidPx = projectPoint(f.centroid[0], f.centroid[1])

    return {
      id: f.id,
      properties: f.properties,
      svgPath: pathParts.join(' '),
      projectedRings,
      centroidPx,
      bboxPx: [minPxX, minPxY, maxPxX, maxPxY],
    }
  })
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '').trim()
  if (cleaned.length !== 6) return [220, 38, 38]
  const n = parseInt(cleaned, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Escala divergente por candidato/partido:
 * - Valores positivos (Candidato 1 — ex.: Vermelho #DC2626 / #EF4444 ou cor do partido)
 * - Centro neutro (0,00 p.p. ou sem apuração — Cinza Neutro)
 * - Valores negativos (Candidato 2 — ex.: Azul #1D4ED8 / #3B82F6 ou cor do partido)
 */
export function getDivergentSwingFill(
  cand1SwingPP: number | null,
  isDark: boolean,
  maxAbsPP = 6.0,
  cand1Hex?: string,
  cand2Hex?: string,
): string {
  if (cand1SwingPP === null || Number.isNaN(cand1SwingPP)) {
    return isDark ? '#334155' : '#e2e8f0'
  }

  const ratio = Math.max(-1, Math.min(1, cand1SwingPP / maxAbsPP))
  const intensity = Math.abs(ratio)

  if (intensity < 0.02) {
    return isDark ? '#334155' : '#f1f5f9'
  }

  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
  const neutralRgb: [number, number, number] = isDark
    ? [45, 55, 72]
    : [241, 245, 249]

  if (ratio > 0) {
    const targetHex = cand1Hex || (isDark ? '#EF4444' : '#DC2626')
    const end = hexToRgb(targetHex)
    const t = 0.25 + 0.75 * intensity
    const r = lerp(neutralRgb[0], end[0], t)
    const g = lerp(neutralRgb[1], end[1], t)
    const b = lerp(neutralRgb[2], end[2], t)
    return `rgb(${r}, ${g}, ${b})`
  }

  const targetHex = cand2Hex || (isDark ? '#3B82F6' : '#1D4ED8')
  const end = hexToRgb(targetHex)
  const t = 0.25 + 0.75 * intensity
  const r = lerp(neutralRgb[0], end[0], t)
  const g = lerp(neutralRgb[1], end[1], t)
  const b = lerp(neutralRgb[2], end[2], t)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Escala de liderança ao vivo no 2º turno (Visão Principal Padrão):
 * - Colore a UF ou Município pela vantagem atual (cand1_pct_2t - cand2_pct_2t)
 *   usando a paleta temática de cada candidato/partido.
 */
export function getLiveLeaderFill(
  cand1Pct2t: number,
  cand2Pct2t: number,
  pctCounted: number,
  isDark: boolean,
  cand1Hex?: string,
  cand2Hex?: string,
): string {
  if (pctCounted <= 0 || (cand1Pct2t === 0 && cand2Pct2t === 0)) {
    return isDark ? '#334155' : '#e2e8f0'
  }
  const leadDiffPP = cand1Pct2t - cand2Pct2t
  return getDivergentSwingFill(leadDiffPP, isDark, 22.0, cand1Hex, cand2Hex)
}
