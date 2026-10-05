/**
 * Where a quote came from. Kage has exactly one source — Moomoo OpenD — and no
 * demo/sample mode, so there is deliberately no second variant here.
 */
export type DataSource = 'live'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export type MarketSession = 'pre-open' | 'open' | 'lunch-break' | 'afternoon' | 'closed'

export type TrendDirection = 'up' | 'down' | 'flat'

/** A watchlist instrument as held in Moomoo OpenD. */
export interface WatchlistEntry {
  readonly symbol: string
  readonly company: string
}

export interface QuoteSnapshot {
  readonly symbol: string
  readonly company: string
  /** False when Moomoo OpenD has no data/permission — the UI shows "—". */
  readonly available: boolean
  readonly last: number | null
  readonly change: number | null
  readonly changePercent: number | null
  readonly volume: number | null
  readonly dayHigh: number | null
  readonly dayLow: number | null
  readonly open: number | null
  readonly trend: TrendDirection
  readonly reason?: string
}

export interface IndexSnapshot {
  readonly name: string
  readonly value: number
  readonly change: number
  readonly changePercent: number
}

export interface MarketBreadth {
  readonly advancing: number
  readonly declining: number
  readonly unchanged: number
}

export interface MarketOverview {
  readonly session: MarketSession
  readonly dataSource: DataSource
  readonly index: IndexSnapshot
  readonly breadth: MarketBreadth
  readonly updatedAt: string
}

/**
 * One Shariah-compliant instrument from the screener.
 *
 * Sourced from KLSE Screener via the `kage-screener` sidecar, not from OpenD:
 * the screener needs fundamental fields (PE, ROE, NTA) that the quote path does
 * not provide. Every figure is nullable because the upstream site genuinely
 * omits values, and a missing figure renders "—" rather than a fabricated 0.
 */
export interface ScreenerRow {
  readonly code: string
  readonly name: string
  readonly category: string
  readonly market: string
  readonly price: number | null
  readonly change: number | null
  readonly changePercent: number | null
  readonly week52: string
  readonly volume: number | null
  readonly eps: number | null
  readonly dps: number | null
  readonly nta: number | null
  readonly pe: number | null
  readonly dy: number | null
  readonly roe: number | null
  readonly ptbv: number | null
  readonly marketCap: number | null
}
