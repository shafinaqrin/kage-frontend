import type { ConnectionStatus, Deal, MarketSession, Position } from '../../domain/types'
import { formatPrice, formatSigned, sessionHours, sessionLabel } from '../../lib/format'
import { computeRealizedPnl, computeWinRateFromSymbols } from './realized'

interface PortfolioCardsProps {
  positions: readonly Position[]
  status: ConnectionStatus
  error: string | null
  session: MarketSession
  /**
   * The account's *all-time* deal list (ledger-accumulated), which the Realized
   * figure is built from. Unlike the live 90-day window this spans the whole
   * recorded history, so the total is lifelong rather than windowed. Also the
   * source of the sells OpenD cannot cost at all.
   */
  deals: readonly Deal[] | null
}

const NO_DATA = '—'

/**
 * Aggregate figures for the account's holdings.
 *
 * Every field is nullable on purpose, so each total is only reported when *all*
 * the rows it sums actually carried that figure. Summing with a `?? 0` default
 * would silently turn one absent value into a smaller-but-plausible total; a
 * partial sum is a wrong number, not a conservative one.
 */
interface Totals {
  /** Σ (quantity × averageCost) — what the holdings originally cost. */
  readonly costBasis: number | null
  /** Σ profitLoss — unrealised P/L in money. */
  readonly profitLoss: number | null
  /**
   * Σ todayProfitLoss — the day's move in money.
   *
   * Computed but not currently rendered: the Cost basis card's caption used to
   * carry it, and that caption was removed. Kept because `positions` already
   * returns the figure and this derivation is the only place it is aggregated —
   * deleting it would mean redoing that work the moment a day-move display is
   * wanted again. Note it is the *intraday* move, not total profit: the two are
   * easily confused, and a good chunk of an "Open P/L" can have nothing to do
   * with today.
   */
  readonly todayProfitLoss: number | null
  /** P/L as a share of cost basis, capital-weighted. */
  readonly profitLossPercent: number | null
  /** The trading currency shared by every holding, or null if mixed. */
  readonly currency: string | null
}

/**
 * Sum a figure across holdings, returning null if any row lacks it.
 *
 * Deliberately all-or-nothing: OpenD leaves a field null when it has no value,
 * and a total that quietly skips that row would understate the portfolio while
 * looking authoritative.
 */
function totalOf(
  positions: readonly Position[],
  pick: (p: Position) => number | null,
): number | null {
  if (positions.length === 0) return null

  let sum = 0
  for (const position of positions) {
    const value = pick(position)
    if (value === null) return null
    sum += value
  }
  return sum
}

/**
 * Cost basis is `quantity × averageCost` per holding, then summed.
 *
 * Computed as one product-and-sum rather than reusing `totalOf` twice: the two
 * factors are only meaningful multiplied together, and a holding missing either
 * one makes the whole basis unknowable.
 */
function costBasisOf(positions: readonly Position[]): number | null {
  if (positions.length === 0) return null

  let sum = 0
  for (const position of positions) {
    if (position.quantity === null || position.averageCost === null) return null
    sum += position.quantity * position.averageCost
  }
  return sum
}

/**
 * The currency to label totals with: the one every holding shares.
 *
 * Returns null when holdings disagree — adding MYR to another currency would
 * produce a meaningless total, so the card says "—" instead of guessing.
 */
function sharedCurrency(positions: readonly Position[]): string | null {
  const distinct = new Set(positions.map((p) => p.currency))
  return distinct.size === 1 ? [...distinct][0] : null
}

function computeTotals(positions: readonly Position[]): Totals {
  const costBasis = costBasisOf(positions)
  const profitLoss = totalOf(positions, (p) => p.profitLoss)

  return {
    costBasis,
    profitLoss,
    todayProfitLoss: totalOf(positions, (p) => p.todayProfitLoss),
    // Capital-weighted, not the mean of the per-row percentages: averaging the
    // rows would let a tiny holding swing the portfolio return.
    profitLossPercent:
      costBasis !== null && costBasis !== 0 && profitLoss !== null
        ? (profitLoss / costBasis) * 100
        : null,
    currency: sharedCurrency(positions),
  }
}

/**
 * Bursa Malaysia trades in MYR, and `/api/market/deals` is filtered to Bursa, so
 * every deal in the stream is MYR by construction.
 *
 * The realized card uses this rather than the positions-derived currency on
 * purpose: realized P/L must stay readable when the account has closed trades
 * but no open holdings, where the positions currency is null and the card would
 * wrongly render "—".
 */
