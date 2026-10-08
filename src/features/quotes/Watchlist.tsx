'use client'

import { useMemo, useState } from 'react'
import type { ConnectionStatus, QuoteSnapshot } from '../../domain/types'
import { formatPrice, formatSignedPercent, formatVolume } from '../../lib/format'
import { useTableSort } from '../../lib/useSort'
import { SortableHeader } from '../shared/SortableHeader'
import { Icon } from '../shared/Icon'
import {
  emptyStateClass,
  numCellClass,
  panelClass,
  panelHeadClass,
  panelHeadTitleClass,
  panelSubClass,
  pillClass,
  symbolButtonClass,
  symbolCodeClass,
  symbolNameClass,
  tableCellClass,
  tableClass,
  tableScrollClass,
  toneTextClass,
} from '../shared/positionCells'

const HIDDEN_MOOMOO_GROUPS = new Set([
  'US', 'Futures', 'Space', 'Options', 'Crypto', 'US Options', 'HK', 'SG',
  'Korea Stocks', 'JP', 'CN', 'AU', 'CA', 'Index', 'Bonds', 'Notes',
])

interface WatchlistProps {
  quotes: readonly QuoteSnapshot[]
  selected: string
  onSelect: (symbol: string) => void
  status: ConnectionStatus
  groups: readonly string[]
  selectedGroup: string
  onGroupChange: (group: string) => void
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
export function Watchlist({ quotes, selected, onSelect, status, groups, selectedGroup, onGroupChange }: WatchlistProps) {
  const [query, setQuery] = useState('')
  const visibleGroups = groups.filter((group) => !HIDDEN_MOOMOO_GROUPS.has(group))
  const categoryGroups = visibleGroups.filter((group) => group !== 'All')
  const { rows: sorted, control } = useTableSort<SortKey, QuoteSnapshot>(quotes, SORT_ACCESSORS)

  const filtered = useMemo(() => {
    const inCategory = sorted
    const needle = query.trim().toLowerCase()
    if (!needle) return inCategory
    return inCategory.filter(
      (q) => q.symbol.toLowerCase().includes(needle) || q.company.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  return (
    <section className={panelClass} aria-label="Watchlist">
      <header className={panelHeadClass}>
        <div>
          <h2 className={panelHeadTitleClass}>Watchlist</h2>
          <p className={panelSubClass}>{filtered.length} of {quotes.length} symbols</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 max-[768px]:justify-start">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-[var(--m3-surface-container)] p-1" aria-label="Watchlist categories" role="tablist">
            {categoryGroups.map((group) => {
              const active = group === selectedGroup
              return (
                <button
                  key={group}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[0.7rem] font-semibold transition-all duration-300 motion-standard ${active ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-[0_0.3rem_0.8rem_color-mix(in_srgb,var(--m3-primary)_22%,transparent)]' : 'text-muted hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_7%,transparent)] hover:text-ink'}`}
                  onClick={() => onGroupChange(group)}
                >
                  {group}
                </button>
              )
            })}
          </div>
          <label className="flex h-9 min-w-[9rem] max-w-full flex-1 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_68%,transparent)] bg-[var(--m3-surface-container)] px-3 text-muted transition-[border-color,box-shadow] duration-300 motion-standard focus-within:border-[var(--m3-primary)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--m3-primary)_14%,transparent)] max-[768px]:w-full">
          <Icon name="search" size={16} />
          <input
            type="search"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-muted/70"
            placeholder="Search symbols"
            aria-label="Filter watchlist"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          </label>
        </div>
      </header>

      {quotes.length === 0 ? (
        <p className={emptyStateClass} role="status">
          {status === 'connecting'
            ? 'Loading the Bursa watchlist from Moomoo OpenD…'
            : 'No Bursa symbols are in the Moomoo OpenD watchlist. Add some in moomoo and they appear here.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className={emptyStateClass}>No symbols match “{query}”.</p>
      ) : (
        <div className={tableScrollClass}>
          <table className={tableClass}>
            <caption className="sr-only">
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
                    className={`cursor-pointer transition-colors duration-[220ms] motion-standard hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_6%,transparent)] ${
                      q.symbol === selected ? 'bg-[color-mix(in_srgb,var(--m3-primary)_12%,transparent)]' : ''
                    } ${q.available ? '' : 'opacity-55'}`}
                    onClick={() => onSelect(q.symbol)}
                    title={rowTitle}
                  >
                    <th scope="row" className={tableCellClass}>
                      <button
                        type="button"
                        className={symbolButtonClass}
                        onClick={() => onSelect(q.symbol)}
                        title={rowTitle}
                      >
                        <span className={symbolCodeClass}>{q.symbol}</span>
                        <span className={symbolNameClass}>{q.company}</span>
                      </button>
                    </th>
                    <td className={`${numCellClass} ${tableCellClass}`}>{formatValue(q, (s) => s.last, formatPrice)}</td>
                    <td className={`${numCellClass} ${tableCellClass} ${toneTextClass(tone)}`}>
                      {q.available ? (
                        <span className={pillClass(tone)}>
                          {formatSignedPercent(q.changePercent ?? 0)}
                        </span>
                      ) : (
                        <span className={pillClass('flat')}>{NO_DATA}</span>
                      )}
                    </td>
                    <td className={`${numCellClass} ${tableCellClass} text-muted`}>{formatValue(q, (s) => s.volume, formatVolume)}</td>
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
