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

/**
 * One open holding, read from OpenD's trade context.
 *
 * Not a quote: this is account data, so it carries real figures even when the MY
 * quote entitlement is missing. Every numeric field is nullable because OpenD
 * genuinely omits some of them, and a missing figure renders "—" — never a
 * fabricated 0, which would read as a real position.
 */
export interface Position {
  readonly symbol: string
  readonly company: string
  /** Trading currency as OpenD reports it, e.g. "MYR". */
  readonly currency: string
  readonly quantity: number | null
  readonly averageCost: number | null
  /** Latest price OpenD reports for the holding, or null if it has none. */
  readonly last: number | null
  readonly marketValue: number | null
  readonly profitLoss: number | null
  readonly profitLossPercent: number | null
  /**
   * Today's change in value for the holding, as OpenD reports it.
   *
   * Nullable like every other figure: OpenD omits it for some holdings, and a
   * missing day move renders "—" rather than a fabricated 0.
   */
  readonly todayProfitLoss: number | null
  readonly trend: TrendDirection
}

/**
 * A closed position and the profit OpenD booked for it.
 *
 * OpenD keeps a sold-out holding in its position query as a row with `qty == 0`
 * carrying `realized_pl`, rather than removing it — which is what makes closed
 * trades visible at all. This is OpenD's own netted figure, so unlike the
 * ~90-day deal stream it is not window-limited.
 *
 * Not exhaustive: a position sold from an IPO allotment never appears in the
 * position list, so no realized figure exists for it anywhere. Those are
 * surfaced separately as unmatched sells.
 */
export interface RealizedPosition {
  readonly symbol: string
  readonly company: string
  readonly currency: string
  readonly realized: number | null
}

/**
 * One executed fill, from OpenD's deal history.
 *
 * The only record of *closed* trades: `/api/market/positions` lists open
 * holdings alone, so selling a position removes it from there completely and
 * takes its realized profit with it. This is what still knows about those
 * trades.
 *
 * OpenD caps deal history at roughly 90 days (silently truncating the window),
 * so anything derived from these rows is a windowed figure. The accompanying
 * `DealHistory.window` carries the span actually covered so the UI can say so
 * instead of implying all-time.
 */
export interface Deal {
  readonly symbol: string
  readonly company: string
  readonly side: 'BUY' | 'SELL'
  readonly quantity: number | null
  readonly price: number | null
  /** OpenD's own timestamp, e.g. "2026-10-05 11:45:14.108". */
  readonly time: string
  /**
   * moomoo's stable deal id, the natural key for the ledger. Present on
   * live-fetched deals; derived deals (see `ClosedTrade`) carry it through.
   * Null only when a deal was constructed without one.
   */
  readonly dealId: string | null
}

/**
 * Closed positions shaped like open ones, so the Positions and Closed Positions
 * tables can share a single row renderer.
 *
 * A "closed position" is a *stock you have finished trading*: every fill bought
 * has been sold again, so the holding is flat. It is not the same thing as a
 * sell, and it is not the same thing as OpenD's booked realized P/L — a
 * partially sold holding has booked profit yet is still open (see
 * `RealizedPosition`), and a closed position may include several round trips.
 *
 * The fields mirror `Position` but mean the totals for the whole closed record:
 * `averageCost` is the cost of everything bought and weighted by quantity,
 * `last`/`marketValue`/`profitLoss` describe the *final* sell, and
 * `profitLossPercent` is measured against the exit price. OpenD will not report
 * a position like this — it stops tracking a holding at zero — so every field is
 * nullable, exactly as on an open position. Anything OpenD never had (an IPO
 * allotment's cost, for instance) stays null and renders "—" rather than an
 * invented zero.
 */
export interface ClosedTrade {
  readonly symbol: string
  readonly company: string
  readonly currency: string
  /** Total quantity bought, and therefore total sold to close. */
  readonly quantity: number | null
  /** Quantity-weighted average cost of every buy in the record. */
  readonly averageCost: number | null
  /** Price of the final sell — the exit. */
  readonly last: number | null
  /** Final sell proceeds, i.e. quantity × exit price. */
  readonly marketValue: number | null
  readonly profitLoss: number | null
  readonly profitLossPercent: number | null
  /** Price of the first buy, i.e. where the position was opened. */
  readonly firstBuyPrice: number | null
  /** Price of the final sell, i.e. where the position was closed. */
  readonly lastSellPrice: number | null
  /** Timestamp of the first fill, e.g. "2026-09-29 11:03:51.409". */
  readonly openedAt: string | null
  /** Timestamp of the closing sell. */
  readonly closedAt: string | null
  /** Every fill in the record, oldest first. */
  readonly deals: readonly Deal[]
  readonly trend: TrendDirection
}

/**
 * Deal history plus the window OpenD actually returned.
 *
 * `window` is null when no deals came back at all — distinct from "no realized
 * P/L", which requires knowing the window was covered.
 */
export interface DealHistory {
  readonly deals: readonly Deal[]
  readonly window: { readonly oldest: string; readonly newest: string } | null
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
