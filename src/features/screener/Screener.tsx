'use client'

import { Fragment, useMemo, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type { ConnectionStatus, HiddenScreenerEntry, ScreenerRow } from '../../domain/types'
import {
  formatFetchedAt,
  formatPrice,
  formatRatio,
  formatSignedPercent,
  formatVolume,
  screenerIsStale,
} from '../../lib/format'
import { useTableSort, type SortDirection } from '../../lib/useSort'
import { SortableHeader } from '../shared/SortableHeader'
import { Icon } from '../shared/Icon'
import { Dialog as RadixDialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Popover, PopoverAnchor, PopoverContent } from '../../components/ui/popover'
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
  /** `full` on the screener page: refresh, context menu, deleted modal. */
  variant: 'full' | 'compact'
  rows: readonly ScreenerRow[]
  fetchedAt: number | null
  status: ConnectionStatus
  error: string | null
  // Full variant only:
  onRefresh?: () => Promise<void>
  hidden?: readonly HiddenScreenerEntry[]
  onDelete?: (code: string, name: string) => Promise<void>
  onRestore?: (code: string) => Promise<void>
}

const NO_DATA = '—'
const PAGE_SIZE = 10

type SortKey = 'code' | 'price' | 'changePercent' | 'volume' | 'pe' | 'roe' | 'nta' | 'dy' | 'marketCap'

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

const INITIAL_SORT: { key: SortKey; direction: SortDirection } = { key: 'volume', direction: 'desc' }

function value(pick: () => number | null, format: (n: number) => string): string {
  const raw = pick()
  return raw === null ? NO_DATA : format(raw)
}

/** The TradingView chart page for a Bursa Malaysia instrument. */
function tradingViewUrl(code: string): string {
  return `https://www.tradingview.com/chart/?symbol=MYX:${encodeURIComponent(code)}`
}

/**
 * A small overlay dialog: a scrim with a centered card. Used for the refresh
 * confirmation and the "deleted stocks" modal. Esc closes it.
 */
function Dialog({
  open,
  title,
  narrow,
  children,
  onClose,
}: {
  open: boolean
  title: string
  narrow?: boolean
  children: ReactNode
  onClose: () => void
}) {
  return (
    <RadixDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent narrow={narrow} aria-label={title}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </RadixDialog>
  )
}

/**
 * Bursa instruments from the `kage-screener` sidecar, crawled from KLSE Screener.
 *
 * This is a different data source from Moomoo OpenD: the quote path cannot
 * supply fundamentals like PE, ROE, or NTA. The crawl applies four filters --
 * Shariah-compliant only (re-verified per row), uptrend (price above SMA50), the
 * RM 0.20-1.50 price band, and the top 30 by volume -- so the row count here is
 * that filtered subset, not the whole market.
 *
 * The data is shared with the dashboard and never auto-refreshes into the
 * crawl: the `full` variant offers a manual refresh (with a confirm dialog), a
 * right-click context menu (TradingView / delete), and a modal of deleted
 * stocks; the `compact` variant (dashboard) is a read-only mirror of the same
 * rows and date.
 */
