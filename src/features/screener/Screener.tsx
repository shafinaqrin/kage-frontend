'use client'

import { useMemo, useState } from 'react'
import type { ConnectionStatus, ScreenerRow } from '../../domain/types'
import { formatRatio, formatPrice, formatSignedPercent, formatVolume } from '../../lib/format'
import { useTableSort, type SortDirection } from '../../lib/useSort'
import { SortableHeader } from '../shared/SortableHeader'
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

interface ScreenerProps {
  rows: readonly ScreenerRow[]
  status: ConnectionStatus
  error: string | null
}

const NO_DATA = '—'

/** How many rows one page shows. */
const PAGE_SIZE = 10

type SortKey = 'code' | 'price' | 'changePercent' | 'volume' | 'pe' | 'roe' | 'nta' | 'dy' | 'marketCap'

/**
 * Sort accessors. Defined at module scope so the reference is stable across
 * renders -- rebuilding this object inline would invalidate the sort memo on
 * every keystroke in the search box.
 */
const SORT_ACCESSORS: Record<SortKey, (r: ScreenerRow) => number | string | null> = {
  code: (r) => r.code,
  price: (r) => r.price,
  changePercent: (r) => r.changePercent,
  volume: (r) => r.volume,
  pe: (r) => r.pe,
  roe: (r) => r.roe,
  nta: (r) => r.nta,
  dy: (r) => r.dy,
  marketCap: (r) => r.marketCap,
}

/**
 * Opens on highest volume first: the most actively traded names are the useful
 * starting point, and it is stable enough to be a sensible default.
 */
const INITIAL_SORT: { key: SortKey; direction: SortDirection } = { key: 'volume', direction: 'desc' }

/**
 * Render a nullable figure, showing "—" when the upstream site published no
 * value. Never substitutes 0, which would read as a real figure.
 */
function value(pick: () => number | null, format: (n: number) => string): string {
  const raw = pick()
  return raw === null ? NO_DATA : format(raw)
}

/**
 * Bursa instruments from the `kage-screener` sidecar, crawled from KLSE Screener.
 *
 * This is a different data source from Moomoo OpenD: the quote path cannot
 * supply fundamentals like PE, ROE, or NTA. The crawl applies four filters --
 * Shariah-compliant only (re-verified per row), uptrend (price above SMA50), the
 * RM 0.20-1.50 price band, and the top 30 by volume -- so the row count here is
 * that filtered subset, not the whole market.
 */
