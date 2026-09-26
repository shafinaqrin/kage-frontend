'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionStatus } from '../domain/types'

interface MarketState<T> {
  data: T
  status: ConnectionStatus
  error: string | null
}

export function useMarketData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  initial: T,
  pollMs?: number,
  /** Changing this string refetches immediately (e.g. `symbol|timeframe`). */
  requestKey = '',
): MarketState<T> & { refresh: () => void } {
  const [state, setState] = useState<MarketState<T>>({
    data: initial,
    status: 'connecting',
    error: null,
  })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await fetcherRef.current(signal)
      setState({ data, status: 'connected', error: null })
    } catch (error) {
      if (signal.aborted) return
      setState((prev) => ({
        ...prev,
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Request failed',
      }))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    if (!pollMs) return () => controller.abort()
    const timer = window.setInterval(() => {
      void load(controller.signal)
    }, pollMs)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [load, pollMs, requestKey])

  const refresh = useCallback(() => {
    const controller = new AbortController()
    void load(controller.signal)
  }, [load])

  return { ...state, refresh }
}
