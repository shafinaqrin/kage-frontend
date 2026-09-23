'use client'

import { useState } from 'react'
import type { ConnectionStatus, QuoteSnapshot } from '../../domain/types'
import { formatPrice, formatSigned, formatSignedPercent, formatVolume } from '../../lib/format'

interface WatchlistProps {
  quotes: readonly QuoteSnapshot[]
  selected: string
  onSelect: (symbol: string) => void
  status: ConnectionStatus
}

const NO_DATA = '—'

function formatValue(
  snapshot: QuoteSnapshot,
  pick: (q: QuoteSnapshot) => number | null,
  format: (n: number) => string,
): string {
  if (!snapshot.available) return NO_DATA
  const raw = pick(snapshot)
  return raw === null ? NO_DATA : format(raw)
}

export function Watchlist({ quotes, selected, onSelect, status }: WatchlistProps) {
  const [query, setQuery] = useState('')

  const filtered = quotes.filter(
    (q) =>
      q.symbol.toLowerCase().includes(query.toLowerCase()) ||
      q.company.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <section className="panel watchlist-panel min-w-0 max-w-full" aria-label="Watchlist">
      <header className="panel-head">
        <div>
          <h2>Watchlist</h2>
          <p className="panel-sub">{filtered.length} of {quotes.length} symbols</p>
        </div>
        <label className="flex h-9 w-[10rem] max-w-full min-w-0 flex-1 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_68%,transparent)] bg-[var(--m3-surface-container)] px-3 text-muted transition-[border-color,box-shadow] duration-300 motion-standard focus-within:border-[var(--m3-primary)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--m3-primary)_14%,transparent)] max-[768px]:w-full">
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-muted/70"
            placeholder="Search symbols"
            aria-label="Filter watchlist"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      {quotes.length === 0 ? (
        <p className="empty-state" role="status">
          {status === 'connecting'
            ? 'Loading quotes from Moomoo OpenD…'
            : 'No quote data. Moomoo OpenD returned nothing for this watchlist — no fallback data is shown.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No symbols match “{query}”.</p>
      ) : (
        <div className="table-scroll">
          <table className="quote-table">
            <caption className="visually-hidden">Bursa watchlist quotes from Moomoo OpenD</caption>
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col" className="num">Last</th>
                <th scope="col" className="num">Chg</th>
                <th scope="col" className="num">Chg&nbsp;%</th>
                <th scope="col" className="num">Volume</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const tone = q.available ? (q.trend === 'up' ? 'up' : q.trend === 'down' ? 'down' : 'flat') : 'flat'
                return (
                  <tr
                    key={q.symbol}
                    className={`quote-row ${q.symbol === selected ? 'is-selected' : ''} ${q.available ? '' : 'is-unavailable'}`}
                    onClick={() => onSelect(q.symbol)}
                    title={q.available ? undefined : (q.reason ?? 'No data from Moomoo OpenD')}
                  >
                    <th scope="row">
                      <button type="button" className="symbol-btn" onClick={() => onSelect(q.symbol)}>
                        <span className="symbol-code">{q.symbol}</span>
                        <span className="symbol-name">{q.company}</span>
                      </button>
                    </th>
                    <td className="num">{formatValue(q, (s) => s.last, formatPrice)}</td>
                    <td className={`num tone-${tone}`}>{formatValue(q, (s) => s.change, formatSigned)}</td>
                    <td className={`num tone-${tone}`}>
                      {q.available ? (
                        <span className={`pill tone-${tone}-bg`}>
                          {formatSignedPercent(q.changePercent ?? 0)}
                        </span>
                      ) : (
                        <span className="pill tone-flat-bg">{NO_DATA}</span>
                      )}
                    </td>
                    <td className="num muted">{formatValue(q, (s) => s.volume, formatVolume)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
