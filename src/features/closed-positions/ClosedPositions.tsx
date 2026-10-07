'use client'

import { Fragment, useMemo, useState } from 'react'
import type { ClosedTrade, ConnectionStatus, Deal } from '../../domain/types'
import { formatClock } from '../../lib/format'
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
  symbolCodeClass,
  symbolNameClass,
  tableCellClass,
  tableClass,
  tableScrollClass,
  toneTextClass,
} from '../shared/positionCells'

interface ClosedPositionsProps {
  trades: readonly ClosedTrade[]
  status: ConnectionStatus
  error: string | null
}

/**
 * Sort keys mirror the visible columns, with the closed-only ones added: the
 * position columns keep their names so the header row reads the same in both
 * tables, and the extra columns are what sorting "by when I closed it" needs.
 */
type SortKey =
  | 'symbol'
  | 'quantity'
  | 'averageCost'
  | 'last'
  | 'marketValue'
  | 'profitLoss'
  | 'profitLossPercent'
  | 'closedAt'

/** Module scope keeps the accessor reference stable for the sort memo. */
const SORT_ACCESSORS: Record<SortKey, (t: ClosedTrade) => number | string | null> = {
  symbol: (t) => t.symbol,
  quantity: (t) => t.quantity,
  averageCost: (t) => t.averageCost,
  last: (t) => t.last,
  marketValue: (t) => t.marketValue,
  profitLoss: (t) => t.profitLoss,
  profitLossPercent: (t) => t.profitLossPercent,
  closedAt: (t) => t.closedAt,
}

/** "2026-10-05 11:45:14.108" → "5 Oct 2026". Null when OpenD sent no time. */
function formatDay(time: string): string {
  // OpenD's own format, and a space rather than "T", so `Date` would be parsing
  // an implementation-defined string. Only the date half is ever shown, so the
  // parts are taken directly instead of round-tripping through a Date.
  const [date] = time.split(' ')
  const [year, month, day] = (date ?? '').split('-')
  if (!year || !month || !day) return time

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const name = months[Number(month) - 1]
  if (!name) return time

  return `${Number(day)} ${name} ${year}`
}

/** How one fill is labelled inside a position's history. */
function DealRow({ deal, notFirst }: { deal: Deal; notFirst: boolean }) {
  const side = deal.side === 'BUY' ? 'Buy' : 'Sell'
  const time = deal.time ? `${formatDay(deal.time)}, ${formatClock(deal.time)}` : '—'

  const sideTagClass =
    deal.side === 'BUY'
      ? 'bg-[color-mix(in_srgb,var(--m3-primary)_16%,transparent)] text-primary'
      : 'bg-tertiary-container text-on-tertiary-container'
  const separator = notFirst ? ' border-t border-[color-mix(in_srgb,var(--m3-outline-variant)_26%,transparent)]' : ''

  return (
    <tr>
      <td className={`${dealCellClass} text-muted${separator}`}>{time}</td>
      <td className={`${dealCellClass}${separator}`}>
        <span className={`${sideTagClass} inline-block min-w-[2.6rem] rounded-full px-[0.45rem] py-[0.12rem] text-center text-[0.62rem] font-extrabold uppercase tracking-[0.06em]`}>
          {side}
        </span>
      </td>
      <td className={`${numCellClass} ${dealCellClass}${separator}`}>{deal.quantity === null ? '—' : formatQuantity(deal.quantity)}</td>
      <td className={`${numCellClass} ${dealCellClass}${separator}`}>{deal.price === null ? '—' : formatPriceWithCurrency('MYR', deal.price)}</td>
      <td className={`${numCellClass} ${dealCellClass} text-muted${separator}`}>
        {deal.quantity === null || deal.price === null
          ? '—'
          : formatMoney('MYR', deal.quantity * deal.price)}
      </td>
    </tr>
  )
}

/**
 * Positions the account has finished trading, one row per stock.
 *
 * Deliberately the same shape as Positions — same panel, same columns, same
 * money formatting — because it answers the same question about a different set
 * of holdings. What differs is what "Last" and "Mkt value" can mean once a
 * position is over: there is no market price any more, so they are the exit
 * price and the exit proceeds, and the P/L is the round trip's. Extra columns
 * carry what only a *closed* position has — when it was closed, and where it was
 * entered and exited.
 *
 * Rows expand in place to show every fill, which is the "history of me buying
 * and selling" for that stock. Ordering the buy/sell record is the whole reason
 * this is rebuilt from the deal stream rather than read from OpenD's booked
 * realized figure.
 */
