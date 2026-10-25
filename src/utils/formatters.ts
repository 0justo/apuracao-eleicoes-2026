/**
 * Utilitários de formatação numérica e textual em Português do Brasil (pt-BR).
 */

const intFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0'
  }
  return intFormatter.format(Math.round(value))
}

export function formatPct(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0,00%'
  }
  return `${value.toFixed(decimals).replace('.', ',')}%`
}

export function formatNumberComma(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0,00'
  }
  return value.toFixed(decimals).replace('.', ',')
}

export function formatSignedPP(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0,00 p.p.'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals).replace('.', ',')} p.p.`
}

export function formatPP(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0,00 p.p.'
  }
  return `${Math.abs(value).toFixed(decimals).replace('.', ',')} p.p.`
}

export function formatCompactNumber(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0'
  }
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const val = value / 1_000_000
    const dec = abs >= 10_000_000 ? Math.min(decimals, 1) : Math.max(decimals, 2)
    return `${val.toFixed(dec).replace('.', ',')}M`
  }
  if (abs >= 1_000) {
    const val = value / 1_000
    const dec = abs >= 100_000 ? 0 : 1
    return `${val.toFixed(dec).replace('.', ',')}k`
  }
  return formatInt(value)
}

export function formatOfficialCandidateName(name: string | null | undefined): string {
  if (!name) return ''
  return name.replace(/\bFLAVIO\b/g, 'FLÁVIO')
}
