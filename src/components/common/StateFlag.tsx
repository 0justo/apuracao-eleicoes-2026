import { useState } from 'react'

interface StateFlagProps {
  uf: string
  className?: string
  alt?: string
}

export function StateFlag({
  uf,
  className = 'w-11 h-8 rounded-md object-cover ring-1 ring-white/15 shadow-sm',
  alt,
}: StateFlagProps) {
  const [error, setError] = useState(false)
  const ufClean = (uf || 'BR').trim().toUpperCase()
  const flagSrc = `/flags/${ufClean.toLowerCase()}.svg`
  const flagAlt = alt ?? `Bandeira do estado de ${ufClean}`

  if (error) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-slate-800 font-mono text-[10px] font-bold text-white ring-1 ring-white/15 shadow-sm ${className}`}
        title={flagAlt}
      >
        {ufClean}
      </span>
    )
  }

  return (
    <img
      src={flagSrc}
      alt={flagAlt}
      title={flagAlt}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
      className={`shrink-0 ${className}`}
    />
  )
}
