import {
  AlertTriangle,
  CheckCircle2,
  History,
  RefreshCw,
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

function XTwitterIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.222 0h.003z" />
    </svg>
  )
}

function GitHubIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
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
  const isUnderVerification = snapshot?.validation_status === 'em_verificacao'
  const isReplay = snapshot?.is_replay === true

  return (
    <header
      role="banner"
      aria-label="Aviso oficial de fonte e horário de atualização"
      className="sticky top-0 z-40 w-full border-b border-slate-200 bg-[#050505] text-slate-100 shadow-sm dark:border-[#1F1F24] dark:bg-[#050505]"
    >
      <div className="mx-auto flex h-10 w-full max-w-[1840px] items-center justify-between px-3 sm:px-4 lg:px-6">
        {/* Esquerda: Indicação sutil de status e horário */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span
            data-testid="fixed-official-banner-text"
            className="text-[11px] font-medium tracking-tight text-slate-300 sm:text-xs"
          >
            <span className="hidden sm:inline">Resultado parcial • </span>
            <span className="text-slate-400">Fonte: TSE</span> •{' '}
            <span className="font-mono text-slate-100">{hms}</span>
          </span>
        </div>

        {/* Direita: Botão Atualizar + Redes Sociais */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/90 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            title="Verificar atualização agora"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <div className="h-3.5 w-px bg-slate-800" aria-hidden="true" />

          {/* Links Sociais Clicáveis */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <a
              href="https://x.com/alcoholicgoatt"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter / X (@alcoholicgoatt)"
              title="Twitter / X (@alcoholicgoatt)"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <XTwitterIcon className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://www.linkedin.com/in/luan-lopes-cabral/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn (Luan Lopes Cabral)"
              title="LinkedIn (Luan Lopes Cabral)"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <LinkedInIcon className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://github.com/lulkabral"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub (lulkabral)"
              title="GitHub (lulkabral)"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Faixa de alerta se houver dados desatualizados (> 3 min), verificação de sanidade ou modo Replay */}
      {isReplay && (
        <div
          role="status"
          className="border-t border-amber-500/30 bg-amber-950/90 px-3 py-1 text-xs text-amber-200"
        >
          <div className="mx-auto flex max-w-[1840px] flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <History className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <strong>REPLAY HISTÓRICO (2022):</strong>{' '}
              {snapshot?.replay_label ??
                'Reprodução acelerada do 2º turno de 2022 a partir de dados históricos do TSE.'}
            </span>
            {onStopReplay && (
              <button
                type="button"
                onClick={onStopReplay}
                className="rounded bg-amber-400 px-2 py-0.5 text-xs font-semibold text-slate-950 hover:bg-amber-300"
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
          className="border-t border-amber-500/40 bg-amber-900/90 px-3 py-1 text-xs text-amber-100"
        >
          <div className="mx-auto flex max-w-[1840px] items-center gap-2">
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0 text-amber-300"
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
          className="border-t border-rose-500/40 bg-rose-950/95 px-3 py-1 text-xs text-rose-100"
        >
          <div className="mx-auto flex max-w-[1840px] items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-rose-300"
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
