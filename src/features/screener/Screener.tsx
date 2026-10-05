'use client'

import { useMemo, useState } from 'react'
import type { ConnectionStatus, ScreenerRow } from '../../domain/types'
import { formatRatio, formatPrice, formatSignedPercent, formatVolume } from '../../lib/format'
import { useTableSort, type SortDirection } from '../../lib/useSort'
import { SortableHeader } from '../shared/SortableHeader'

interface ScreenerProps {
  rows: readonly ScreenerRow[]
  status: ConnectionStatus
  error: string | null
}

const NO_DATA = '—'

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
  const { rows: sorted, control } = useTableSort<SortKey, ScreenerRow>(rows, SORT_ACCESSORS, INITIAL_SORT)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(
      (r) => r.code.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  return (
    <section className="panel min-w-0 max-w-full" aria-label="Screener">
      <header className="panel-head">
        <div>
          <h2>Screener</h2>
          <p className="panel-sub">
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
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      {error ? (
        <p className="empty-state" role="status">
          {error} — no screener data shown.
        </p>
      ) : rows.length === 0 ? (
        <p className="empty-state" role="status">
          {status === 'connecting'
            ? 'Loading Shariah-compliant stocks from KLSE Screener…'
            : 'No Shariah-compliant uptrend stocks in the RM 0.20–1.50 price band.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No symbols match “{query}”.</p>
      ) : (
        <div className="table-scroll">
          <table className="quote-table">
            <caption className="visually-hidden">
              Shariah-compliant Bursa Malaysia stocks in an uptrend, priced RM 0.20 to RM 1.50,
              ranked by volume — the top 30 most active, from KLSE Screener. Column headers are
              sortable.
            </caption>
            <thead>
              <tr>
                <SortableHeader label="Symbol" control={control('code')} />
                <SortableHeader label="Last" numeric control={control('price')} />
                <SortableHeader label="Chg %" numeric control={control('changePercent')} />
                <SortableHeader label="Vol" numeric control={control('volume')} />
                <SortableHeader label="PE" numeric control={control('pe')} />
                <SortableHeader label="ROE" numeric control={control('roe')} />
                <SortableHeader label="NTA" numeric control={control('nta')} />
                <SortableHeader label="DY" numeric control={control('dy')} />
                <SortableHeader label="Mkt Cap" numeric control={control('marketCap')} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const tone =
                  r.change === null ? 'flat' : r.change > 0 ? 'up' : r.change < 0 ? 'down' : 'flat'
                return (
                  <tr key={r.code} className="quote-row">
                    <th scope="row">
                      <span className="symbol-btn">
                        <span className="symbol-code">{r.code}</span>
                        <span className="symbol-name">{r.name}</span>
                      </span>
                    </th>
                    <td className="num">{value(() => r.price, formatPrice)}</td>
                    <td className={`num tone-${tone}`}>
                      {r.changePercent === null ? (
                        <span className="pill tone-flat-bg">{NO_DATA}</span>
                      ) : (
                        <span className={`pill tone-${tone}-bg`}>
                          {formatSignedPercent(r.changePercent)}
                        </span>
                      )}
                    </td>
                    <td className="num muted">{value(() => r.volume, formatVolume)}</td>
                    <td className="num">{value(() => r.pe, formatRatio)}</td>
                    <td className="num">{value(() => r.roe, formatRatio)}</td>
                    <td className="num">{value(() => r.nta, formatRatio)}</td>
                    <td className="num">{value(() => r.dy, formatRatio)}</td>
                    <td className="num muted">{value(() => r.marketCap, formatRatio)}</td>
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
