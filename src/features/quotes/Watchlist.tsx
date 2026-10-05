'use client'

import { useMemo, useState } from 'react'
import type { ConnectionStatus, QuoteSnapshot } from '../../domain/types'
import { formatPrice, formatSignedPercent, formatVolume } from '../../lib/format'
import { useTableSort } from '../../lib/useSort'
import { SortableHeader } from '../shared/SortableHeader'

interface WatchlistProps {
  quotes: readonly QuoteSnapshot[]
  selected: string
  onSelect: (symbol: string) => void
  status: ConnectionStatus
}

const NO_DATA = '—'

/**
 * Sort keys mirror the visible columns, so `Chg %` sorts by changePercent while
 * the column shows the percentage -- there is no bare `Chg` column here, unlike
 * the screener.
 */
type SortKey = 'symbol' | 'last' | 'changePercent' | 'volume'

/** Module scope keeps the accessor reference stable for the sort memo. */
const SORT_ACCESSORS: Record<SortKey, (q: QuoteSnapshot) => number | string | null> = {
  symbol: (q) => q.symbol,
  last: (q) => (q.available ? q.last : null),
  changePercent: (q) => (q.available ? q.changePercent : null),
  volume: (q) => (q.available ? q.volume : null),
}

function formatValue(
  snapshot: QuoteSnapshot,
  pick: (q: QuoteSnapshot) => number | null,
  format: (n: number) => string,
): string {
  if (!snapshot.available) return NO_DATA
  const raw = pick(snapshot)
  return raw === null ? NO_DATA : format(raw)
}

/**
 * The user's Bursa watchlist, as held in Moomoo OpenD.
 *
 * Rows stay clickable to select a symbol; sorting lives on the column headers so
 * the two never compete for the same gesture.
 */
export function Watchlist({ quotes, selected, onSelect, status }: WatchlistProps) {
  const [query, setQuery] = useState('')
  const { rows: sorted, control } = useTableSort<SortKey, QuoteSnapshot>(quotes, SORT_ACCESSORS)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(
      (q) => q.symbol.toLowerCase().includes(needle) || q.company.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  return (
    <section className="panel min-w-0 max-w-full" aria-label="Watchlist">
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
            ? 'Loading the Bursa watchlist from Moomoo OpenD…'
            : 'No Bursa symbols are in the Moomoo OpenD watchlist. Add some in moomoo and they appear here.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No symbols match “{query}”.</p>
      ) : (
        <div className="table-scroll">
          <table className="quote-table">
            <caption className="visually-hidden">
              Bursa watchlist from Moomoo OpenD. Column headers are sortable.
            </caption>
            <thead>
              <tr>
                <SortableHeader label="Symbol" control={control('symbol')} />
                <SortableHeader label="Last" numeric control={control('last')} />
                <SortableHeader label="Chg %" numeric control={control('changePercent')} />
                <SortableHeader label="Volume" numeric control={control('volume')} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const tone = q.available ? (q.trend === 'up' ? 'up' : q.trend === 'down' ? 'down' : 'flat') : 'flat'
                const rowTitle = q.available ? undefined : (q.reason ?? 'No data from Moomoo OpenD')
                return (
                  <tr
                    key={q.symbol}
                    className={`quote-row ${q.symbol === selected ? 'is-selected' : ''} ${q.available ? '' : 'is-unavailable'}`}
                    onClick={() => onSelect(q.symbol)}
                    title={rowTitle}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        className="symbol-btn"
                        onClick={() => onSelect(q.symbol)}
                        title={rowTitle}
                      >
                        <span className="symbol-code">{q.symbol}</span>
                        <span className="symbol-name">{q.company}</span>
                      </button>
                    </th>
                    <td className="num">{formatValue(q, (s) => s.last, formatPrice)}</td>
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
