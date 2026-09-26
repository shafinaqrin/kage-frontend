import type { QuoteSnapshot, WatchlistEntry } from '../domain/types'

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
}
