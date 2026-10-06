import { deriveClosedTrades } from '../features/closed-positions/closedTrades'
import type { ClosedTrade, Deal, DealHistory, Position, QuoteSnapshot, RealizedPosition, ScreenerRow, WatchlistEntry } from '../domain/types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const API_BASE = '/api'

/** Raw shape returned by the Laravel backend, which proxies the OpenD sidecar. */
interface BackendQuote {
  symbol: string
  name: string | null
  market: string
  currency: string
  available: boolean
  last: number | null
  previousClose: number | null
  change: number | null
  changePercent: number | null
  open: number | null
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  turnover: number | null
  updatedAt: number | null
  reason?: string
}

interface BackendQuotesResponse {
  source: string
  quotes: BackendQuote[]
}

/** Raw watchlist row: OpenD owns membership, so nothing is declared client-side. */
interface BackendWatchlistRow {
  symbol: string
  name: string | null
  market: string
}

interface BackendWatchlistResponse {
  source: string
  symbols: BackendWatchlistRow[]
}

/** Provider health, including the live Bursa session as reported by OpenD. */
interface BackendHealthResponse {
  provider: {
    marketSession: string | null
  }
}

/** Raw position row from the Laravel proxy over the OpenD trade context. */
interface BackendPosition {
  symbol: string
  name: string | null
  market: string
  currency: string
  quantity: number | null
  sellableQuantity: number | null
  averageCost: number | null
  last: number | null
  marketValue: number | null
  profitLoss: number | null
  profitLossPercent: number | null
  todayProfitLoss: number | null
}

interface BackendPositionsResponse {
  source: string
  positions: BackendPosition[]
}

/** Raw fill row from the Laravel proxy over OpenD's deal history. */
interface BackendDeal {
  symbol: string
  name: string | null
  market: string
  dealId: string
  side: string
  quantity: number | null
  price: number | null
  time: string
}

interface BackendDealsResponse {
  source: string
  deals: BackendDeal[]
  oldest: string | null
  newest: string | null
}

/**
 * A deal as stored in the persistent ledger, or as POSTed back to it. Mirrors
 * `BackendDeal` but keyed the same way the backend stores it (`dealId`).
 */
interface LedgerDeal {
  readonly dealId: string | null
  readonly symbol: string
  readonly company: string | null
  readonly market: string
  readonly side: 'BUY' | 'SELL'
  readonly quantity: number | null
  readonly price: number | null
  readonly time: string
}

interface BackendLedgerResponse {
  deals: LedgerDeal[]
}

interface BackendLedgerWriteResponse {
  inserted: number
  total: number
  oldest: string | null
  newest: string | null
}

/** Raw closed-position row: OpenD's booked realized P/L. */
interface BackendRealizedRow {
  symbol: string
  name: string | null
  market: string
  currency: string
  realized: number | null
}

interface BackendRealizedResponse {
  source: string
  realized: BackendRealizedRow[]
}

/** Raw screener row as returned by the Laravel proxy over the kage-screener sidecar. */
interface BackendScreenerRow {
  code: string
  name: string | null
  category: string | null
  market: string | null
  price: number | null
  change: number | null
  changePercent: number | null
  week52: string | null
  volume: number | null
  eps: number | null
  dps: number | null
  nta: number | null
  pe: number | null
  dy: number | null
  roe: number | null
  ptbv: number | null
  marketCap: number | null
}

interface BackendScreenerResponse {
  source: string
  filter: string
  count: number
  fetchedAt: number | null
  rows: BackendScreenerRow[]
}

/**
 * Normalise an OpenD-backed quote. When OpenD has no permission or no data the
 * snapshot is marked `available: false` and the UI renders "—" — no fabricated
 * price is ever substituted.
 */
function normalizeQuote(quote: BackendQuote): QuoteSnapshot {
  if (!quote.available || quote.last === null) {
    return {
      symbol: quote.symbol,
      company: quote.name ?? quote.symbol,
      available: false,
      last: null,
      change: null,
      changePercent: null,
      volume: null,
      dayHigh: null,
      dayLow: null,
      open: null,
      trend: 'flat',
      reason: quote.reason ?? 'No data from Moomoo OpenD.',
    }
  }

  const change = quote.change ?? 0

  return {
    symbol: quote.symbol,
    company: quote.name ?? quote.symbol,
    available: true,
    last: quote.last,
    change,
    changePercent: quote.changePercent ?? 0,
    volume: quote.volume ?? 0,
    dayHigh: quote.dayHigh ?? quote.last,
    dayLow: quote.dayLow ?? quote.last,
    open: quote.open ?? quote.previousClose ?? quote.last,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  }
}

function normalizeEntry(row: BackendWatchlistRow): WatchlistEntry {
  return {
    symbol: row.symbol,
    company: row.name ?? row.symbol,
  }
}

/**
 * Normalise one holding. Absent figures stay `null` so the row renders "—":
 * inventing a zero would read as a real cost or value.
 */
