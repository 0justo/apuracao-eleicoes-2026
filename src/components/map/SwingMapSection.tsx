import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  Grid,
  Info,
  Layers,
  Map as MapIcon,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import type { SimulationStage } from '../../hooks/useElectionSnapshot'
import type { DisputeSnapshot, LocalityDataItem } from '../../types/election'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import { formatPct, formatSignedPP } from '../../utils/formatters'
import {
  type DecodedGeoFeature,
  decodeTopoJSON,
  getDivergentSwingFill,
  getLiveLeaderFill,
  type MapMetricMode,
  type TopoJSONTopology,
} from '../../utils/geoProjection'
import { GeoChoroplethMap } from './GeoChoroplethMap'
import { LocalityDetailSheet } from './LocalityDetailSheet'
import { TileGridMap } from './TileGridMap'

interface SwingMapSectionProps {
  snapshot: DisputeSnapshot
  stage: SimulationStage
  isDark: boolean
}

interface MunIndexEntry {
  c: string // code_tse
  i: string // code_ibge
  n: string // name
  u: string // uf
}

function normalizeSearchText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function SwingMapSection({
  snapshot,
  stage,
  isDark,
}: SwingMapSectionProps) {
  const [cand1, cand2] = snapshot.candidates
  const [theme1, theme2] = getDisputePairThemes(cand1, cand2)
  const cand1Hex = isDark ? theme1.hexDark : theme1.hexLight
  const cand2Hex = isDark ? theme2.hexDark : theme2.hexLight
  const isPresidential = snapshot.cargo_code === '1'

  // Modo principal de métrica: 'live_2t' ("Ao Vivo 2º Turno", padrão) ou 'swing_1t' ("Variação vs. 1º Turno")
  const [metricMode, setMetricMode] = useState<MapMetricMode>('live_2t')

  // Modo de visualização em Presidente: 'geo' (mapa geográfico IBGE) ou 'tile' (grade de quadrados)
  const [mapMode, setMapMode] = useState<'geo' | 'tile'>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('mapMode') === 'tile' ? 'tile' : 'geo'
  })

  // Perspectiva numérica exibida nos rótulos (1 = Candidato 1, 2 = Candidato 2)
  const [perspectiveSlot, setPerspectiveSlot] = useState<1 | 2>(1)

  // Em Presidente: null = visão Brasil por UF; 'SP'/'AC'/etc. = zoom nos municípios daquela UF.
  // Em Governador: abre direto no mapa municipal do estado (snapshot.uf).
  const [zoomedUf, setZoomedUf] = useState<string | null>(() => {
    if (!isPresidential) return snapshot.uf.toUpperCase()
    const params = new URLSearchParams(window.location.search)
    const qUf = params.get('zoomUf')
    return qUf ? qUf.toUpperCase() : null
  })

  // Malhas TopoJSON decodificadas (Brasil UFs e Municípios do estado ativo)
  const [ufFeatures, setUfFeatures] = useState<DecodedGeoFeature[]>([])
  const [munFeatures, setMunFeatures] = useState<DecodedGeoFeature[]>([])
  const [presMunLocalities, setPresMunLocalities] = useState<
    LocalityDataItem[]
  >([])
  const [munIndex, setMunIndex] = useState<MunIndexEntry[]>([])
  const [loadingGeo, setLoadingGeo] = useState<boolean>(false)
  const loadedGeoUfRef = useRef<string | null>(null)
  const pendingFocusCodeRef = useRef<string | null>(null)

  // Renderizador: SVG vetorial por padrão para permitir zoom suave por viewBox
  const [renderOverride, setRenderOverride] = useState<'auto' | 'svg' | 'canvas'>('svg')

  // Local selecionado no cartão inferior, código focado com zoom e busca
  const [selectedCode, setSelectedCode] = useState<string | null>(() => {
    return (
      snapshot.highlighted_locality_code ??
      snapshot.localities[0]?.code_tse ??
      null
    )
  })
  const [focusedCode, setFocusedCode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const prevDisputeIdRef = useRef<string>(snapshot.dispute_id)

  // Sincroniza APENAS quando a disputa (cargo/UF) muda — NUNCA reseta durante o polling!
  useEffect(() => {
    if (prevDisputeIdRef.current === snapshot.dispute_id) {
      return
    }
    prevDisputeIdRef.current = snapshot.dispute_id

    if (isPresidential) {
      const params = new URLSearchParams(window.location.search)
      const qUf = params.get('zoomUf')
      setZoomedUf(qUf ? qUf.toUpperCase() : null)
      if (!qUf) setPresMunLocalities([])
    } else {
      setZoomedUf(snapshot.uf.toUpperCase())
    }
    setSelectedCode(
      snapshot.highlighted_locality_code ??
        snapshot.localities[0]?.code_tse ??
        null,
    )
    setFocusedCode(null)
    setSearchQuery('')
  }, [
    snapshot.dispute_id,
    snapshot.uf,
    isPresidential,
    snapshot.highlighted_locality_code,
    snapshot.localities,
  ])

  // Carrega malha nacional de UFs (br-ufs.topo.json) e índice nacional de municípios uma única vez
  useEffect(() => {
    let active = true
    const loadStaticGeo = async () => {
      try {
        const [ufRes, idxRes] = await Promise.all([
          fetch('/geo/br-ufs.topo.json'),
          fetch('/geo/mun-index.json'),
        ])
        if (!active) return
        if (ufRes.ok) {
          const topo = (await ufRes.json()) as TopoJSONTopology
          if (active) setUfFeatures(decodeTopoJSON(topo, 'ufs'))
        }
        if (idxRes.ok) {
          const idxData = (await idxRes.json()) as MunIndexEntry[]
          if (active) setMunIndex(idxData)
        }
      } catch {
        // Ignora erro de rede
      }
    }
    void loadStaticGeo()
    return () => {
      active = false
    }
  }, [])

  // Carrega malha municipal (<uf>-mun.topo.json) e dados municipais da UF sob demanda sem piscar no polling
  useEffect(() => {
    if (!zoomedUf || zoomedUf === 'BR' || zoomedUf === 'ZZ') {
      setMunFeatures([])
      loadedGeoUfRef.current = null
      return
    }

    let active = true
    const ufUpper = zoomedUf.toUpperCase()
    const ufLower = zoomedUf.toLowerCase()
    const needNewGeo = loadedGeoUfRef.current !== ufUpper
    if (needNewGeo) {
      setLoadingGeo(true)
    }

    const loadMunicipalData = async () => {
      try {
        const geoPromise = needNewGeo
          ? fetch(`/geo/mun/${ufLower}-mun.topo.json`)
          : Promise.resolve(null)
        const basePrefix =
          stage === 'live' ? '/snapshots' : `/snapshots/stages/${stage}`
        const munDataPromise = isPresidential
          ? fetch(`${basePrefix}/presidente/mun/${ufLower}.json`)
          : Promise.resolve(null)

        const [geoRes, munRes] = await Promise.all([geoPromise, munDataPromise])
        if (!active) return

        if (geoRes && geoRes.ok) {
          const topo = (await geoRes.json()) as TopoJSONTopology
          setMunFeatures(decodeTopoJSON(topo, 'municipios'))
          loadedGeoUfRef.current = ufUpper
        }

        if (isPresidential && munRes && munRes.ok) {
          const payload = (await munRes.json()) as {
            localities: LocalityDataItem[]
          }
          const list = payload.localities ?? []
          setPresMunLocalities(list)
          if (pendingFocusCodeRef.current) {
            const targetCode = pendingFocusCodeRef.current
            pendingFocusCodeRef.current = null
            setSelectedCode(targetCode)
            setFocusedCode(targetCode)
          } else if (needNewGeo) {
            const capitalOrFirst =
              list.find((l) => l.is_capital) ?? list[0]
            if (capitalOrFirst) {
              setSelectedCode(capitalOrFirst.code_tse)
            }
          }
        } else if (!isPresidential && pendingFocusCodeRef.current) {
          const targetCode = pendingFocusCodeRef.current
          pendingFocusCodeRef.current = null
          setSelectedCode(targetCode)
          setFocusedCode(targetCode)
        }
      } catch {
        // Fallback silencioso
      } finally {
        if (active && needNewGeo) setLoadingGeo(false)
      }
    }

    void loadMunicipalData()
    return () => {
      active = false
    }
  }, [zoomedUf, isPresidential, stage])

  const activeScope: 'uf' | 'mu' = zoomedUf ? 'mu' : 'uf'
  const activeLocalities: LocalityDataItem[] = useMemo(() => {
    if (isPresidential && zoomedUf && presMunLocalities.length > 0) {
      return presMunLocalities
    }
    return snapshot.localities
  }, [isPresidential, zoomedUf, presMunLocalities, snapshot.localities])

  const activeFeatures = activeScope === 'uf' ? ufFeatures : munFeatures

  const effectiveRenderMode: 'svg' | 'canvas' =
    renderOverride === 'auto'
      ? activeFeatures.length > 900
        ? 'canvas'
        : 'svg'
      : renderOverride

  const selectedLocality: LocalityDataItem | null = useMemo(() => {
    if (activeLocalities.length === 0) return null
    if (selectedCode) {
      const found = activeLocalities.find(
        (l) =>
          l.code_tse.toUpperCase() === selectedCode.toUpperCase() ||
          (activeScope === 'uf' &&
            l.uf.toUpperCase() === selectedCode.toUpperCase()),
      )
      if (found) return found
    }
    return (
      activeLocalities.find(
        (l) => l.code_tse === snapshot.highlighted_locality_code,
      ) ?? activeLocalities[0]
    )
  }, [
    activeLocalities,
    selectedCode,
    activeScope,
    snapshot.highlighted_locality_code,
  ])

  // Resultados combinados de busca: localidades ativas + municípios do índice nacional (quando em visão Brasil)
  const searchResults = useMemo(() => {
    const q = normalizeSearchText(searchQuery)
    if (!q) return []

    const localMatches = activeLocalities
      .filter((l) => {
        const n = normalizeSearchText(l.name)
        const u = normalizeSearchText(l.uf)
        return (
          n.includes(q) ||
          u === q ||
          l.code_tse.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const na = normalizeSearchText(a.name)
        const nb = normalizeSearchText(b.name)
        const ua = normalizeSearchText(a.uf)
        const ub = normalizeSearchText(b.uf)
        const exactA = na === q || ua === q ? 0 : na.startsWith(q) ? 1 : 2
        const exactB = nb === q || ub === q ? 0 : nb.startsWith(q) ? 1 : 2
        return exactA - exactB
      })
      .slice(0, 6)
      .map((l) => ({
        code_tse: l.code_tse,
        name: l.name,
        uf: l.uf,
        pct_counted: l.pct_counted as number | null,
        scope: activeScope,
      }))

    if (activeScope === 'uf' && isPresidential && q.length >= 2 && munIndex.length > 0) {
      const munMatches = munIndex
        .filter((m) => normalizeSearchText(m.n).includes(q))
        .sort((a, b) => {
          const na = normalizeSearchText(a.n)
          const nb = normalizeSearchText(b.n)
          const scoreA = na === q ? 0 : na.startsWith(q) ? 1 : 2
          const scoreB = nb === q ? 0 : nb.startsWith(q) ? 1 : 2
          return scoreA - scoreB
        })
        .slice(0, 6)
        .map((m) => ({
          code_tse: m.c,
          name: m.n,
          uf: m.u,
          pct_counted: null as number | null,
          scope: 'mu' as const,
        }))

      return [...localMatches, ...munMatches].slice(0, 8)
    }

    return localMatches
  }, [activeLocalities, activeScope, isPresidential, munIndex, searchQuery])

  // Auto-zoom imediato na localidade correspondente ao digitar no campo de busca
  const handleSearchChange = useCallback(
    (rawVal: string) => {
      setSearchQuery(rawVal)
      const q = normalizeSearchText(rawVal)
      if (!q) {
        setFocusedCode(null)
        return
      }
      if (q.length < 2) return

      // Procura correspondência direta nas localidades ativas (UFs ou municípios do estado aberto)
      const scored = activeLocalities
        .map((l) => {
          const n = normalizeSearchText(l.name)
          const u = normalizeSearchText(l.uf)
          let rank = 99
          if (u === q || n === q) rank = 0
          else if (n.startsWith(q)) rank = 1
          else if (n.includes(q)) rank = 2
          return { loc: l, rank }
        })
        .filter((item) => item.rank < 99)
        .sort((a, b) => a.rank - b.rank)

      if (scored.length > 0) {
        const best = scored[0].loc
        setSelectedCode(best.code_tse)
        setFocusedCode(activeScope === 'uf' ? best.uf : best.code_tse)
        if (mapMode === 'tile') {
          setMapMode('geo')
        }
        return
      }

      // Se estiver na visão nacional de Presidente e digitou o nome exato/prefixo claro de um município brasileiro,
      // abre automaticamente o estado correspondente e dá zoom no município!
      if (activeScope === 'uf' && isPresidential && q.length >= 4 && munIndex.length > 0) {
        const exactMun = munIndex.find((m) => normalizeSearchText(m.n) === q)
        if (exactMun) {
          pendingFocusCodeRef.current = exactMun.c
          setMapMode('geo')
          setZoomedUf(exactMun.u.toUpperCase())
        }
      }
    },
    [activeLocalities, activeScope, isPresidential, mapMode, munIndex],
  )

  const handleSelectSearchResult = useCallback(
    (item: {
      code_tse: string
      name: string
      uf: string
      scope: 'uf' | 'mu'
    }) => {
      setMapMode('geo')
      if (isPresidential && item.scope === 'mu' && zoomedUf !== item.uf.toUpperCase()) {
        pendingFocusCodeRef.current = item.code_tse
        setZoomedUf(item.uf.toUpperCase())
      } else {
        setSelectedCode(item.code_tse)
        setFocusedCode(item.scope === 'uf' ? item.uf : item.code_tse)
      }
      setSearchQuery(item.name)
    },
    [isPresidential, zoomedUf],
  )

  const handleZoomToUf = useCallback((uf: string) => {
    const ufUpper = uf.toUpperCase()
    if (ufUpper === 'ZZ' || ufUpper === 'BR') return
    setZoomedUf(ufUpper)
    setFocusedCode(null)
    setSearchQuery('')
  }, [])

  const handleBackToBrazil = useCallback(() => {
    setZoomedUf(null)
    setPresMunLocalities([])
    setFocusedCode(null)
    setSelectedCode(
      snapshot.highlighted_locality_code ??
        snapshot.localities[0]?.code_tse ??
        null,
    )
    setSearchQuery('')
  }, [snapshot.highlighted_locality_code, snapshot.localities])

  const highlightedLoc = useMemo(
    () =>
      activeLocalities.find(
        (l) =>
          l.code_tse === snapshot.highlighted_locality_code ||
          l.changed_in_last_cycle,
      ) ?? null,
    [activeLocalities, snapshot.highlighted_locality_code],
  )

  return (
    <section
      aria-label="Mapa de apuração ao vivo e variação em relação ao 1º turno"
      data-testid="swing-map-section"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-[#1F1F24] dark:bg-[#0A0A0C]"
    >
      {/* Cabeçalho da seção e controles de visão */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3.5 lg:flex-row lg:items-center lg:justify-between dark:border-[#1F1F24]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MapIcon
              className="h-5 w-5 text-slate-700 dark:text-slate-300"
              aria-hidden="true"
            />
            <h2 className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">
              {metricMode === 'live_2t'
                ? 'Mapa de Apuração ao Vivo — 2º Turno'
                : 'Mapa de Variação vs. 1º Turno (p.p.)'}
            </h2>

            {/* Ícone ⓘ discreto com Tooltip dinâmico */}
            <div className="group relative inline-flex items-center">
              <button
                type="button"
                className="rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300"
                aria-label="Informações sobre o mapa"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-72 rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">
                <p className="font-medium text-white">Cartografia Oficial IBGE</p>
                <p className="mt-1 text-slate-300">
                  {metricMode === 'live_2t'
                    ? 'Colorida pela liderança atual no 2º turno em cada localidade. Locais com menos de 30% apurado exibem hachura visual de baixa confiabilidade amostral.'
                    : 'Diferença em pontos percentuais entre o 2º turno atual e o 1º turno de 2026. Locais com menos de 30% apurado exibem hachura.'}
                </p>
              </div>
            </div>

            {zoomedUf && (
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                Municípios de {zoomedUf} ({activeLocalities.length})
              </span>
            )}
          </div>
        </div>

        {/* Seletor Principal de Modo no Topo do Mapa: Ao Vivo (2º Turno) vs Variação vs. 1º Turno */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Modo de métrica do mapa"
            className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]"
          >
            <button
              type="button"
              data-testid="map-metric-live-btn"
              aria-pressed={metricMode === 'live_2t'}
              onClick={() => setMetricMode('live_2t')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                metricMode === 'live_2t'
                  ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Ao Vivo (2º Turno)
            </button>
            <button
              type="button"
              data-testid="map-metric-swing-btn"
              aria-pressed={metricMode === 'swing_1t'}
              onClick={() => setMetricMode('swing_1t')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                metricMode === 'swing_1t'
                  ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
              Variação vs. 1º Turno
            </button>
          </div>

          {isPresidential && zoomedUf && (
            <button
              type="button"
              data-testid="back-to-brazil-btn"
              onClick={handleBackToBrazil}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar ao Brasil
            </button>
          )}

          {isPresidential && !zoomedUf && (
            <div
              role="group"
              aria-label="Modo de visualização do mapa nacional"
              className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-[#1F1F24] dark:bg-[#0F0F12]"
            >
              <button
                type="button"
                data-testid="map-mode-geo-btn"
                aria-pressed={mapMode === 'geo'}
                onClick={() => setMapMode('geo')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  mapMode === 'geo'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Mapa IBGE
              </button>
              <button
                type="button"
                data-testid="map-mode-tile-btn"
                aria-pressed={mapMode === 'tile'}
                onClick={() => setMapMode('tile')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  mapMode === 'tile'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Grid className="h-3.5 w-3.5" aria-hidden="true" />
                Grade (UF)
              </button>
            </div>
          )}

          {/* Alternador de motor SVG / Canvas no zoom municipal */}
          {activeScope === 'mu' && (
            <button
              type="button"
              data-testid="toggle-render-engine-btn"
              onClick={() =>
                setRenderOverride((prev) =>
                  prev === 'canvas' ||
                  (prev === 'auto' && effectiveRenderMode === 'canvas')
                    ? 'svg'
                    : 'canvas',
                )
              }
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              title="Alternar renderizador gráfico entre SVG e HTML5 Canvas"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Motor: {effectiveRenderMode.toUpperCase()}
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca de Município/UF com Auto-Zoom + Seletor de Perspectiva */}
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Busca de localidade com zoom automático */}
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            data-testid="map-locality-search-input"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults.length > 0) {
                e.preventDefault()
                handleSelectSearchResult(searchResults[0])
              }
            }}
            placeholder={
              activeScope === 'uf'
                ? 'Pesquisar estado ou município (zoom automático)...'
                : `Pesquisar município em ${zoomedUf} (zoom automático)...`
            }
            aria-label="Buscar localidade no mapa com zoom automático"
            className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pr-8 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-[#1F1F24] dark:bg-[#0F0F12] dark:text-slate-100 dark:focus:border-white"
          />
          {(searchQuery || focusedCode) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setFocusedCode(null)
              }}
              aria-label="Limpar busca e redefinir zoom"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {/* Lista suspensa de resultados da busca */}
          {searchResults.length > 0 && (
            <ul
              data-testid="map-search-results"
              className="absolute z-30 mt-1 max-h-56 w-full divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:divide-[#1F1F24] dark:border-[#1F1F24] dark:bg-[#0A0A0C]"
            >
              {searchResults.map((item) => (
                <li key={`${item.scope}-${item.code_tse}`}>
                  <button
                    type="button"
                    onClick={() => handleSelectSearchResult(item)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {item.name}{' '}
                      <span className="text-slate-500">({item.uf})</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {item.pct_counted !== null
                        ? `${formatPct(item.pct_counted, 0)} apurado`
                        : 'Zoom no município'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Alternador de perspectiva de candidato */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Perspectiva:
          </span>
          <button
            type="button"
            onClick={() => setPerspectiveSlot(1)}
            aria-pressed={perspectiveSlot === 1}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              perspectiveSlot === 1
                ? `${theme1.badgeClass} border-transparent shadow-2xs`
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${theme1.dotClass} ring-1 ring-white/70`}
              aria-hidden="true"
            />
            {cand1.ballot_name}
          </button>
          <button
            type="button"
            onClick={() => setPerspectiveSlot(2)}
            aria-pressed={perspectiveSlot === 2}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              perspectiveSlot === 2
                ? `${theme2.badgeClass} border-transparent shadow-2xs`
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${theme2.dotClass} ring-1 ring-white/70`}
              aria-hidden="true"
            />
            {cand2.ballot_name}
          </button>
        </div>
      </div>

      {/* Destaque breve do local que mais mudou no último ciclo */}
      {highlightedLoc && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/80 bg-amber-50/70 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles
              className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            Maior avanço recente na apuração:{' '}
            <strong>
              {highlightedLoc.name} ({highlightedLoc.uf})
            </strong>{' '}
            (+{formatPct(highlightedLoc.delta_pct_counted_last_cycle)} de urnas
            no ciclo · {formatPct(highlightedLoc.pct_counted)} apurado)
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedCode(highlightedLoc.code_tse)
              setFocusedCode(
                activeScope === 'uf'
                  ? highlightedLoc.uf
                  : highlightedLoc.code_tse,
              )
            }}
            className="font-semibold underline hover:text-amber-800 dark:hover:text-amber-100"
          >
            Focar no mapa
          </button>
        </div>
      )}

      {/* Legenda Sempre Visível (adapta entre Ao Vivo 2º Turno e Variação vs. 1º Turno) */}
      <div
        data-testid="swing-map-legend"
        aria-label="Legenda cromática do mapa eleitoral"
        className="mt-3 rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 text-[11px] dark:border-[#1F1F24] dark:bg-[#0F0F12]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`font-bold ${theme2.textAccentClass}`}>
            ◄{' '}
            {metricMode === 'live_2t'
              ? `Mais votos no 2ºT: ${cand2.ballot_name} (${cand2.party_acronym})`
              : `Maior avanço vs. 1ºT: ${cand2.ballot_name} (${cand2.party_acronym})`}
          </span>
          <span className="font-medium text-slate-600 dark:text-slate-400">
            {metricMode === 'live_2t'
              ? 'Equilíbrio (50% / 50%)'
              : 'Centro Neutro (0,00 p.p.)'}
          </span>
          <span className={`font-bold ${theme1.textAccentClass}`}>
            {metricMode === 'live_2t'
              ? `Mais votos no 2ºT: ${cand1.ballot_name} (${cand1.party_acronym})`
              : `Maior avanço vs. 1ºT: ${cand1.ballot_name} (${cand1.party_acronym})`}{' '}
            ►
          </span>
        </div>

        {metricMode === 'live_2t' ? (
          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {[
              { c1: 35, c2: 65, label: '65%' },
              { c1: 42, c2: 58, label: '58%' },
              { c1: 47, c2: 53, label: '53%' },
              { c1: 50, c2: 50, label: '50/50' },
              { c1: 53, c2: 47, label: '53%' },
              { c1: 58, c2: 42, label: '58%' },
              { c1: 65, c2: 35, label: '65%' },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-0.5">
                <span
                  className="h-3 w-full rounded-xs border border-slate-300/80 dark:border-slate-700"
                  style={{
                    backgroundColor: getLiveLeaderFill(
                      item.c1,
                      item.c2,
                      100,
                      isDark,
                      cand1Hex,
                      cand2Hex,
                    ),
                  }}
                />
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {[-3, -2, -1, 0, 1, 2, 3].map((step) => (
              <div key={step} className="flex flex-col items-center gap-0.5">
                <span
                  className="h-3 w-full rounded-xs border border-slate-300/80 dark:border-slate-700"
                  style={{
                    backgroundColor: getDivergentSwingFill(
                      step,
                      isDark,
                      3.0,
                      cand1Hex,
                      cand2Hex,
                    ),
                  }}
                />
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {step === 0 ? '0 p.p.' : `${step > 0 ? '+' : ''}${step} p.p.`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-1.5 text-[10px] text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="low-reliability-hatch inline-block h-3 w-5 rounded-xs border border-dashed border-slate-400 bg-slate-200 dark:bg-slate-700"
              aria-hidden="true"
            />
            Hachura / tracejado: local com{' '}
            <strong>&lt;30% das urnas apuradas</strong> (baixa confiabilidade)
          </span>
          <span>
            Malha oficial IBGE · Transição suave (420 ms) a cada ciclo
          </span>
        </div>
      </div>

      {/* Área do Mapa (Largura total no celular, sem sobreposição com o cartão fixo abaixo) */}
      <div className="mt-3">
        {loadingGeo ? (
          <div className="flex h-72 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            Carregando malha municipal oficial do IBGE ({zoomedUf})...
          </div>
        ) : activeScope === 'uf' && mapMode === 'tile' ? (
          <TileGridMap
            localities={activeLocalities}
            selectedCode={selectedLocality?.code_tse ?? null}
            highlightedCode={snapshot.highlighted_locality_code}
            metricMode={metricMode}
            perspectiveSlot={perspectiveSlot}
            isDark={isDark}
            cand1Hex={cand1Hex}
            cand2Hex={cand2Hex}
            onSelectLocality={(loc) => setSelectedCode(loc.code_tse)}
            onZoomToUf={handleZoomToUf}
          />
        ) : (
          <GeoChoroplethMap
            features={activeFeatures}
            localities={activeLocalities}
            scope={activeScope}
            selectedCode={selectedLocality?.code_tse ?? null}
            highlightedCode={snapshot.highlighted_locality_code}
            focusedCode={focusedCode}
            metricMode={metricMode}
            perspectiveSlot={perspectiveSlot}
            isDark={isDark}
            renderMode={effectiveRenderMode}
            cand1Hex={cand1Hex}
            cand2Hex={cand2Hex}
            cand1Name={cand1.ballot_name}
            cand2Name={cand2.ballot_name}
            onSelectLocality={(loc) => setSelectedCode(loc.code_tse)}
            onZoomToUf={isPresidential ? handleZoomToUf : undefined}
            onResetFocus={() => {
              setFocusedCode(null)
              setSearchQuery('')
            }}
          />
        )}
      </div>

      {/* Cartão Fixo na Parte de Baixo da Seção com os Detalhes da Localidade Selecionada */}
      <div className="mt-3">
        <LocalityDetailSheet
          locality={selectedLocality}
          candidates={snapshot.candidates}
          canZoomToMunicipalities={isPresidential && activeScope === 'uf'}
          onZoomToUf={handleZoomToUf}
        />
      </div>

      {/* Em modo municipal com muitos municípios, mostra pílulas rápidas das principais cidades para toque fácil */}
      {activeScope === 'mu' && activeLocalities.length > 1 && (
        <div className="mt-3 border-t border-slate-200 pt-2.5 dark:border-[#1F1F24]">
          <p className="mb-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Acesso rápido aos municípios com maior eleitorado em {zoomedUf}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...activeLocalities]
              .sort((a, b) => b.total_electorate - a.total_electorate)
              .slice(0, 8)
              .map((m) => {
                const isSel = selectedLocality?.code_tse === m.code_tse
                const rawSwing =
                  perspectiveSlot === 1 ? m.cand1_swing_pp : m.cand2_swing_pp
                const livePct =
                  perspectiveSlot === 1 ? m.cand1_pct_2t : m.cand2_pct_2t
                return (
                  <button
                    key={m.code_tse}
                    type="button"
                    data-testid={`quick-mun-pill-${m.code_tse}`}
                    onClick={() => {
                      setSelectedCode(m.code_tse)
                      setFocusedCode(m.code_tse)
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                      isSel
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <span>{m.name}</span>
                    <span className="font-mono text-[10px] opacity-80">
                      {metricMode === 'live_2t'
                        ? livePct !== null
                          ? formatPct(livePct, 1)
                          : '0%'
                        : rawSwing !== null
                          ? formatSignedPP(rawSwing)
                          : '0%'}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </section>
  )
}
