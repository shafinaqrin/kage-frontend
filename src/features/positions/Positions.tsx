'use client'

import { useMemo, useState } from 'react'
import type { ConnectionStatus, Position } from '../../domain/types'
import { useTableSort } from '../../lib/useSort'
import { SortableHeader } from '../shared/SortableHeader'
import { Icon } from '../shared/Icon'
import {
  PercentPill,
  emptyStateClass,
  formatMoney,
  formatPriceWithCurrency,
  formatQuantity,
  formatSignedMoney,
  formatValue,
  numCellClass,
  panelClass,
  panelHeadClass,
  panelHeadTitleClass,
  panelSubClass,
  symbolButtonClass,
  symbolCodeClass,
  symbolNameClass,
  tableCellClass,
  tableClass,
  tableScrollClass,
  toneTextClass,
} from '../shared/positionCells'

interface PositionsProps {
  positions: readonly Position[]
  status: ConnectionStatus
  error: string | null
}

/** Sort keys mirror the visible columns. */
type SortKey = 'symbol' | 'quantity' | 'averageCost' | 'last' | 'marketValue' | 'profitLoss' | 'profitLossPercent'

/** Module scope keeps the accessor reference stable for the sort memo. */
const SORT_ACCESSORS: Record<SortKey, (p: Position) => number | string | null> = {
  symbol: (p) => p.symbol,
  quantity: (p) => p.quantity,
  averageCost: (p) => p.averageCost,
  last: (p) => p.last,
  marketValue: (p) => p.marketValue,
  profitLoss: (p) => p.profitLoss,
  profitLossPercent: (p) => p.profitLossPercent,
}

/**
 * The account's open positions, read from Moomoo OpenD's trade context.
 *
 * Unlike the watchlist this is account data, not market data: OpenD returns real
 * cost, value and P/L even when the MY quote entitlement blocks prices. A field
 * OpenD omits renders "—" rather than a zero that would read as a real figure.
 */
export function Positions({ positions, status, error }: PositionsProps) {
  const [query, setQuery] = useState('')
  const { rows: sorted, control } = useTableSort<SortKey, Position>(positions, SORT_ACCESSORS)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(
      (p) => p.symbol.toLowerCase().includes(needle) || p.company.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  return (
    <section className={panelClass} aria-label="Open positions">
      <header className={panelHeadClass}>
        <div>
          <h2 className={panelHeadTitleClass}>Open Positions</h2>
          <p className={panelSubClass}>{filtered.length} of {positions.length} holdings</p>
        </div>
        <label className="flex h-9 w-[10rem] max-w-full min-w-0 flex-1 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_68%,transparent)] bg-[var(--m3-surface-container)] px-3 text-muted transition-[border-color,box-shadow] duration-300 motion-standard focus-within:border-[var(--m3-primary)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--m3-primary)_14%,transparent)] max-[768px]:w-full">
          <Icon name="search" size={16} />
          <input
            type="search"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-muted/70"
            placeholder="Search holdings"
            aria-label="Filter open positions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      {positions.length === 0 ? (
        <p className={emptyStateClass} role="status">
          {error
            ? `${error} — no open positions shown.`
            : status === 'connecting'
              ? 'Loading positions from Moomoo OpenD…'
              : 'No open Bursa positions in the Moomoo account.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className={emptyStateClass}>No holdings match “{query}”.</p>
      ) : (
        <div className={tableScrollClass}>
          <table className={tableClass}>
            <caption className="sr-only">
              Open Bursa positions from Moomoo OpenD. Column headers are sortable.
            </caption>
            <thead>
              <tr>
                <SortableHeader label="Symbol" control={control('symbol')} />
                <SortableHeader label="Qty" numeric control={control('quantity')} />
                <SortableHeader label="Avg cost" numeric control={control('averageCost')} />
                <SortableHeader label="Last" numeric control={control('last')} />
                <SortableHeader label="Mkt value" numeric control={control('marketValue')} />
                <SortableHeader label="P/L" numeric control={control('profitLoss')} />
                <SortableHeader label="P/L %" numeric control={control('profitLossPercent')} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.symbol}
                  className="cursor-pointer transition-colors duration-[220ms] motion-standard hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_6%,transparent)]"
                >
                  <th scope="row" className={tableCellClass}>
                    <span className={symbolButtonClass}>
                      <span className={symbolCodeClass}>{p.symbol}</span>
                      <span className={symbolNameClass}>{p.company}</span>
                    </span>
                  </th>
                  <td className={`${numCellClass} ${tableCellClass}`}>{formatValue(p, (x) => x.quantity, formatQuantity)}</td>
                  <td className={`${numCellClass} ${tableCellClass} text-muted`}>{formatValue(p, (x) => x.averageCost, (n, x) => formatPriceWithCurrency(x.currency, n))}</td>
                  <td className={`${numCellClass} ${tableCellClass}`}>{formatValue(p, (x) => x.last, (n, x) => formatPriceWithCurrency(x.currency, n))}</td>
                  <td className={`${numCellClass} ${tableCellClass}`}>{formatValue(p, (x) => x.marketValue, (n, x) => formatMoney(x.currency, n))}</td>
                  <td className={`${numCellClass} ${tableCellClass} ${toneTextClass(p.trend)}`}>
                    {formatValue(p, (x) => x.profitLoss, (n, x) => formatSignedMoney(x.currency, n))}
                  </td>
                  <td className={`${numCellClass} ${tableCellClass} ${toneTextClass(p.trend)}`}>
                    <PercentPill value={p.profitLossPercent} trend={p.trend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