const BURSA_CURRENCY = 'MYR'

/** Money with its currency, or "—" when there is no honest figure to show. */
function money(currency: string | null, value: number | null, signed = false): string {
  if (value === null || currency === null) return NO_DATA
  return signed ? `${formatSigned(value)} ${currency}` : `${currency} ${formatPrice(value)}`
}

/**
 * The dashboard's headline row: what the account is worth in P/L terms.
 *
 * Every figure comes from OpenD's *trade* context via `/api/market/positions`
 * and `/api/market/deals`, neither of which needs the MY quote entitlement — so
 * these cards carry real numbers even though the watchlist prices render "—".
 * The screener and quote paths are not consulted here: neither can value the
 * account's holdings.
 *
 * Open and closed P/L are shown separately, while NETT PROFIT is derived live
 * as Realized plus Open P/L. Open P/L is signed, so a negative open loss is
 * added back as a negative amount (for example 665.50 + -143.50 = 522.00).
 *
 * Every card is a *portfolio-wide* total, not a day's move: Open P/L sums each
 * holding's total unrealized gain, Cost basis is everything paid, and Realized
 * spans the whole deal window. The `todayProfitLoss` field OpenD also returns is
 * deliberately unused — it is the intraday move alone, which is a poor fit for
 * cards whose job is to state where the account stands.
 */
