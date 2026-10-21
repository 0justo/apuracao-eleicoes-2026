import { useEffect, useRef } from 'react'
import { Calculator, X } from 'lucide-react'
import type { TurnaroundAnalysis } from '../../types/election'
import { formatInt, formatPct } from '../../utils/formatters'

interface HowWeCalculateModalProps {
  isOpen: boolean
  onClose: () => void
  turnaround: TurnaroundAnalysis
}

export function HowWeCalculateModal({
  isOpen,
  onClose,
  turnaround,
}: HowWeCalculateModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Fallback para light-dismiss em navegadores sem suporte nativo a <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)

    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype
    const handleBackdropClick = (event: MouseEvent) => {
      if (supportsClosedBy) return
      if (event.target !== dialog) return
      const rect = dialog.getBoundingClientRect()
      const isInside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      if (!isInside) {
        dialog.close()
      }
    }

    dialog.addEventListener('click', handleBackdropClick)
    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('click', handleBackdropClick)
    }
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="how-we-calculate-title"
      data-testid="how-we-calculate-dialog"
      className="m-auto w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator
              className="h-5 w-5 text-slate-700 dark:text-slate-300"
              aria-hidden="true"
            />
            <h3
              id="how-we-calculate-title"
              className="text-base font-bold sm:text-lg"
            >
              Como calculamos a Calculadora da Virada
            </h3>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar explicação da fórmula"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700 sm:text-sm dark:text-slate-300">
          <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 py-2 text-xs font-semibold text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-200">
            {turnaround.disclaimer}
          </div>

          <p>
            A Calculadora da Virada responde:{' '}
            <strong>
              &ldquo;Quanto o candidato que está atrás no momento precisa obter
              dos votos válidos restantes para ultrapassar 50% dos votos
              válidos?&rdquo;
            </strong>
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs dark:border-slate-800 dark:bg-slate-800/70">
            <div className="font-bold text-slate-900 dark:text-white">
              Fórmula Matemática:
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              s = ((V + R) / 2 − A) / R
            </div>
            <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              R = (Comparecimento Esperado − Votos Já Apurados) × (1 − Taxa de
              Brancos e Nulos Observada)
            </div>
          </div>

          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>V (Votos válidos já apurados dos 2 candidatos):</strong>{' '}
              Atualmente <strong>{formatInt(turnaround.valid_votes_counted_v)}</strong>{' '}
              votos válidos.
            </li>
            <li>
              <strong>A (Votos do candidato atrás no momento):</strong>{' '}
              Atualmente <strong>{formatInt(turnaround.trailing_candidate_votes_a)}</strong>{' '}
              votos ({turnaround.trailing_candidate_name}).
            </li>
            <li>
              <strong>Comparecimento esperado:</strong> Baseado no comparecimento
              real observado no <strong>1º turno de 2026</strong> em cada localidade,
              ajustável pelo controle deslizante (atualmente{' '}
              <strong>{formatInt(turnaround.expected_turnout_total)}</strong>{' '}
              eleitores).
            </li>
            <li>
              <strong>Taxa de brancos e nulos:</strong> Proporção de votos em
              branco e nulos observada até agora no 2º turno (atualmente{' '}
              <strong>
                {formatPct(turnaround.observed_blank_null_rate * 100)}
              </strong>
              {turnaround.used_1t_blank_null_fallback
                ? ' — usando linha de base do 1º turno enquanto há 0 votos apurados'
                : ''}
              ).
            </li>
            <li>
              <strong>R (Votos válidos restantes estimados):</strong> Atualmente{' '}
              <strong>
                {formatInt(turnaround.estimated_remaining_valid_votes_r)}
              </strong>{' '}
              votos válidos estimados.
            </li>
          </ul>

          <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
            <strong>Premissas e limites:</strong> Este cálculo é puramente
            aritmético e não leva em conta o perfil geográfico dos locais onde
            ainda faltam urnas (para isso, consulte a seção{' '}
            <em>&ldquo;Onde ainda falta contar&rdquo;</em> logo abaixo). O site
            nunca declara resultado por conta própria.
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-200 pt-3 dark:border-slate-800">
          <form method="dialog">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Entendi
            </button>
          </form>
        </div>
      </div>
    </dialog>
  )
}