function normalizePosition(row: BackendPosition): Position {
  const tone = row.profitLoss ?? row.profitLossPercent

  return {
    symbol: row.symbol,
    company: row.name ?? row.symbol,
    currency: row.currency,
    quantity: row.quantity,
    averageCost: row.averageCost,
    last: row.last,
    marketValue: row.marketValue,
    profitLoss: row.profitLoss,
    profitLossPercent: row.profitLossPercent,
    todayProfitLoss: row.todayProfitLoss ?? null,
    trend: tone === null || tone === undefined ? 'flat' : tone > 0 ? 'up' : tone < 0 ? 'down' : 'flat',
  }
}

/**
 * Normalise one screener row.
 *
 * Absent figures stay `null`: the upstream site genuinely omits them, so the UI
 * renders "—" rather than substituting a zero that would read as a real value.
 */
function normalizeScreenerRow(row: BackendScreenerRow): ScreenerRow {
  return {
    code: row.code,
    name: row.name ?? row.code,
    category: row.category ?? '',
    market: row.market ?? '',
    price: row.price,
    change: row.change,
    changePercent: row.changePercent,
    week52: row.week52 ?? '',
    volume: row.volume,
    eps: row.eps,
    dps: row.dps,
    nta: row.nta,
    pe: row.pe,
    dy: row.dy,
    roe: row.roe,
    ptbv: row.ptbv,
    marketCap: row.marketCap,
  }
}

/**
 * Normalise one deal.
 *
 * Only BUY and SELL are representable: any other side OpenD might send would
 * make realized P/L meaningless, so it is dropped rather than coerced into one
 * of the two. A deal missing its timestamp is dropped for the same reason —
 * ordering is what makes the buy/sell matching correct.
 */
function normalizeDeal(row: BackendDeal): Deal | null {
  const side = row.side.toUpperCase()
  if (side !== 'BUY' && side !== 'SELL') return null
  if (!row.time) return null

  return {
    symbol: row.symbol,
    company: row.name ?? row.symbol,
    side,
    quantity: row.quantity,
    price: row.price,
    time: row.time,
    dealId: row.dealId,
  }
}

