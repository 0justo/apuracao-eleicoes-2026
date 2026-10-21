import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  History,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { DisputeSnapshot } from '../../types/election'

interface FixedOfficialBannerProps {
  snapshot: DisputeSnapshot | null
  isStale: boolean
  snapshotAgeSeconds: number
  fetchError: string | null
  onRefresh: () => void
  onStopReplay?: () => void
}

export function FixedOfficialBanner({
  snapshot,
  isStale,
  snapshotAgeSeconds,
  fetchError,
  onRefresh,
  onStopReplay,
}: FixedOfficialBannerProps) {
  const hms = snapshot?.generated_at_hms ?? '--:--:--'
  const portalUrl =
    snapshot?.source_portal_url ?? 'https://resultados.tse.jus.br'
  const jsonUrl = snapshot?.source_json_url ?? 'https://resultados.tse.jus.br'
  const isUnderVerification = snapshot?.validation_status === 'em_verificacao'
  const isReplay = snapshot?.is_replay === true

  return (
    <header
      role="banner"
      aria-label="Aviso oficial de fonte e horário de atualização"
      className="sticky top-0 z-40 w-full border-b border-slate-200 bg-[#050505] text-slate-100 shadow-sm dark:border-[#1F1F24] dark:bg-[#050505]"
    >
      <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-1.5 px-4 py-2 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-emerald-400"
            aria-hidden="true"
          />
          <span className="font-semibold tracking-tight" data-testid="fixed-official-banner-text">
            Resultado parcial até 100% das urnas apuradas. Fonte: TSE.
            Atualizado às {hms}
          </span>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-sky-300 underline decoration-sky-400/60 underline-offset-2 transition hover:bg-slate-700 hover:text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            Portal Resultados TSE
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          <a
            href={jsonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-white"
            title="Ver arquivo JSON bruto oficial na fonte (TSE)"
          >
            ver na fonte (JSON)
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 sm:justify-end">
          <span>
            App independente, sem afiliação ao TSE, a candidatos ou a partidos.
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            title="Verificar atualização agora"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Faixa de alerta se houver dados desatualizados (> 3 min), verificação de sanidade ou modo Replay */}
      {isReplay && (
        <div
          role="status"
          className="border-t border-amber-500/30 bg-amber-950/90 px-3 py-1.5 text-xs text-amber-200"
        >
          <div className="mx-auto flex max-w-[1840px] flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <History className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <strong>REPLAY HISTÓRICO (2022):</strong>{' '}
              {snapshot?.replay_label ??
                'Reprodução acelerada do 2º turno de 2022 a partir de dados históricos do TSE.'}
            </span>
            {onStopReplay && (
              <button
                type="button"
                onClick={onStopReplay}
                className="rounded bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-slate-950 hover:bg-amber-300"
              >
                Voltar para Eleição 2026
              </button>
            )}
          </div>
        </div>
      )}

      {isUnderVerification && (
        <div
          role="alert"
          data-testid="sanity-verification-banner"
          className="border-t border-amber-500/40 bg-amber-900/90 px-3 py-1.5 text-xs text-amber-100"
        >
          <div className="mx-auto flex max-w-[1840px] items-center gap-2">
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-amber-300"
              aria-hidden="true"
            />
            <span>
              <strong>Atualização em verificação:</strong> O ciclo mais recente
              apresentou inconsistência na validação de sanidade. Exibindo o
              último snapshot íntegro validado às {hms}.
            </span>
          </div>
        </div>
      )}

      {isStale && !isReplay && (
        <div
          role="alert"
          data-testid="stale-data-banner"
          className="border-t border-rose-500/40 bg-rose-950/95 px-3 py-1.5 text-xs text-rose-100"
        >
          <div className="mx-auto flex max-w-[1840px] items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-rose-300"
                aria-hidden="true"
              />
              <strong>Dados desatualizados:</strong> A última leitura validada
              tem mais de 3 minutos ({Math.floor(snapshotAgeSeconds / 60)} min{' '}
              {snapshotAgeSeconds % 60} s atrás
              {fetchError ? ` — ${fetchError}` : ''}). O aplicativo mantém o
              último snapshot em cache.
            </span>
          </div>
        </div>
      )}

      {!isStale && !isUnderVerification && !isReplay && snapshot && (
        <div className="sr-only" role="status">
          <CheckCircle2 className="h-3 w-3" /> Snapshot validado e atualizado.
        </div>
      )}
    </header>
  )
}
