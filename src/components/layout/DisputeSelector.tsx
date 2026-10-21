import { useState } from 'react'
import {
  Activity,
  BookOpen,
  Check,
  History,
  Maximize2,
  Minimize2,
  Moon,
  Share2,
  Sun,
} from 'lucide-react'
import type {
  DisputeCatalogItem,
  ElectionCatalogSnapshot,
} from '../../types/election'
import type { SimulationStage } from '../../hooks/useElectionSnapshot'
import type { ThemeMode } from '../../hooks/useTheme'
import { StateFlag } from '../common/StateFlag'
import { getDisputePairThemes } from '../../utils/candidatePalette'
import { formatPct } from '../../utils/formatters'

interface DisputeSelectorProps {
  catalog: ElectionCatalogSnapshot | null
  selectedDisputeId: string
  onSelectDispute: (disputeId: string, routePath: string) => void
  activeView: 'apuracao' | 'metodologia' | 'status'
  onChangeView: (view: 'apuracao' | 'metodologia' | 'status') => void
  theme: ThemeMode
  onToggleTheme: () => void
  stage: SimulationStage
  onChangeStage: (stage: SimulationStage) => void
  isReplayMode: boolean
  onStartReplay: () => void
  onStopReplay: () => void
  isFocusMode?: boolean
  onToggleFocusMode?: () => void
}

const STAGE_OPTIONS: { id: SimulationStage; label: string }[] = [
  { id: '0pct', label: '0% (Pré-17h)' },
  { id: '25pct', label: '25% Apurado' },
  { id: '50tie', label: '50% (Empate)' },
  { id: 'live', label: '65% (Padrão)' },
  { id: '88pct', label: '88% Apurado' },
  { id: '100pct', label: '100% Final' },
]

