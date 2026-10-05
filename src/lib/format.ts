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

/**
 * Valuation and return ratios (PE, ROE, DY, PTBV, NTA).
 *
 * Upstream values span a huge range — ROE can exceed 2,000% while NTA is often a
 * few sen — so fixed decimals would render most of them as "0.00".
 */
export function formatRatio(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) return value.toFixed(0)
  if (abs >= 100) return value.toFixed(1)
  return value.toFixed(2)
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

/**
 * Map an OpenD `market_my` value onto the UI's session vocabulary.
 *
 * Returns `null` when OpenD gave nothing usable, so callers can omit the session
 * rather than guess.
 */
export function sessionFromOpenD(value: string | null | undefined): MarketSession | null {
  if (!value) return null

  switch (value.toUpperCase()) {
    case 'OPEN':
    case 'MORNING':
    case 'AFTERNOON':
      return value.toUpperCase() === 'AFTERNOON' ? 'afternoon' : 'open'
    case 'PRE_OPEN':
    case 'PRE_OPEN_START':
    case 'PRE_OPEN_END':
      return 'pre-open'
    case 'REST':
    case 'LUNCH_BREAK':
      return 'lunch-break'
    case 'CLOSED':
    case 'AFTER_HOURS_END':
    case 'AFTER_HOURS_BEGIN':
    case 'NIGHT_END':
      return 'closed'
    default:
      return null
  }
}

type MarketSession = import('../domain/types').MarketSession