export function PortfolioCards({ positions, status, error, session, deals }: PortfolioCardsProps) {
  const totals = computeTotals(positions)
  const holdings = positions.length

  // Realized P/L is derived from the deal stream, NOT read from OpenD's booked
  // `realized_pl`. That figure looks authoritative but is not stable: OpenD
  // evicts a sold-out position from `position_list_query` after a few days and
  // the booked profit goes with it. Measured on a real account, the booked total
  // fell to RM 248.00 while four stocks had actually been closed for RM 475.50 —
  // OPPSTAR, CNERGEN and SUPERMX had simply been evicted. The deal stream still
  // held all of them, and the derivation below reproduces OpenD's own booked
  // figure to the sen on every position where both exist, so it is both more
  // complete and consistent with the broker.
  //
  // `deals` here is the *all-time* ledger list (accrued across loads), not the
  // ~90-day live window, so the figure genuinely spans the account's history
  // instead of being a windowed snapshot.
  const realized = deals === null ? null : computeRealizedPnl(deals)

  // Sells OpenD cannot cost at all (IPO allotments, or a BUY that predates the
  // window). Surfaced rather than silently dropped.
  const unmatched = realized?.unmatchedSells ?? []

  // Win rate over the deal-derived, per-symbol outcomes — one stock is one
  // outcome however many lots closed it.
  const winRate = computeWinRateFromSymbols(realized?.bySymbol ?? [])

  const realizedTotal = realized?.total ?? null

  // A card that cannot source its number explains why, rather than showing a
  // bare dash: the reason is what tells you whether to fix OpenD or wait.
  const unavailable =
    error !== null
      ? `${error} — no figures shown.`
      : status === 'connecting'
        ? 'Loading positions from Moomoo OpenD…'
        : holdings === 0
          ? 'No open Bursa positions in the Moomoo account.'
          : totals.currency === null
            ? 'Holdings span multiple currencies — totals are not comparable.'
            : NO_DATA

  const headline =
    'min-w-0 rounded-[1.6rem] p-5 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_5%,transparent)]'

  const nettProfit = realizedTotal === null || totals.profitLoss === null ? null : realizedTotal + totals.profitLoss

  return (
    <div className="grid w-full min-w-0 grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[768px]:grid-cols-1">
      {/*
        Session leads the row: it frames every figure after it. Whether the
        exchange is open or closed decides how much the rest can be trusted,
        so it reads before the money cards rather than after them.
      */}
      <article
        className={`${headline} min-w-0 border border-transparent bg-[var(--m3-tertiary-container)] text-[var(--m3-on-tertiary-container)] max-[768px]:p-4`}
        aria-label="Market session"
      >
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] opacity-80">Session</p>
        <p className="my-1 truncate text-[clamp(1.55rem,7vw,2rem)] font-extrabold tracking-[-0.03em]">
          {sessionLabel(session)}
        </p>
        <p className="m-0 truncate pb-1 text-[0.74rem] font-semibold opacity-90">
          {sessionHours(session) ?? `${holdings} holding${holdings === 1 ? '' : 's'} in the Moomoo account`}
        </p>
      </article>

      {/*
        Second: it is the other settled figure. Realized profit is banked and
        fixed, which makes it the natural companion to the session state before
        the cards that move with the market.
      */}
      <article
        className={`${headline} border border-transparent ${
          realizedTotal === null || realizedTotal === 0
            ? 'bg-[color-mix(in_srgb,var(--m3-on-surface)_4%,transparent)] text-ink'
            : realizedTotal > 0
              ? 'bg-[var(--positive-container)] text-[var(--positive)]'
              : 'bg-[var(--negative-container)] text-[var(--negative)]'
        } max-[768px]:p-4`}
        aria-label="Realized profit and loss"
      >
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] opacity-80">Realized</p>
        <p className="my-1 truncate text-[clamp(1.55rem,7vw,2rem)] font-extrabold tracking-[-0.03em] tabular-nums">
          {money(BURSA_CURRENCY, realizedTotal, true)}
        </p>
        <p className="m-0 truncate pb-1 text-[0.74rem] font-semibold opacity-90">
          {deals === null
            ? 'Loading closed trades from the ledger…'
            : realizedTotal === null
              ? 'No costed sells in the recorded history.'
              : `W ${winRate.wins} - ${winRate.losses} L${winRate.percent === null ? '' : ` · ${winRate.percent}%`} · all-time`}
        </p>
      </article>

      {/*
        Colored by sign, matching the Realized card: profit reads green, loss
        red. The 2rem figure is the largest in the row, so leaving it accent-blue
        while a loss sat under it would have buried the one thing this card is
        for. Falls back to the neutral surface when no figure is available, so a
        loading state never reads as a loss.
      */}
      <article
        className={`${headline} border border-transparent ${
          totals.profitLoss === null || totals.profitLoss === 0
            ? 'bg-[color-mix(in_srgb,var(--m3-on-surface)_4%,transparent)] text-ink'
            : totals.profitLoss > 0
              ? 'bg-[var(--positive-container)] text-[var(--positive)]'
              : 'bg-[var(--negative-container)] text-[var(--negative)]'
        } max-[768px]:p-4`}
        aria-label="Open profit and loss"
      >
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] opacity-80">Open P/L</p>
        <p className="my-1 truncate text-[clamp(1.55rem,7vw,2rem)] font-extrabold tracking-[-0.03em] tabular-nums">
          {money(totals.currency, totals.profitLoss, true)}
        </p>
        <p className="m-0 truncate pb-1 text-[0.74rem] font-semibold opacity-90">
          {totals.costBasis === null ? unavailable : `Cost basis • ${money(totals.currency, totals.costBasis)}`}
        </p>
      </article>

      <article
        className={`${headline} border border-transparent ${
          nettProfit === null || nettProfit === 0
            ? 'bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]'
            : nettProfit > 0
              ? 'bg-[var(--positive-container)] text-[var(--positive)]'
              : 'bg-[var(--negative-container)] text-[var(--negative)]'
        } max-[768px]:p-4`}
        aria-label="Nett profit"
      >
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] opacity-80">NETT PROFIT</p>
        <p className="my-1 truncate text-[clamp(1.55rem,7vw,2rem)] font-extrabold tracking-[-0.03em] tabular-nums">
          {money(BURSA_CURRENCY, nettProfit, true)}
        </p>
        <p className="m-0 truncate pb-1 text-[0.74rem] font-semibold opacity-90">
          {realizedTotal === null || totals.profitLoss === null ? 'Waiting for Realized and Open P/L' : 'Realized + Open P/L'}
        </p>
      </article>

      {/*
        Sold IPOs are the one closed trade OpenD cannot value: an allotment
        produces no BUY deal and never enters the position list, so no cost basis
        exists for it anywhere. Surfaced so the gap is visible instead of the
        card silently looking complete. Not shown for ordinary closed positions,
        which OpenD books properly.
      */}
      {unmatched.length > 0 && (
        <p className="col-span-full m-0 text-[0.72rem] font-semibold text-muted" role="status">
          {unmatched.length} sold position{unmatched.length === 1 ? '' : 's'} not counted in Realized
          — no cost basis from OpenD (IPO allotment):{' '}
          {unmatched.map((s) => `${s.symbol} ${s.company}`).join(', ')}
        </p>
      )}
    </div>
  )
}