export function DisputeSelector({
  catalog,
  selectedDisputeId,
  onSelectDispute,
  activeView,
  onChangeView,
  theme,
  onToggleTheme,
  stage,
  onChangeStage,
  isReplayMode,
  onStartReplay,
  onStopReplay,
  isFocusMode = false,
  onToggleFocusMode,
}: DisputeSelectorProps) {
  const [copiedShare, setCopiedShare] = useState(false)

  const disputes: DisputeCatalogItem[] = catalog?.disputes ?? [
    {
      dispute_id: 'presidente',
      cargo_code: '1',
      cargo_name: 'Presidente',
      uf: 'BR',
      uf_name: 'Brasil',
      route_path: '/presidente',
      snapshot_url: '/snapshots/presidente/latest.json',
      pct_counted: 65.0,
      cand1_name: 'LULA',
      cand1_number: '13',
      cand1_pct: 49.1,
      cand2_name: 'FLAVIO BOLSONARO',
      cand2_number: '22',
      cand2_pct: 50.9,
      updated_at_hms: '18:45:22',
      validation_status: 'ok',
    },
  ]

  const currentDispute =
    disputes.find((d) => d.dispute_id === selectedDisputeId) ?? disputes[0]

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${currentDispute.route_path}`
    const shareTitle = `Apuração 2º Turno 2026 — ${
      currentDispute.cargo_code === '1'
        ? 'Presidente (Brasil)'
        : `Governador (${currentDispute.uf})`
    }`
    const shareText = `Acompanhe o que ainda pode mudar na apuração para ${
      currentDispute.cargo_code === '1'
        ? 'Presidente'
        : `Governador de ${currentDispute.uf_name}`
    } (${formatPct(currentDispute.pct_counted)} das urnas apuradas — Fonte: TSE).`

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch {
        // Fallback para copiar link
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedShare(true)
      window.setTimeout(() => setCopiedShare(false), 2500)
    } catch {
      // Ignora erro de clipboard
    }
  }

  return (
    <div className="border-b border-slate-200 bg-white/95 backdrop-blur dark:border-[#1F1F24] dark:bg-[#0A0A0C]/95">
      <div className="mx-auto w-full max-w-[1840px] px-4 py-3 lg:px-6">
        {/* Linha superior: Título do App + Ações Globais */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onChangeView('apuracao')}
              className="text-left focus:outline-none"
            >
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-white">
                Apuração 2º Turno{' '}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  2026
                </span>
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                O que ainda pode mudar nesta apuração? (Domingo, 25/10/2026)
              </p>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onToggleFocusMode && (
              <button
                type="button"
                onClick={onToggleFocusMode}
                data-testid="focus-mode-button"
                aria-pressed={isFocusMode}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  isFocusMode
                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs dark:border-blue-500 dark:bg-blue-500'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Alternar Modo Foco / Tela Cheia (Placar + Mapa + Agente Lex)"
              >
                {isFocusMode ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Sair do Modo Foco
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Modo Foco / Tela Cheia
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onChangeView(
                  activeView === 'metodologia' ? 'apuracao' : 'metodologia',
                )
              }
              aria-current={activeView === 'metodologia' ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                activeView === 'metodologia'
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Metodologia
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeView(activeView === 'status' ? 'apuracao' : 'status')
              }
              aria-current={activeView === 'status' ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                activeView === 'status'
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Status operacional do sistema"
            >
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Status
            </button>

            <button
              type="button"
              onClick={handleShare}
              data-testid="share-dispute-button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Compartilhar esta disputa"
            >
              {copiedShare ? (
                <>
                  <Check
                    className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  Link copiado!
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Compartilhar
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              data-testid="theme-toggle-button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label={
                theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'
              }
              title={
                theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'
              }
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Seletor de Disputa: Presidente + Governadores descobertos na configuração oficial do TSE */}
        <nav
          aria-label="Seletor de disputa (Presidente e Governadores em 2º turno)"
          className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
        >
          {disputes.map((item) => {
            const isSelected =
              item.dispute_id === selectedDisputeId && !isReplayMode
            const [t1, t2] = getDisputePairThemes(
              { number: item.cand1_number, ballot_name: item.cand1_name },
              { number: item.cand2_number, ballot_name: item.cand2_name },
            )
            const label =
              item.cargo_code === '1'
                ? 'Presidente (BR)'
                : `Gov. ${item.uf} (${item.uf_name})`
            return (
              <button
                key={item.dispute_id}
                type="button"
                data-testid={`dispute-tab-${item.dispute_id}`}
                aria-pressed={isSelected}
                onClick={() => {
                  if (isReplayMode) onStopReplay()
                  onChangeView('apuracao')
                  onSelectDispute(item.dispute_id, item.route_path)
                }}
                className={`group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-500 ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <StateFlag
                    uf={item.uf}
                    className="w-5 h-3.5 rounded-xs object-cover ring-1 ring-black/10 dark:ring-white/15 shadow-2xs"
                    alt={item.uf_name}
                  />
                  <span className="flex items-center gap-0.5">
                    <span className={`h-2 w-2 rounded-full ${t1.dotClass}`} />
                    <span className={`h-2 w-2 rounded-full ${t2.dotClass}`} />
                  </span>
                </span>
                <span>{label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    isSelected
                      ? 'bg-slate-700 text-slate-100 dark:bg-slate-200 dark:text-slate-900'
                      : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formatPct(item.pct_counted, 0)}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Barra de Estágio / Simulação 0% -> 100% e Replay Histórico 2022 (recolhida no Modo Foco) */}
        {!isFocusMode && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 font-medium text-slate-600 dark:text-slate-400">
                Estágio da apuração:
              </span>
              {STAGE_OPTIONS.map((opt) => {
                const active = !isReplayMode && stage === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`stage-btn-${opt.id}`}
                    onClick={() => {
                      if (isReplayMode) onStopReplay()
                      onChangeStage(opt.id)
                    }}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                      active
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {catalog?.feature_flags?.replay !== false && (
              <button
                type="button"
                data-testid="toggle-replay-2022-btn"
                onClick={() => {
                  if (isReplayMode) {
                    onStopReplay()
                  } else {
                    onChangeView('apuracao')
                    onStartReplay()
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  isReplayMode
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                {isReplayMode ? 'Sair do Replay 2022' : 'Replay Histórico 2022'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