export function Screener({ rows, status, error }: ScreenerProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { rows: sorted, control } = useTableSort<SortKey, ScreenerRow>(rows, SORT_ACCESSORS, INITIAL_SORT)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(
      (r) => r.code.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Clamp in case the field shrinks (a search narrows the list) so the current
  // slice never dangles past the last page.
  const current = Math.min(page, pageCount)
  const pageRows = useMemo(
    () => filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    [filtered, current],
  )

  // Jump back to the first page whenever the query or sort changes, so the user
  // is never dropped onto a later page of a different result set.
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handlePage = (next: number) => setPage(Math.min(Math.max(next, 1), pageCount))

  return (
    <section className={panelClass} aria-label="Screener">
      <header className={panelHeadClass}>
        <div>
          <h2 className={panelHeadTitleClass}>Screener</h2>
          <p className={panelSubClass}>
            {filtered.length} of {rows.length} · Shariah · Uptrend · RM 0.20–1.50
          </p>
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
            aria-label="Filter screener results"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
          />
        </label>
      </header>

      {error ? (
        <p className={emptyStateClass} role="status">
          {error} — no screener data shown.
        </p>
      ) : rows.length === 0 ? (
        <p className={emptyStateClass} role="status">
          {status === 'connecting'
            ? 'Loading Shariah-compliant stocks from KLSE Screener…'
            : 'No Shariah-compliant uptrend stocks in the RM 0.20–1.50 price band.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className={emptyStateClass}>No symbols match “{query}”.</p>
      ) : (
        <div className={`${tableScrollClass} flex-1 min-h-0 overflow-y-auto`}>
          <table className={tableClass}>
            <caption className="sr-only">
              Shariah-compliant Bursa Malaysia stocks in an uptrend, priced RM 0.20 to RM 1.50,
              ranked by volume — the top 30 most active, from KLSE Screener. Column headers are
              sortable.
            </caption>
            <thead>
              <tr>
                <SortableHeader label="Symbol" control={control('code')} />
                <SortableHeader label="Last" numeric control={control('price')} />
                <SortableHeader label="Chg %" numeric control={control('changePercent')} />
                <SortableHeader label="Vol" numeric control={control('volume')} />
                <SortableHeader label="PE" numeric control={control('pe')} />
                <SortableHeader label="ROE" numeric control={control('roe')} />
                <SortableHeader label="NTA" numeric control={control('nta')} />
                <SortableHeader label="DY" numeric control={control('dy')} />
                <SortableHeader label="Mkt Cap" numeric control={control('marketCap')} />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const tone =
                  r.change === null ? 'flat' : r.change > 0 ? 'up' : r.change < 0 ? 'down' : 'flat'
                return (
                  <tr
                    key={r.code}
                    className="cursor-pointer transition-colors duration-[220ms] motion-standard hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_6%,transparent)]"
                  >
                    <th scope="row" className={tableCellClass}>
                      <span className={symbolButtonClass}>
                        <span className={symbolCodeClass}>{r.code}</span>
                        <span className={symbolNameClass}>{r.name}</span>
                      </span>
                    </th>
                    <td className={`${numCellClass} ${tableCellClass}`}>{value(() => r.price, formatPrice)}</td>
                    <td className={`${numCellClass} ${tableCellClass} ${toneTextClass(tone)}`}>
                      {r.changePercent === null ? (
                        <span className={pillClass('flat')}>{NO_DATA}</span>
                      ) : (
                        <span className={pillClass(tone)}>
                          {formatSignedPercent(r.changePercent)}
                        </span>
                      )}
                    </td>
                    <td className={`${numCellClass} ${tableCellClass} text-muted`}>{value(() => r.volume, formatVolume)}</td>
                    <td className={`${numCellClass} ${tableCellClass}`}>{value(() => r.pe, formatRatio)}</td>
                    <td className={`${numCellClass} ${tableCellClass}`}>{value(() => r.roe, formatRatio)}</td>
                    <td className={`${numCellClass} ${tableCellClass}`}>{value(() => r.nta, formatRatio)}</td>
                    <td className={`${numCellClass} ${tableCellClass}`}>{value(() => r.dy, formatRatio)}</td>
                    <td className={`${numCellClass} ${tableCellClass} text-muted`}>{value(() => r.marketCap, formatRatio)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[color-mix(in_srgb,var(--m3-outline-variant)_40%,transparent)] bg-[color-mix(in_srgb,var(--m3-surface-container)_92%,transparent)] px-4 py-2.5">
            <span className="text-[0.72rem] font-semibold text-muted">
              {filtered.length === 0
                ? '0 results'
                : `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>

            <div className="flex items-center gap-1" role="navigation" aria-label="Screener pages">
              <button
                type="button"
                className="grid size-7 place-items-center rounded-full border-0 bg-transparent text-[0.72rem] font-bold text-ink transition-[background,color,opacity] duration-200 motion-standard hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => handlePage(current - 1)}
                disabled={current <= 1}
                aria-label="Previous page"
                title="Previous page"
              >
                ‹
              </button>

              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`grid size-7 place-items-center rounded-full border-0 text-[0.72rem] font-bold transition-[background,color] duration-200 motion-standard ${
                    n === current
                      ? 'bg-primary text-on-primary'
                      : 'bg-transparent text-muted hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)]'
                  }`}
                  onClick={() => handlePage(n)}
                  aria-current={n === current ? 'page' : undefined}
                  title={`Page ${n}`}
                >
                  {n}
                </button>
              ))}

              <button
                type="button"
                className="grid size-7 place-items-center rounded-full border-0 bg-transparent text-[0.72rem] font-bold text-ink transition-[background,color,opacity] duration-200 motion-standard hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => handlePage(current + 1)}
                disabled={current >= pageCount}
                aria-label="Next page"
                title="Next page"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
