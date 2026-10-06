import type { Deal, RealizedPosition } from '../../domain/types'

/**
 * Realized P/L derived from OpenD's deal stream.
 *
 * **This is what the Realized card actually shows**, and it replaced OpenD's
 * booked `realized_pl` (`/api/market/realized`) as the source. The booked figure
 * looked authoritative, but OpenD *evicts* a sold-out position from
 * `position_list_query` some time after it closes — taking its `realized_pl`
 * with it. Observed on a real account: TOPGLOV survived for a day, while
 * OPPSTAR, CNERGEN and SUPERMX vanished within days, so the booked total
 * silently collapsed from RM 475.50 to RM 248.00 while those trades were still
 * very much part of the account's history. The deal stream still had every one
 * of them.
 *
 * The cost model is **weighted-average**, matching Moomoo's own: verified by
 * reproducing OpenD's booked `realized_pl` to the sen for all four closed
 * positions (TOPGLOV +248, CNERGEN +175, OPPSTAR +90, SUPERMX −37.50). A FIFO
 * model would disagree with OpenD wherever buys happened at different prices, so
 * it is deliberately not used.
 *
 * An **IPO allotment** cannot be costed at all: a primary-market subscription
 * produces no BUY deal and never enters the position list, so selling one leaves
 * a SELL with nothing funding it and no profit figure anywhere. Its cost is
 * genuinely unknown, so it is reported as *unmatched* rather than assumed free —
 * treating it as zero cost would report the entire sale proceeds as profit.
 *
 * A BUY older than OpenD's ~90-day deal window is indistinguishable from an IPO
 * here and lands in the same bucket, so the caller must not describe the
 * exclusion as IPO-specific with certainty.
 */
export interface RealizedPnl {
  /** Profit from sells whose cost basis could be established. */
  readonly total: number | null
  /** How many sells contributed to `total`. */
  readonly matchedSells: number
  /**
   * Sells with no BUY anywhere in the window — IPOs, or trades predating the
   * ~90-day cap. Excluded from `total`, and surfaced so the gap is visible.
   */
  readonly unmatchedSells: readonly { readonly symbol: string; readonly company: string }[]
  /**
   * One entry per symbol that had at least one costed sell, with the profit that
   * symbol booked across the window.
   *
   * Per *symbol*, not per sell, because a win rate counts decisions: buying a
   * stock and unwinding it in two lots is one outcome, and counting fills would
   * let a churned position skew the ratio.
   */
  readonly bySymbol: readonly { readonly symbol: string; readonly company: string; readonly realized: number }[]
}

/**
 * Total quantity and cost per symbol, from BUY fills only.
 *
 * Weighted-average: cost is accumulated across every buy and divided by the
 * quantity held, which matches how Moomoo itself reports a position's average
 * cost. Walked in the order given (oldest first) so the average is built the
 * same way the position was.
 */
function buyPositions(deals: readonly Deal[]): Map<string, { company: string; quantity: number; cost: number }> {
  const bought = new Map<string, { company: string; quantity: number; cost: number }>()

  for (const deal of deals) {
    if (deal.side !== 'BUY' || deal.quantity === null || deal.price === null) continue

    const existing = bought.get(deal.symbol) ?? { company: deal.company, quantity: 0, cost: 0 }
    existing.quantity += deal.quantity
    existing.cost += deal.quantity * deal.price
    bought.set(deal.symbol, existing)
  }

  return bought
}

/**
 * Compute realized P/L by matching each sell against its weighted-average cost.
 *
 * Sells that cannot be matched at all are reported separately instead of being
 * silently dropped or assumed free.
 */
