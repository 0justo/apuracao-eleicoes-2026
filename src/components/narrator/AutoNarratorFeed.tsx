import { type ComponentType, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Crosshair,
  GitCompare,
  Info,
  Landmark,
  MapPin,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type { NarratorMessage } from '../../types/election'

interface AutoNarratorFeedProps {
  messages: NarratorMessage[]
  enabled: boolean
  /** Nomes de urna dos DOIS candidatos da disputa exibida (destaque simétrico). */
  highlightNames?: string[]
  snapshotUpdatedAtHms?: string
}

interface CategoryConfig {
  label: string
  shortPill: string
  icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>
  pillClass: string
  iconBadgeClass: string
}

const CATEGORY_META: Record<NarratorMessage['category'], CategoryConfig> = {
  turnaround_math: {
    label: 'Matemática da virada',
    shortPill: 'Virada',
    icon: Crosshair,
    pillClass:
      'border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-800/70 dark:bg-purple-950/60 dark:text-purple-200',
    iconBadgeClass:
      'bg-purple-500/15 text-purple-600 border border-purple-500/25 dark:bg-purple-500/20 dark:text-purple-300',
  },
  pending_hotspots: {
    label: 'Onde falta contar',
    shortPill: 'Falta Contar',
    icon: MapPin,
    pillClass:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-200',
    iconBadgeClass:
      'bg-amber-500/15 text-amber-600 border border-amber-500/25 dark:bg-amber-500/20 dark:text-amber-300',
  },
  margin_change: {
    label: 'Evolução da margem',
    shortPill: 'Margem',
    icon: Activity,
    pillClass:
      'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-200',
    iconBadgeClass:
      'bg-blue-500/15 text-blue-600 border border-blue-500/25 dark:bg-blue-500/20 dark:text-blue-300',
  },
  progress: {
    label: 'Progresso da apuração',
    shortPill: 'Ritmo',
    icon: TrendingUp,
    pillClass:
      'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    iconBadgeClass:
      'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  official_status: {
    label: 'Status oficial TSE',
    shortPill: 'Status',
    icon: Landmark,
    pillClass:
      'border-emerald-400 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200',
    iconBadgeClass:
      'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  swing_highlight: {
    label: 'Variação 1ºT → 2ºT',
    shortPill: 'Variação 1ºT',
    icon: GitCompare,
    pillClass:
      'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800/70 dark:bg-teal-950/60 dark:text-teal-200',
    iconBadgeClass:
      'bg-teal-500/15 text-teal-600 border border-teal-500/25 dark:bg-teal-500/20 dark:text-teal-300',
  },
}

/**
 * Remove qualquer menção residual a estimativas entre parênteses
 * e destaca termos-chave (números, porcentagens, pontos percentuais e nomes de candidatos).
 */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderCleanTickerContent(rawText: string, highlightNames: string[]) {
  // Limpa explicitamente o texto residual entre parênteses
  const sanitized = rawText
    .replace(/\s*\(Estimativa do site, não é resultado oficial\)\.?\s*/gi, '')
    .trim()

  // Antes: lista fixa "Lula|Flávio Bolsonaro|Tarcísio". O TSE grava "FLAVIO BOLSONARO" sem
  // acento, então só um dos dois candidatos ficava em negrito. Agora destaca os dois nomes
  // reais da disputa (inclusive Governadores).
  const names = highlightNames.filter(Boolean).map(escapeRegExp)
  const namePattern = names.length ? `|${names.join('|')}` : ''
  const splitter = new RegExp(
    `(\\b\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?%?|\\b[+-]?\\d+(?:,\\d+)?\\s?p\\.p\\.|\\bTSE\\b${namePattern})`,
    'gi',
  )
  const nameSet = new Set(highlightNames.map((n) => n.toLowerCase()))
  const parts = sanitized.split(splitter)

  return parts.map((part, i) => {
    if (
      /^\d{1,3}(?:\.\d{3})*(?:,\d+)?%?$/i.test(part) ||
      /^[+-]?\d+(?:,\d+)?\s?p\.p\.$/i.test(part) ||
      /^TSE$/i.test(part) ||
      nameSet.has(part.toLowerCase())
    ) {
      return (
        <strong
          key={i}
          className="font-black text-slate-950 dark:text-white"
        >
          {part}
        </strong>
      )
    }
    return part
  })
}

export function AutoNarratorFeed({
  messages,
  enabled,
  highlightNames = [],
  snapshotUpdatedAtHms,
}: AutoNarratorFeedProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    NarratorMessage['category'] | 'all'
  >('all')
  const [pulseActive, setPulseActive] = useState(true)

  // Dispara pulso visual a cada novo snapshot recebido
  useEffect(() => {
    setPulseActive(true)
    const timer = window.setTimeout(() => setPulseActive(false), 3500)
    return () => window.clearTimeout(timer)
  }, [snapshotUpdatedAtHms, messages.length])

  if (!enabled) {
    return null
  }

  const availableCategories = useMemo(
    () => Array.from(new Set(messages.map((m) => m.category))),
    [messages],
  )

  const filteredMessages =
    selectedCategory === 'all'
      ? messages
      : messages.filter((m) => m.category === selectedCategory)

  return (
    <section
      aria-label="Lex News — Pílulas analíticas determinísticas da apuração"
      data-testid="auto-narrator-feed"
      className="flex flex-col h-[380px] sm:h-[400px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1F1F24] dark:bg-[#0A0A0C]"
    >
      {/* 1. Cabeçalho Limpo: Título + Ícone ⓘ com Tooltip + Pulso */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
            <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span
              data-testid="lex-pulse-indicator"
              className="absolute -top-1 -right-1 flex h-3 w-3"
              title="Indicador de pulso do Lex News a cada novo snapshot"
            >
              <span
                className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${
                  pulseActive ? 'animate-ping' : 'animate-pulse'
                }`}
              />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">
              Lex
            </h2>

            {/* Ícone ⓘ discreto com Tooltip dinâmico */}
            <div className="group relative inline-flex items-center">
              <button
                type="button"
                className="rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300"
                aria-label="Informações sobre o Lex News"
              >
                <Info className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
              <div className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-64 rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">
                <p className="font-medium text-white">Síntese Determinística</p>
                <p className="mt-1 text-slate-300">
                  Pílulas analíticas em tempo real geradas matematicamente a partir dos dados do TSE, sem uso de modelos generativos no ciclo de apuração.
                </p>
              </div>
            </div>

            <span className="rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Resumo ao Vivo
            </span>
          </div>
        </div>

        {snapshotUpdatedAtHms && (
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border dark:border-[#1F1F24] dark:bg-[#0F0F12] dark:text-slate-300">
            {snapshotUpdatedAtHms}
          </span>
        )}
      </div>

      {/* 2. Filtro Rápido com Ícones Vetoriais Profissionais */}
      <div
        className="shrink-0 mt-3 flex flex-wrap items-center gap-1.5"
        role="tablist"
        aria-label="Filtrar pílulas analíticas do Lex News"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition ${
            selectedCategory === 'all'
              ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-[#1F1F24] dark:bg-[#0F0F12] dark:text-slate-300'
          }`}
        >
          Todas ({messages.length})
        </button>
        {availableCategories.map((cat) => {
          const meta = CATEGORY_META[cat] ?? CATEGORY_META.progress
          const isSelected = selectedCategory === cat
          const IconComp = meta.icon
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedCategory(cat)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                isSelected
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
                  : meta.pillClass
              }`}
            >
              <IconComp className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              <span>{meta.shortPill}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Feed em Formato Fast Ticker com rolagem interna e scrollbar fina */}
      <ol
        className="mt-3 flex-1 min-h-0 space-y-2 overflow-y-auto pr-1 scrollbar-thin [scrollbar-width:thin]"
        aria-live="polite"
      >
        {filteredMessages.map((msg, idx) => {
          const meta = CATEGORY_META[msg.category] ?? CATEGORY_META.progress
          const isLatest = idx === 0
          const IconComp = meta.icon

          return (
            <li
              key={msg.id}
              data-testid={`narrator-item-${msg.category}`}
              className={`group rounded-xl border p-2.5 text-xs transition ${
                isLatest
                  ? 'border-slate-300 bg-slate-50 shadow-2xs dark:border-[#1F1F24] dark:bg-[#0F0F12]'
                  : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 dark:border-[#1F1F24] dark:bg-[#0F0F12]/60 dark:hover:bg-[#0F0F12]'
              } text-slate-800 dark:text-slate-200`}
            >
              <div className="mb-1 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${meta.iconBadgeClass}`}
                    aria-hidden="true"
                  >
                    <IconComp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-black uppercase tracking-wider ${meta.pillClass}`}
                  >
                    {meta.shortPill}
                  </span>
                  {isLatest && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Agora
                    </span>
                  )}
                </div>

                <time className="font-mono text-[10px] text-slate-500">
                  {msg.timestamp}
                </time>
              </div>

              {/* Texto enxuto em no máximo 2 linhas com destaques em negrito e sem aviso residual */}
              <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-700 dark:text-slate-300">
                {renderCleanTickerContent(msg.text, highlightNames)}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