export const marketApi = {
  /**
   * The live Bursa session, as reported verbatim by OpenD.
   *
   * Read rather than assumed: the UI must not claim "Market Open" when OpenD
   * says the exchange is closed.
   */
  async marketSession(signal?: AbortSignal): Promise<string | null> {
    const response = await fetch(`${API_BASE}/health`, { signal })

    if (!response.ok) {
      throw new ApiError(`Health API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendHealthResponse
    return data.provider?.marketSession ?? null
  },

  /**
   * The Bursa watchlist as held in Moomoo OpenD.
   *
   * Membership is read from the OpenD watchlist group at runtime — there is no
   * client-side list of symbols to drift out of sync with what the user tracks.
   */
  async watchlist(signal?: AbortSignal): Promise<readonly WatchlistEntry[]> {
    const response = await fetch(`${API_BASE}/market/watchlist`, { signal })

    if (!response.ok) {
      throw new ApiError(`Watchlist API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendWatchlistResponse
    return data.symbols.map(normalizeEntry)
  },

  /**
   * Watchlist quotes straight from Moomoo OpenD via the backend.
   *
   * Omitting `symbols` lets the server derive them from the live OpenD
   * watchlist, so the client and server cannot disagree about membership.
   * Throws only on transport/permission failure, so the UI can show an explicit
   * unavailable state instead of inventing data.
   */
  async quotes(signal?: AbortSignal): Promise<readonly QuoteSnapshot[]> {
    const response = await fetch(`${API_BASE}/market/quotes`, { signal })

    if (!response.ok) {
      throw new ApiError(`Quotes API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendQuotesResponse
    return data.quotes.map(normalizeQuote)
  },

  /**
   * The account's open Bursa positions, from Moomoo OpenD's trade context.
   *
   * Holdings are account data rather than market data, so these carry real
   * figures even when the MY quote entitlement blocks prices. Throws on
   * transport/provider failure so the UI shows an explicit unavailable state
   * instead of an empty-but-plausible portfolio.
   */
  async positions(signal?: AbortSignal): Promise<readonly Position[]> {
    const response = await fetch(`${API_BASE}/market/positions`, { signal })

    if (!response.ok) {
      throw new ApiError(`Positions API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendPositionsResponse
    return data.positions.map(normalizePosition)
  },

  /**
   * Closed positions and the profit OpenD booked for them.
   *
   * Preferred over `deals()` for realized P/L: this is OpenD's own netted
   * figure, and it is not limited to the ~90-day deal-history window.
   *
   * Incomplete by nature — a position sold from an IPO allotment is absent from
   * OpenD's position list entirely, so no realized figure exists for it here, or
   * anywhere else. Such sells are reported as unmatched rather than as zero.
   */
  async realized(signal?: AbortSignal): Promise<readonly RealizedPosition[]> {
    const response = await fetch(`${API_BASE}/market/realized`, { signal })

    if (!response.ok) {
      throw new ApiError(`Realized API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendRealizedResponse

    return data.realized.map((row) => ({
      symbol: row.symbol,
      company: row.name ?? row.symbol,
      currency: row.currency,
      realized: row.realized,
    }))
  },

  /**
   * Executed fills from OpenD's deal history, oldest first.
   *
   * Complements `positions()`: that endpoint reports open holdings only, so a
   * position the user sells disappears from it and takes its realized profit
   * with it. This is the only remaining record of closed trades.
   *
   * The response carries the window OpenD actually covered. OpenD caps deal
   * history at roughly 90 days without reporting it, so callers must present any
   * figure built on this as windowed, never as an all-time total.
   */
  async deals(signal?: AbortSignal): Promise<DealHistory> {
    const response = await fetch(`${API_BASE}/market/deals`, { signal })

    if (!response.ok) {
      throw new ApiError(`Deals API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendDealsResponse

    return {
      deals: data.deals.map(normalizeDeal).filter((deal): deal is Deal => deal !== null),
      window:
        data.oldest !== null && data.newest !== null
          ? { oldest: data.oldest, newest: data.newest }
          : null,
    }
  },

  /**
   * Closed positions, grouped by stock.
   *
   * "Closed" means every share bought has been sold again: the holding is flat.
   * OpenD does not expose that directly — `positions()` lists open holdings
   * only, and `realized()` lists booked profit, which a *partially* sold holding
   * also carries — so the closed ones are derived from the deal stream, where a
   * stock whose every BUY is matched by sells is a finished round trip.
   *
   * This is the only endpoint that brings back the individual fills, so the
   * caller can show the buy/sell history behind each closed position. Note the
   * ordering is the fixing for `Position`-style rendering: OpenD's ~90-day deal
   * cap means "no closed positions" is a statement about the window, not about
   * the account's whole past.
   */
  async closedPositions(signal?: AbortSignal): Promise<readonly ClosedTrade[]> {
    const history = await marketApi.deals(signal)
    return deriveClosedTrades(history.deals)
  },

  /**
   * Every deal the persistent ledger has captured so far, oldest first.
   *
   * Unlike `/market/deals` this is not limited to OpenD's ~90-day window — the
   * list only ever grows, so it can span the account's whole recorded history.
   * Feeding this to the realized derivation is what makes the Realized card an
   * all-time figure rather than a windowed one.
   */
  async ledgerDeals(signal?: AbortSignal): Promise<readonly Deal[]> {
    const response = await fetch(`${API_BASE}/ledger/deals`, { signal })

    if (!response.ok) {
      throw new ApiError(`Ledger API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendLedgerResponse

    return data.deals.map((row) => ({
      symbol: row.symbol,
      company: row.company ?? row.symbol,
      side: row.side,
      quantity: row.quantity,
      price: row.price,
      time: row.time,
      dealId: row.dealId,
    }))
  },

  /**
   * Append a batch of fills to the persistent ledger.
   *
   * Idempotent by `dealId`: re-sending a fill moomoo has already delivered is a
   * no-op (`inserted: 0`). The frontend calls this after each live deals fetch
   * so the ledger quietly accrues every trade the 90-day window would otherwise
   * forget.
   */
  async appendDeals(
    deals: readonly Deal[],
    signal?: AbortSignal,
  ): Promise<{ inserted: number; total: number }> {
    const payload = {
      deals: deals
        .filter((d) => d.dealId !== null && d.symbol && d.time)
        .map((d) => ({
          dealId: d.dealId,
          symbol: d.symbol,
          company: d.company,
          market: 'MY',
          side: d.side,
          quantity: d.quantity,
          price: d.price,
          time: d.time,
        })),
    }

    const response = await fetch(`${API_BASE}/ledger/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })

    if (!response.ok) {
      throw new ApiError(`Ledger write API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendLedgerWriteResponse
    return { inserted: data.inserted, total: data.total }
  },

  /**
   * Bursa instruments from the screener: Shariah-compliant, uptrend (above
   * SMA50), priced RM 0.20-1.50, top 30 by volume.
   *
   * Unlike quotes, this data does not come from Moomoo OpenD: it is crawled from
   * KLSE Screener by the `kage-screener` sidecar, which the Laravel backend
   * proxies. Every filter is applied during the crawl, so the response is that
   * subset rather than the whole market. Throws on transport/provider failure so
   * the UI can show an explicit unavailable state instead of inventing rows.
   */
  async screenerShariah(signal?: AbortSignal): Promise<readonly ScreenerRow[]> {
    const response = await fetch(`${API_BASE}/screener/shariah`, { signal })

    if (!response.ok) {
      throw new ApiError(`Screener API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendScreenerResponse
    return data.rows.map(normalizeScreenerRow)
  },
}
