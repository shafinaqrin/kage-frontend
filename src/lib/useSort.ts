'use client'

import { useCallback, useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

/** What a column header needs to render its sort affordance. */
export interface SortControl {
  onToggle: () => void
  /** 'asc' | 'desc' when this column is the active one, otherwise null. */
  active: SortDirection | null
  /** True when this column is currently the sort key. */
  isActive: boolean
}

export interface UseTableSortResult<K extends string, T> {
  rows: readonly T[]
  control: (key: K) => SortControl
}

/**
 * Column sorting for the market tables.
 *
 * Sorting can start disabled, in which case the source order is preserved until
 * the user clicks a header. That default suits the watchlist, which follows the
 * user's own OpenD ordering. Callers that want an initial sort (the screener
 * opens on highest volume first) pass `initial`.
 *
 * Missing values always sort last, in both directions. "Ascending puts blanks
 * first" is technically consistent but useless in practice -- it buries real rows
 * behind empty ones -- so nulls are pinned to the bottom instead.
 *
 * Ties fall back to source order, so equal rows never swap places between
 * renders.
 */
export function useTableSort<K extends string, T>(
  rows: readonly T[],
  accessors: Record<K, (row: T) => number | string | null>,
  initial?: { key: K; direction: SortDirection },
): UseTableSortResult<K, T> {
  const [key, setKey] = useState<K | null>(initial?.key ?? null)
  const [direction, setDirection] = useState<SortDirection>(initial?.direction ?? 'asc')

  const toggle = useCallback((next: K) => {
    setKey((current) => {
      if (current === next) {
        setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
        return current
      }
      // A newly chosen column starts ascending.
      setDirection('asc')
      return next
    })
  }, [])

  const sorted = useMemo(() => {
    if (key === null) return rows

    const accessor = accessors[key]
    const sign = direction === 'asc' ? 1 : -1

    // Decorate once so each row's value is extracted a single time and the
    // null handling lives in one place.
    const decorated = rows.map((row, index) => ({ row, index, value: accessor(row) }))

    decorated.sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index
      if (a.value === null) return 1
      if (b.value === null) return -1

      const result =
        typeof a.value === 'string' || typeof b.value === 'string'
          ? String(a.value).localeCompare(String(b.value), 'en', { sensitivity: 'base' })
          : a.value - b.value

      return result === 0 ? a.index - b.index : result * sign
    })

    return decorated.map((d) => d.row)
  }, [rows, key, direction, accessors])

  const control = useCallback(
    (column: K): SortControl => ({
      onToggle: () => toggle(column),
      active: key === column ? direction : null,
      isActive: key === column,
    }),
    [key, direction, toggle],
  )

  return { rows: sorted, control }
}
