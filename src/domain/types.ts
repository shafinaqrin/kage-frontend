export type DataSource = 'demo' | 'live'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export type MarketSession = 'pre-open' | 'open' | 'lunch-break' | 'afternoon' | 'closed'

export type TrendDirection = 'up' | 'down' | 'flat'

export interface SymbolRef {
  readonly symbol: string
  readonly company: string
}

export interface QuoteSnapshot {
  readonly symbol: string
  readonly company: string
  /** False when Moomoo OpenD has no data/permission — the UI shows "No data". */
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
