'use client'

import { useEffect, useRef, useState } from 'react'
import type { ConnectionStatus, Deal } from '../domain/types'
import { marketApi } from '../data/api'

/**
 * The durable deal ledger, merged with the live feed.
 *
 * OpenD only ever returns ~90 days of deals, so a realized-P/L figure built on
 * the live stream forgets trades as they age out. The backend keeps a SQLite
 * *ledger* that accrues every fill moomoo has delivered, so this hook offers the
 * union of two sources:
 *
 *  - the persistent ledger (all-time, seeded once on load), and
 *  - the live moomoo feed, which is POSTed to the ledger whenever it refreshes
 *    so any newly-visible fill (a just-executed trade) is captured even before
 *    it would roll off.
 *
 * The result is `allDeals`: the accumulated history the Realized card feeds on,
 * deliberately *not* the 90-day-window live stream.
 */
export interface DealLedger {
  readonly allDeals: readonly Deal[]
  readonly status: ConnectionStatus
  readonly error: string | null
}

/** Deduplicate by `dealId`, preferring the fullest row (the live one). */
function mergeDeals(existing: readonly Deal[], incoming: readonly Deal[]): Deal[] {
  const byId = new Map<string, Deal>()
  for (const d of existing) if (d.dealId) byId.set(d.dealId, d)
  for (const d of incoming) if (d.dealId) byId.set(d.dealId, d)
  // Any incoming deal with no known id falls back to a time+symbol key so the
  // ledger never shows a live-only row twice either.
  for (const d of incoming) {
    if (!d.dealId) {
      const key = `${d.time}|${d.symbol}|${d.side}`
      byId.set(`fallback-${key}`, d)
    }
  }
  return [...byId.values()].sort((a, b) => a.time.localeCompare(b.time))
}

/**
 * Subscribes to the live deal stream and keeps the all-time ledger in sync.
 *
 * `live` is the current `/market/deals` result (may be null while first
 * loading). On every change it is written to the ledger (idempotently) and
 * merged into the accumulated set. Errors reading or writing the ledger never
 * mask the live feed — the live data still shows; the ledger just stops
 * accruing until the next successful sync.
 */
export function useDealLedger(live: { readonly data: DealHistoryLike | null }): DealLedger {
  const [allDeals, setAllDeals] = useState<readonly Deal[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const syncedSignature = useRef<string | null>(null)

  // Seed from the persisted ledger once, so the card shows full history even
  // before the first live fetch completes.
  useEffect(() => {
    const controller = new AbortController()
    marketApi
      .ledgerDeals(controller.signal)
      .then((deals) => {
        setAllDeals(deals)
        setStatus('connected')
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Ledger unavailable')
        setStatus('disconnected')
      })
    return () => controller.abort()
  }, [])

  // On each live refresh, append any new fills to the ledger and merge them in.
  useEffect(() => {
    const liveDeals = live.data?.deals
    if (!liveDeals || liveDeals.length === 0) return

    // Guard against re-syncing the same live snapshot (e.g. the poll returns
    // byte-identical data on consecutive ticks). Signature is the set of ids.
    const sig = liveDeals
      .map((d) => d.dealId ?? `${d.time}|${d.symbol}|${d.side}`)
      .sort()
      .join('|')
    if (sig === syncedSignature.current) return
    syncedSignature.current = sig

    const controller = new AbortController()
    ;(async () => {
      try {
        await marketApi.appendDeals(liveDeals, controller.signal)
        setError(null)
        setAllDeals((prev) => mergeDeals(prev, liveDeals))
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Ledger write failed')
      }
    })()
    return () => controller.abort()
  }, [live.data])

  return { allDeals, status, error }
}

/** Minimal shape so this hook doesn't depend on the full DealHistory. */
interface DealHistoryLike {
  readonly deals: readonly Deal[]
}