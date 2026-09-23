export function formatPrice(value: number): string {
  return value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatIndex(value: number): string {
  return value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(digits)}`
}

export function formatSignedPercent(value: number): string {
  return `${formatSigned(value)}%`
}

export function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  })
}

export function sessionLabel(session: MarketSession): string {
  const labels: Record<MarketSession, string> = {
    'pre-open': 'Pre-Open',
    open: 'Market Open',
    'lunch-break': 'Lunch Break',
    afternoon: 'Afternoon Session',
    closed: 'Market Closed',
  }
  return labels[session]
}

type MarketSession = import('../domain/types').MarketSession
