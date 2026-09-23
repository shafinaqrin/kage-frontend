import type { QuoteSnapshot } from '../domain/types'

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

/**
 * The watchlist is declared here rather than stored in the database.
 * Codes are Bursa numeric codes; the backend maps them to Moomoo `MY.<code>`.
 */
export const watchlist = [
  { symbol: '1155', company: 'Malayan Banking Berhad' },
  { symbol: '1023', company: 'CIMB Group Holdings Berhad' },
  { symbol: '1295', company: 'Public Bank Berhad' },
  { symbol: '5347', company: 'Tenaga Nasional Berhad' },
  { symbol: '5225', company: 'IHH Healthcare Berhad' },
  { symbol: '3182', company: 'Genting Berhad' },
  { symbol: '5681', company: 'PETRONAS Dagangan Berhad' },
  { symbol: '4707', company: 'Nestle (Malaysia) Berhad' },
] as const

/** Raw shape returned by the Laravel backend, which proxies Moomoo OpenD. */
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
  source: 'moomoo-opend'
  quotes: BackendQuote[]
}

/**
 * Normalise an OpenD-backed quote. When OpenD has no permission or no data the
 * snapshot is marked `available: false` and the UI renders "No data" — no
 * fabricated price is ever substituted.
 */
function normalizeQuote(quote: BackendQuote, fallbackName: string): QuoteSnapshot {
  if (!quote.available || quote.last === null) {
    return {
      symbol: quote.symbol,
      company: quote.name ?? fallbackName,
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
    company: quote.name ?? fallbackName,
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

export const marketApi = {
  /**
   * Watchlist quotes straight from Moomoo OpenD via the backend.
   * Throws on failure so the UI can show an explicit unavailable state.
   */
  async quotes(signal?: AbortSignal): Promise<readonly QuoteSnapshot[]> {
    const codes = watchlist.map((entry) => entry.symbol).join(',')
    const response = await fetch(`${API_BASE}/market/quotes?symbols=${codes}`, { signal })

    if (!response.ok) {
      throw new ApiError(`Quotes API responded ${response.status}`, response.status)
    }

    const data = (await response.json()) as BackendQuotesResponse
    const names = new Map<string, string>(
      watchlist.map((entry) => [entry.symbol as string, entry.company as string]),
    )

    return data.quotes.map((quote) => normalizeQuote(quote, names.get(quote.symbol) ?? quote.symbol))
  },
}
