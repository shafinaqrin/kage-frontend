import type { ClosedTrade, Deal } from '../../domain/types'

/**
 * Group fills into closed positions: one row per stock the account has finished
 * trading.
 *
 * OpenD has no endpoint for this. `position_list_query` drops a holding once it
 * reaches zero shares, `history_deal_list_query` returns individual fills with no
 * notion of a round trip, and `realized_pl` covers partially sold holdings too.
 * So the grouping has to be reconstructed here — which is the whole point of
 * this module, and why it is a pure function over the deal list rather than
 * inline in a component: the arithmetic is the part worth being able to test.
 *
 * A stock is included when its buys and sells cancel out exactly. That is a
 * deliberately strict test, because the two obvious alternatives are both wrong:
 *
 *   - "the stock has a SELL" includes stocks still held after a partial trim,
 *     which belong in Positions, not here;
 *   - "the stock has no open quantity" cannot be checked at all, since this
 *     works from fills, not holdings.
 *
 * Rewrites are kept as one position rather than split into round trips: the
 * question the table answers is "how did this stock go?", and buy 2,500 → sell
 * 2,500 → buy 2,500 → sell 2,500 is one decision repeated, not two unrelated
 * trades. A stock that is flat but whose earlier buys have fallen outside
 * OpenD's ~90-day window is indistinguishable from a fresh one here, so its
 * average cost is the average of the buys that survived — the same limitation
 * `RealizedPnl` documents, and the reason the UI labels the window.
 *
 * Anything OpenD did not report stays null rather than becoming a zero: a fill
 * missing its price or quantity cannot be summed, so the figure it feeds is
 * reported as unknown instead of quietly understating the position.
 */
export function deriveClosedTrades(deals: readonly Deal[]): readonly ClosedTrade[] {
  const bySymbol = new Map<string, Deal[]>()

  for (const deal of deals) {
    const existing = bySymbol.get(deal.symbol)
    if (existing) existing.push(deal)
    else bySymbol.set(deal.symbol, [deal])
  }

  const closed: ClosedTrade[] = []

  for (const [symbol, fills] of bySymbol) {
    // OpenD returns the stream oldest first, so the fills are already in the
    // order the position was built and unwound. Sorting is not repeated here so
    // that a caller can hand over any ordered stream.
    const trade = summarise(symbol, fills)
    if (trade !== null) closed.push(trade)
  }

  // Most recently closed first, matching the deal stream's own bias toward the
  // trades the user still remembers making. A position with no timestamp sorts
  // last rather than jumping to the top.
  return closed.sort((a, b) => {
    if (a.closedAt === null && b.closedAt === null) return 0
    if (a.closedAt === null) return 1
    if (b.closedAt === null) return -1
    return b.closedAt.localeCompare(a.closedAt)
  })
}

/**
 * Summarise one stock's fills, or null when it is not a closed position.
 *
 * Null covers three distinct cases that all mean "not a row here": still
 * holding shares, sold more than was ever bought (an IPO allotment, or a buy
 * that predates the deal window), and a stock whose quantity was never reported
 * at all. None of them can be summarised honestly.
 */
function summarise(symbol: string, fills: readonly Deal[]): ClosedTrade | null {
  const buys: Deal[] = []
  const sells: Deal[] = []
  let boughtQuantity = 0
  let soldQuantity = 0

  for (const fill of fills) {
    if (fill.quantity === null) continue
    if (fill.side === 'BUY') {
      buys.push(fill)
      boughtQuantity += fill.quantity
    } else {
      sells.push(fill)
      soldQuantity += fill.quantity
    }
  }

  // Flat only: shares bought and not yet sold belong to Positions, and selling
  // more than was recorded means the cost basis is unknowable (the IPO case).
  if (boughtQuantity <= 0 || boughtQuantity !== soldQuantity) return null

  const firstBuy = buys[0] ?? null
  const lastSell = sells[sells.length - 1] ?? null

  // Cost is accumulated only over buys that actually carried a price. If one of
  // them did not, the average silently describes fewer shares than the position
  // holds, so it is reported as unknown rather than as a too-low number.
  const cost = averageCost(buys, boughtQuantity)

  // Proceeds come from the final sell alone: that is the exit, and the price the
  // user last saw this stock trade at on their own account.
  const proceeds =
    lastSell?.quantity !== null && lastSell?.quantity !== undefined && lastSell.price !== null
      ? lastSell.quantity * lastSell.price
      : null

  const profitLoss =
    cost !== null && proceeds !== null
      ? proceeds - cost.weightedAverage * boughtQuantity
      : null

  return {
    symbol,
    // Names come from the fills themselves; a stock with no name reported falls
    // back to its own code, matching how every other row displays.
    company: [...fills][0]?.company ?? symbol,
    // Bursa-only stream, so MYR by construction — the same reasoning the
    // portfolio cards use for realized P/L.
    currency: 'MYR',
    quantity: boughtQuantity,
    averageCost: cost?.weightedAverage ?? null,
    last: lastSell?.price ?? null,
    marketValue: proceeds,
    profitLoss,
    profitLossPercent:
      profitLoss !== null && cost !== null && cost.weightedAverage !== 0
        ? (profitLoss / (cost.weightedAverage * boughtQuantity)) * 100
        : null,
    firstBuyPrice: firstBuy?.price ?? null,
    lastSellPrice: lastSell?.price ?? null,
    openedAt: [...fills][0]?.time ?? null,
    closedAt: lastSell?.time ?? null,
    deals: [...fills],
    trend: profitLoss === null ? 'flat' : profitLoss > 0 ? 'up' : profitLoss < 0 ? 'down' : 'flat',
  }
}

/**
 * Quantity-weighted average cost of a stock's buys.
 *
 * Weighted rather than a plain mean because that is what the figure means — what
 * one share cost on average — and it is how Moomoo reports average cost itself.
 * Returns null if any sizeable buy had no price: the average would then cover
 * fewer shares than were bought, which reads as a cheaper position than it was.
 */
function averageCost(
  buys: readonly Deal[],
  boughtQuantity: number,
): { weightedAverage: number } | null {
  let pricedQuantity = 0
  let cost = 0

  for (const buy of buys) {
    if (buy.quantity === null) continue
    if (buy.price === null) {
      // A buy with no price is only ignorable if it carried no size; if it did,
      // the position's true cost is unknown.
      if (buy.quantity > 0) return null
      continue
    }
    pricedQuantity += buy.quantity
    cost += buy.quantity * buy.price
  }

  if (pricedQuantity !== boughtQuantity || pricedQuantity === 0) return null
  return { weightedAverage: cost / pricedQuantity }
}