export function Screener(props: ScreenerProps) {
  const { variant, rows, fetchedAt, status, error } = props
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  // Refresh: a confirm dialog gates the actual crawl, with a busy flag set for
  // the duration of the request so the confirm button can show progress.
  const [confirmRefreshOpen, setConfirmRefreshOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deletedOpen, setDeletedOpen] = useState(false)

  // Right-click menu state: identify the selected row and keep its symbol-cell
  // anchor. The popup is rendered outside the table so it never creates a blank
  // table row or changes the table layout.
  const [menu, setMenu] = useState<{
    code: string
    name: string
  } | null>(null)

  // Right-click inside the deleted-stocks modal: which hidden row's restore
  // menu is open.
  const [restoreMenu, setRestoreMenu] = useState<{ x: number; y: number; code: string } | null>(null)

  const { rows: sorted, control } = useTableSort<SortKey, ScreenerRow>(rows, SORT_ACCESSORS, INITIAL_SORT)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(
      (r) => r.code.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const pageRows = useMemo(
    () => filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    [filtered, current],
  )

  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handlePage = (next: number) => setPage(Math.min(Math.max(next, 1), pageCount))

  const stale = screenerIsStale(fetchedAt)

  const runRefresh = async () => {
    if (!props.onRefresh) return
    setRefreshing(true)
    try {
      await props.onRefresh()
    } finally {
      setRefreshing(false)
      setConfirmRefreshOpen(false)
    }
  }

  const openContextMenu = (event: ReactMouseEvent, row: ScreenerRow) => {
    if (variant !== 'full') return
    event.preventDefault()

    setMenu({ code: row.code, name: row.name })
  }

  const removeExisting = async (code: string, name: string) => {
    if (!props.onDelete) return
    await props.onDelete(code, name)
  }

  // A single shared placeholder for the stale-red indicator and date line.
  const dateLine = fetchedAt === null ? NO_DATA : formatFetchedAt(fetchedAt)

  return (
    <section className={panelClass} aria-label="Screener">
      <header className={panelHeadClass}>
        <div>
          <h2 className={panelHeadTitleClass}>Screener</h2>
          <p className={panelSubClass}>
            {filtered.length} of {rows.length} · Shariah · Uptrend · RM 0.20–1.50
          </p>
          <p className={`mt-[0.15rem] text-[0.72rem] ${stale ? 'text-negative' : 'text-muted'}`}>
            {stale && <span className="mr-1 inline-block size-1.5 rounded-full bg-[var(--negative)]" aria-hidden="true" />}
            <span>Data: {dateLine}</span>
            {stale ? ' · over 1 week old' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {variant === 'full' && (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_55%,transparent)] bg-primary text-on-primary transition-[background,color,transform,opacity] duration-200 motion-standard active:scale-90 disabled:opacity-45 disabled:cursor-not-allowed"
              title="Refresh screener data"
              aria-label="Refresh screener data"
              onClick={() => setConfirmRefreshOpen(true)}
            >
              <Icon name="refresh" size={18} />
            </button>
          )}
          {variant === 'full' && (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full border border-[var(--negative)] bg-[var(--negative)] text-white transition-[background,color,transform,opacity] duration-200 motion-standard hover:bg-[color-mix(in_srgb,var(--negative)_86%,black)] active:scale-90 disabled:opacity-45 disabled:cursor-not-allowed"
              title="Open deleted stocks"
              aria-label="Open deleted stocks"
              onClick={() => setDeletedOpen(true)}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <label className="flex h-9 w-[10rem] max-w-full min-w-0 flex-1 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_68%,transparent)] bg-[var(--m3-surface-container)] px-3 text-muted transition-[border-color,box-shadow] duration-300 motion-standard focus-within:border-[var(--m3-primary)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--m3-primary)_14%,transparent)] max-[768px]:w-full">
            <Icon name="search" size={16} />
            <input
              type="search"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-muted/70"
              placeholder="Search symbols"
              aria-label="Filter screener results"
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
            />
          </label>
        </div>
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
                  <Fragment key={r.code}>
                    <tr
                      className={`cursor-pointer transition-colors duration-[220ms] motion-standard hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_6%,transparent)] ${variant === 'full' ? 'select-none' : ''}`}
                      onContextMenu={(e) => openContextMenu(e, r)}
                    >
                      <th scope="row" className={tableCellClass}>
                        <Popover
                          open={variant === 'full' && menu?.code === r.code}
                          onOpenChange={(open) => {
                            if (!open && menu?.code === r.code) setMenu(null)
                          }}
                        >
                          <PopoverAnchor asChild>
                            <span className={symbolButtonClass}>
                              <span className={symbolCodeClass}>{r.code}</span>
                              <span className={symbolNameClass}>{r.name}</span>
                            </span>
                          </PopoverAnchor>
                          <PopoverContent side="top" align="start" sideOffset={6} aria-label={`${r.name} actions`}>
                            <div className="px-2.5 py-1 text-[0.7rem] font-bold text-muted">{r.name}</div>
                            <div className="mx-2.5 my-1 h-px border-t border-[color-mix(in_srgb,var(--m3-outline-variant)_30%,transparent)]" />
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[0.76rem] font-semibold text-ink transition-[background] duration-150 hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_7%,transparent)]"
                              onClick={() => {
                                window.open(tradingViewUrl(r.code), '_blank', 'noopener')
                                setMenu(null)
                              }}
                            >
                              Open TradingView chart
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg border-0 bg-[var(--negative)] px-2.5 py-1.5 text-left text-[0.76rem] font-semibold text-white transition-[background,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--negative)_86%,black)] active:scale-[0.99]"
                              onClick={() => {
                                void removeExisting(r.code, r.name)
                                setMenu(null)
                              }}
                            >
                              Delete stock from screener
                            </button>
                          </PopoverContent>
                        </Popover>
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
                  </Fragment>
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

      {/* Refresh confirmation */}
      <Dialog
        open={variant === 'full' && confirmRefreshOpen}
        title="Refresh screener data"
        narrow
        onClose={() => setConfirmRefreshOpen(false)}
      >
        <p className="mb-4 text-xs leading-relaxed text-muted">
          This will reset the screener and crawl the latest data again. It replaces the
          current rows with whatever KLSE Screener reports now.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_60%,transparent)] bg-transparent px-3.5 py-1.5 text-[0.78rem] font-semibold text-ink transition-[background,transform] duration-200 hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] active:scale-95"
            disabled={refreshing}
            onClick={() => setConfirmRefreshOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full bg-primary px-3.5 py-1.5 text-[0.78rem] font-bold text-on-primary transition-[background,transform,opacity] duration-200 active:scale-95 disabled:opacity-50"
            disabled={refreshing}
            onClick={() => void runRefresh()}
          >
            {refreshing ? 'Refreshing…' : 'Reset & refresh'}
          </button>
        </div>
      </Dialog>

      {/* Deleted stocks modal */}
      <Dialog
        open={variant === 'full' && deletedOpen}
        title="Deleted stocks"
        onClose={() => {
          setDeletedOpen(false)
          setRestoreMenu(null)
        }}
      >
        {(props.hidden?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted">No stocks deleted. Right-click a row and choose “Delete stock from screener”.</p>
        ) : (
          <div className="relative">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 divide-y divide-[color-mix(in_srgb,var(--m3-outline-variant)_25%,transparent)]">
            {props.hidden!.map((entry) => (
              <li key={entry.code}>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-2 py-2 text-left transition-[background] duration-150 hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_6%,transparent)]"
                  title={`Open ${entry.name} chart. Right-click to restore.`}
                  onClick={() => window.open(tradingViewUrl(entry.code), '_blank', 'noopener')}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setRestoreMenu({
                      x: Math.min(e.clientX, window.innerWidth - 180),
                      y: Math.min(e.clientY, window.innerHeight - 90),
                      code: entry.code,
                    })
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-[0.8rem] font-bold tabular-nums">{entry.code}</span>
                    <span className="block truncate text-[0.68rem] text-muted">{entry.name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
            {restoreMenu && (
              <div
                className="fixed z-40 w-[10rem] rounded-xl border border-[color-mix(in_srgb,var(--m3-outline-variant)_50%,transparent)] bg-[color-mix(in_srgb,var(--m3-surface-container)_96%,transparent)] p-1 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_20%,transparent)] animate-fade-in"
                style={{ left: restoreMenu.x, top: restoreMenu.y }}
                onMouseDown={(e) => e.stopPropagation()}
                role="menu"
                aria-label="Deleted stock actions"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[0.76rem] font-semibold text-ink transition-[background] duration-150 hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_7%,transparent)]"
                  onClick={() => {
                    if (props.onRestore) void props.onRestore(restoreMenu.code)
                    setRestoreMenu(null)
                  }}
                >
                  Restore to screener
                </button>
              </div>
            )}
          </div>
        )}
        {props.hidden && props.hidden.length > 0 && (
          <p className="mt-2 text-[0.68rem] text-muted">Click a row to view its chart. Right-click to restore it to the screener.</p>
        )}
      </Dialog>

    </section>
  )
}