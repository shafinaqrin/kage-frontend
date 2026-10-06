import type { TrendDirection } from '../../domain/types'
import { formatPrice, formatSigned, formatSignedPercent, formatStockPrice } from '../../lib/format'

/**
 * Shared class strings for the market tables.
 *
 * Every table in the app (watchlist, screener, positions, closed positions) is
 * drawn with the same handful of structural classes, and `app.css` is no longer
 * the home for them — they are concrete Tailwind utilities so the file can go
 * away. Keeping them as named constants here, rather than spelling them out in
 * each row, is what stops the tables from drifting apart: one edit updates every
 * table at once.
 *
 * The `max-md:*` variants implement the narrow-screen layout that `app.css` did
 * in `@media (max-width: 768px)`: tables go `table-fixed`, symbols drop their
 * two-line name, and the sort glyph is hidden.
 */
export const tableScrollClass =
  'w-full max-w-full overflow-x-auto rounded-panelinner bg-surface-container'
export const tableClass =
  'w-full border-collapse text-[0.82rem] max-md:table-fixed max-md:text-[0.72rem]'
export const tableCellClass =
  'px-[0.9rem] py-[0.62rem] text-left tabular-nums max-md:overflow-hidden max-md:text-ellipsis max-md:px-1 max-md:py-[0.58rem]'
export const tableHeaderClass =
  'border-b border-[color-mix(in_srgb,var(--m3-outline-variant)_50%,transparent)] text-[0.66rem] uppercase tracking-[0.12em] text-muted'
export const numCellClass = 'text-right'
export const symbolButtonClass =
  'flex flex-col gap-[0.1rem] w-full cursor-pointer border-0 bg-transparent p-0 text-left text-inherit'
export const symbolCodeClass = 'font-extrabold tracking-[0.01em]'
export const symbolNameClass = 'text-[0.68rem] font-medium text-muted max-md:hidden'
export const emptyStateClass = 'px-[1.1rem] py-[1.4rem] text-[0.85rem] text-muted'

/**
 * The panel shell and header shared by every feature section.
 *
 * Mirrors what `app.css` did for `.panel` / `.panel-head` / `.panel-sub`. The
 * hover lift and focus are inlined as Tailwind hover/focus variants; the
 * `surface-in` entrance animation comes from the `animate-surface-in` utility
 * defined in the Tailwind config keyframes.
 */
export const panelClass =
  'min-w-0 max-w-full rounded-panel border border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] bg-[color-mix(in_srgb,var(--m3-on-surface)_4%,transparent)] p-2 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_5%,transparent),inset_0_1px_0_color-mix(in_srgb,white_50%,transparent)] transition-[background,border-color,transform,box-shadow] duration-[450ms] motion-standard animate-surface-in hover:-translate-y-0.5 hover:shadow-[0_1.3rem_3rem_color-mix(in_srgb,var(--m3-on-surface)_8%,transparent),inset_0_1px_0_color-mix(in_srgb,white_50%,transparent)] max-md:max-w-full max-md:w-full max-md:rounded-[1.35rem] max-md:hover:translate-y-0'
export const panelHeadClass =
  'flex flex-wrap items-center justify-between gap-4 px-[1.1rem] pb-[0.6rem] pt-[0.9rem] max-md:px-[0.85rem] max-md:pb-[0.55rem] max-md:pt-[0.8rem]'
export const panelHeadTitleClass = 'm-0 text-base font-bold tracking-[-0.01em]'
export const panelSubClass = 'mt-[0.15rem] text-[0.72rem] text-muted'

/** A toned cell: profit green, loss red, else neutral. Includes full colours. */
export function toneTextClass(trend: TrendDirection): string {
  return trend === 'up' ? 'text-positive' : trend === 'down' ? 'text-negative' : 'text-flat'
}

/** The pill used for a percentage: base + the tone's container background. */
export function pillClass(trend: TrendDirection): string {
  const bg =
    trend === 'up'
      ? 'bg-positive-container'
      : trend === 'down'
        ? 'bg-negative-container'
        : 'bg-surface-highest'
  return `${bg} inline-block rounded-full px-2 py-[0.15rem] text-[0.72rem] font-bold text-inherit`
}

/**
 * The cell renderers shared by the Positions and Closed Positions tables.
 *
 * These live outside `positions/` because they are not about positions — they
 * are the account's money conventions, and the closed table has to follow them
 * exactly or the two tables would disagree about how a ringgit looks. Duplicating
 * them risked a slow drift apart; the two tables being visually interchangeable
 * is the point.
 */

/** A figure OpenD never reported. Always a dash, never a 0 dressed as data. */
export const NO_DATA = '—'

/** Holdings are integers on Bursa; show them as such rather than "4,000.00". */
export function formatQuantity(value: number): string {
  return value.toLocaleString('en-MY', { maximumFractionDigits: 0 })
}

/**
 * Money, prefixed with the currency OpenD reports rather than a hardcoded "RM":
 * Bursa trades in MYR, but the figure labels the currency it actually came in.
 *
 * `format` is `formatStockPrice` for per-share prices (0.555 is a real Bursa
 * tick, and rounding it to 0.56 would show a price that never traded) and
 * `formatPrice` for ringgit totals, which do not carry that extra place —
 * "MYR 2,280.000" would imply precision the account does not have.
 */
export function formatMoney(
  currency: string,
  value: number,
  format: (n: number) => string = formatPrice,
): string {
  return `${currency} ${format(value)}`
}

/** Signed money, e.g. "+MYR 40.00" — the sign reads before the currency. */
export function formatSignedMoney(currency: string, value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatMoney(currency, Math.abs(value))}`
}

/** Per-share price with its currency, e.g. "MYR 0.555". */
export function formatPriceWithCurrency(currency: string, value: number): string {
  return formatMoney(currency, value, formatStockPrice)
}

/**
 * Render a possibly-absent figure, or the dash when there is none.
 *
 * `raw === null` is the only "missing" case: a genuine 0 from OpenD is a real
 * figure and is formatted as one.
 */
export function formatValue<T>(
  row: T,
  pick: (row: T) => number | null,
  format: (value: number, row: T) => string,
): string {
  const raw = pick(row)
  return raw === null ? NO_DATA : format(raw, row)
}

/**
 * A signed percentage in a toned pill, or a neutral dash pill when unknown.
 *
 * Shared so a stock that closed at a loss reads red in the closed table exactly
 * as an open loser does in Positions.
 */
export function PercentPill({ value, trend }: { value: number | null; trend: TrendDirection }) {
  if (value === null) {
    return (
      <span className="inline-block rounded-full bg-surface-highest px-2 py-[0.15rem] text-[0.72rem] font-bold">
        {NO_DATA}
      </span>
    )
  }
  const bg = trend === 'up' ? 'bg-positive-container' : trend === 'down' ? 'bg-negative-container' : 'bg-surface-highest'
  return (
    <span className={`inline-block rounded-full px-2 py-[0.15rem] text-[0.72rem] font-bold ${bg}`}>
      {formatSignedPercent(value)}
    </span>
  )
}

/** Signed money in the tone its sign implies. */
export function SignedMoney({ currency, value }: { currency: string; value: number }) {
  return <>{formatSignedMoney(currency, value)}</>
}

export { formatSigned }