export function computeRealizedPnl(deals: readonly Deal[]): RealizedPnl {
  const bought = buyPositions(deals)

  let total = 0
  let matchedSells = 0
  let sawMatch = false
  const unmatchedSells: { symbol: string; company: string }[] = []
  const perSymbol = new Map<string, { company: string; realized: number }>()

  for (const deal of deals) {
    if (deal.side !== 'SELL' || deal.quantity === null || deal.price === null) continue

    const position = bought.get(deal.symbol)

    // No recorded buys at all for this symbol: an IPO allotment, or a purchase
    // that predates OpenD's ~90-day window. Either way the cost basis is
    // unknowable, so this sell is excluded from the total rather than guessed.
    if (!position || position.quantity <= 0) {
      unmatchedSells.push({ symbol: deal.symbol, company: deal.company })
      continue
    }

    // Only the portion covered by recorded buys can be costed. A sell larger
    // than the recorded position is partly unmatched, so it contributes on the
    // matched share alone rather than assuming the rest was free.
    const matched = Math.min(deal.quantity, position.quantity)
    const averageCost = position.cost / position.quantity

    const gain = (deal.price - averageCost) * matched
    total += gain
    matchedSells += 1
    sawMatch = true

    // Accumulated per symbol so the win rate can count a stock once however
    // many lots it was sold in.
    const entry = perSymbol.get(deal.symbol) ?? { company: deal.company, realized: 0 }
    entry.realized += gain
    perSymbol.set(deal.symbol, entry)

    // Consume the matched quantity so a second sell cannot re-use the same buys.
    position.quantity -= matched
    position.cost -= averageCost * matched
  }

  return {
    // Null, not 0, when nothing was matchable: "no realized P/L" and "realized
    // exactly RM 0.00" are different claims and the UI shows them differently.
    total: sawMatch ? total : null,
    matchedSells,
    unmatchedSells,
    bySymbol: [...perSymbol].map(([symbol, v]) => ({ symbol, company: v.company, realized: v.realized })),
  }
}

/** Wins and losses across closed positions. */
export interface WinRate {
  readonly wins: number
  readonly losses: number
  /** Wins ÷ (wins + losses) as a whole percentage; null with no closed trades. */
  readonly percent: number | null
}

/**
 * Count how many closed positions made money versus lost it.
 *
 * One position is one outcome, however many fills it took to open or close it —
 * so this counts positions, not deals. Splitting a single exit into two lots is
 * still one decision, and counting fills would let a churned position skew the
 * ratio.
 *
 * Break-even closes (exactly RM 0) count as neither, and OpenD books them as
 * `realized_pl == 0`, which `/api/market/realized` omits for exactly this
 * reason. A position closed flat is therefore invisible here rather than
 * inflating the loss column with a zero.
 */
export function computeWinRate(realized: readonly RealizedPosition[]): WinRate {
  let wins = 0
  let losses = 0

  for (const position of realized) {
    if (position.realized === null || position.realized === 0) continue
    if (position.realized > 0) wins += 1
    else losses += 1
  }

  const decided = wins + losses

  return {
    wins,
    losses,
    percent: decided === 0 ? null : Math.round((wins / decided) * 100),
  }
}

/**
 * Win rate over the deal-derived outcomes.
 *
 * Separate from `computeWinRate` because the two read different inputs, and the
 * distinction is the whole reason this exists: `/api/market/realized` loses rows
 * as OpenD evicts closed positions, so a win rate built on it collapses to
 * whatever survived ("W 1 - 0 L" while four stocks had actually been closed).
 * Feeding it `computeRealizedPnl().bySymbol` — which comes from the deal stream,
 * where nothing has been evicted — reports the real record.
 *
 * Break-even outcomes are skipped: exactly RM 0 is neither a win nor a loss, and
 * counting it as either would misstate the ratio.
 */
export function computeWinRateFromSymbols(
  outcomes: readonly { readonly realized: number }[],
): WinRate {
  let wins = 0
  let losses = 0

  for (const outcome of outcomes) {
    if (outcome.realized === 0) continue
    if (outcome.realized > 0) wins += 1
    else losses += 1
  }

  const decided = wins + losses

  return {
    wins,
    losses,
    percent: decided === 0 ? null : Math.round((wins / decided) * 100),
  }
}
