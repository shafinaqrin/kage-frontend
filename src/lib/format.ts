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

/**
 * A traded price, never shown with fewer than three decimals.
 *
 * Bursa quotes sub-RM counters in half-sen ticks (D&O at 0.555, OPPSTAR at
 * 0.710), so a fixed two decimals silently rounds away real precision — 0.555
 * would render as "0.56", a price that never traded. Trailing zeros are kept so
 * a column of prices aligns on the decimal point.
 */
export function formatStockPrice(value: number): string {
  return value.toLocaleString('en-MY', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
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
 * The clock window a session covers, e.g. "12:30pm – 2:30pm".
 *
 * **These times are a UI convention, not data from OpenD.** OpenD reports only
 * the session *name* (`MORNING`, `REST`, `AFTERNOON`, `CLOSED`) — verified
 * against `get_global_state`, `get_market_state`, and `request_trading_days`,
 * none of which expose clock times, and the SDK ships no session-time table. So
 * the windows below are Bursa Malaysia's published hours, encoded here. If the
 * exchange ever changes them, this needs editing; it cannot self-correct.
 *
 * Returns null for `closed`, which has no single meaningful window — the market
 * is shut overnight and all weekend, and printing a "9:00am – 5:00pm" range for
 * a Saturday would imply trading that is not happening.
 */
export function sessionHours(session: MarketSession): string | null {
  const hours: Record<MarketSession, string | null> = {
    'pre-open': '8:30am – 9:00am',
    open: '9:00am – 12:30pm',
    'lunch-break': '12:30pm – 2:30pm',
    afternoon: '2:30pm – 5:00pm',
    closed: null,
  }
  return hours[session]
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