/** The lighter cell padding used by the fills (sub-)table inside a row. */
const dealCellClass =
  'px-[0.7rem] py-[0.42rem] text-left tabular-nums max-md:px-[0.3rem] max-md:py-[0.38rem]'
export function ClosedPositions({ trades, status, error }: ClosedPositionsProps) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const { rows: sorted, control } = useTableSort<SortKey, ClosedTrade>(trades, SORT_ACCESSORS)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(
      (t) => t.symbol.toLowerCase().includes(needle) || t.company.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  // A position closed entirely at a profit is a win; anything else is not
  // claimed as one. Same rule the win rate uses for booked realized P/L.
  const wins = useMemo(() => trades.filter((t) => (t.profitLoss ?? 0) > 0).length, [trades])

  /** The day a position was closed, e.g. "closed 5 Oct 2026". */
  const closedLabel = (trade: ClosedTrade): string =>
    trade.closedAt === null ? 'close date not reported' : `closed ${formatDay(trade.closedAt)}`

  return (
    <section className={panelClass} aria-label="Closed positions">
      <header className={panelHeadClass}>
        <div>
          <h2 className={panelHeadTitleClass}>Closed Positions</h2>
          <p className={panelSubClass}>
            {filtered.length} of {trades.length} closed
            {trades.length === 0 ? '' : ` · ${wins}W - ${trades.length - wins}L`}
          </p>
        </div>
        <label className="flex h-9 w-[10rem] max-w-full min-w-0 flex-1 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_68%,transparent)] bg-[var(--m3-surface-container)] px-3 text-muted transition-[border-color,box-shadow] duration-300 motion-standard focus-within:border-[var(--m3-primary)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--m3-primary)_14%,transparent)] max-[768px]:w-full">
          <Icon name="search" size={16} />
          <input
            type="search"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-muted/70"
            placeholder="Search closed"
            aria-label="Filter closed positions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      {trades.length === 0 ? (
        <p className={emptyStateClass} role="status">
          {error
            ? `${error} — no closed positions shown.`
            : status === 'connecting'
              ? 'Loading closed positions from Moomoo OpenD…'
              : 'No stock has been fully sold in Moomoo OpenD’s deal window.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className={emptyStateClass}>No closed positions match “{query}”.</p>
      ) : (
        <div className={tableScrollClass}>
          <table className={`${tableClass} closed-table`}>
            <caption className="sr-only">
              Stocks whose every recorded buy has been sold, grouped by symbol from Moomoo OpenD.
              Column headers are sortable; every row expands to show its individual buys and sells.
            </caption>
            <thead>
              <tr>
                <SortableHeader label="Symbol" control={control('symbol')} />
                {/* On narrow screens Qty and Mkt value are dropped; the P/L pair
                    and the close date — the reasons to open this table at all — stay. */}
                <SortableHeader label="Qty" numeric control={control('quantity')} className="max-md:hidden" />
                <SortableHeader label="Avg cost" numeric control={control('averageCost')} />
                <SortableHeader label="Last" numeric control={control('last')} />
                <SortableHeader label="Mkt value" numeric control={control('marketValue')} className="max-md:hidden" />
                <SortableHeader label="P/L" numeric control={control('profitLoss')} />
                <SortableHeader label="P/L %" numeric control={control('profitLossPercent')} />
                <SortableHeader label="Closed" numeric control={control('closedAt')} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((trade) => {
                const isOpen = expanded === trade.symbol
                const detailId = `closed-deals-${trade.symbol}`

                return (
                  <Fragment key={trade.symbol}>
                    <tr
                      className="cursor-pointer transition-colors duration-[220ms] motion-standard hover:bg-[color-mix(in_srgb,var(--m3-primary)_7%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--m3-on-surface)_6%,transparent)]"
                      onClick={() => setExpanded(isOpen ? null : trade.symbol)}
                    >
                      <th scope="row" className={tableCellClass}>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer flex-col gap-[0.1rem] border-0 bg-transparent p-0 text-left text-inherit"
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          title={isOpen ? 'Hide buys and sells' : 'Show buys and sells'}
                          onClick={(e) => {
                            // The row itself toggles too, so the whole row is a
                            // target; stopping here would leave the row inert.
                            e.stopPropagation()
                            setExpanded(isOpen ? null : trade.symbol)
                          }}
                        >
                          <span className={symbolCodeClass}>
                            <span
                              className={`${isOpen ? 'rotate-90 text-primary' : 'text-muted'} mr-[0.15rem] inline-block w-[0.85rem] text-[0.7rem] transition-[transform,color] duration-250 motion-spring`}
                              aria-hidden="true"
                            >
                              ▸
                            </span>
                            {trade.symbol}
                          </span>
                          <span className={symbolNameClass}>{trade.company}</span>
                        </button>
                      </th>
                      <td className={`${numCellClass} ${tableCellClass} max-md:hidden`}>
                        {formatValue(trade, (t) => t.quantity, formatQuantity)}
                      </td>
                      <td className={`${numCellClass} ${tableCellClass} text-muted`}>
                        {formatValue(trade, (t) => t.averageCost, (n, t) => formatPriceWithCurrency(t.currency, n))}
                      </td>
                      <td className={`${numCellClass} ${tableCellClass}`}>
                        {formatValue(trade, (t) => t.last, (n, t) => formatPriceWithCurrency(t.currency, n))}
                        <span className="max-md:hidden block text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-muted opacity-75">exit</span>
                      </td>
                      <td className={`${numCellClass} ${tableCellClass} max-md:hidden`}>
                        {formatValue(trade, (t) => t.marketValue, (n, t) => formatMoney(t.currency, n))}
                        <span className="max-md:hidden block text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-muted opacity-75">sold</span>
                      </td>
                      <td className={`${numCellClass} ${tableCellClass} ${toneTextClass(trade.trend)}`}>
                        <strong>
                          {formatValue(trade, (t) => t.profitLoss, (n, t) => formatSignedMoney(t.currency, n))}
                        </strong>
                      </td>
                      <td className={`${numCellClass} ${tableCellClass} ${toneTextClass(trade.trend)}`}>
                        <PercentPill value={trade.profitLossPercent} trend={trade.trend} />
                      </td>
                      <td className={`${numCellClass} ${tableCellClass} text-muted`}>
                        {trade.closedAt === null ? '—' : formatDay(trade.closedAt)}
                        <span className="max-md:hidden block text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-muted opacity-75">
                          {trade.deals.length} fill{trade.deals.length === 1 ? '' : 's'}
                        </span>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr id={detailId}>
                        <td colSpan={8} className="bg-[color-mix(in_srgb,var(--m3-on-surface)_3%,transparent)] p-0">
                          <div className="ml-[0.9rem] animate-detail-in border-l-2 border-[color-mix(in_srgb,var(--m3-primary)_55%,transparent)] px-4 pb-4 pt-[0.85rem] max-md:ml-0 max-md:px-2 max-md:py-[0.7rem] max-md:pb-[0.85rem]">
                            <p className="mb-[0.6rem] text-[0.7rem] font-bold uppercase tracking-[0.04em] text-muted">
                              {trade.symbol} {trade.company} · {closedLabel(trade)}
                            </p>
                            <table className="w-full border-collapse text-[0.76rem] max-md:text-[0.68rem]">
                              <caption className="sr-only">
                                Individual fills for {trade.symbol}, oldest first.
                              </caption>
                              <thead>
                                <tr>
                                  <th scope="col" className={`${dealCellClass} border-b border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] text-[0.6rem] uppercase tracking-[0.12em] text-muted`}>Time</th>
                                  <th scope="col" className={`${dealCellClass} border-b border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] text-[0.6rem] uppercase tracking-[0.12em] text-muted`}>Side</th>
                                  <th scope="col" className={`${numCellClass} ${dealCellClass} border-b border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] text-[0.6rem] uppercase tracking-[0.12em] text-muted`}>Qty</th>
                                  <th scope="col" className={`${numCellClass} ${dealCellClass} border-b border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] text-[0.6rem] uppercase tracking-[0.12em] text-muted`}>Price</th>
                                  <th scope="col" className={`${numCellClass} ${dealCellClass} border-b border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] text-[0.6rem] uppercase tracking-[0.12em] text-muted`}>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trade.deals.map((deal, index) => (
                                  <DealRow key={`${deal.side}-${deal.time}-${index}`} deal={deal} notFirst={index > 0} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
