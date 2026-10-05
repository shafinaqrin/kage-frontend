'use client'

import type { SortControl } from '../../lib/useSort'

/**
 * A clickable column header that shows sort direction.
 *
 * `aria-sort` is placed on the `<th>` (not the button) so assistive tech
 * announces the column's sort order, which is where that attribute belongs.
 * The button carries the accessible name, so the header is reachable and
 * operable by keyboard.
 */
export function SortableHeader({
  label,
  numeric = false,
  control,
  className,
}: {
  label: string
  numeric?: boolean
  control: SortControl
  className?: string
}) {
  const ariaSort =
    control.active === 'asc' ? 'ascending' : control.active === 'desc' ? 'descending' : 'none'

  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        className={`th-sort${numeric ? ' th-sort--num' : ''}${control.isActive ? ' is-active' : ''}`}
        onClick={control.onToggle}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className="th-sort-icon" aria-hidden="true">
          {control.active === 'asc' ? '▲' : control.active === 'desc' ? '▼' : '↕'}
        </span>
      </button>
    </th>
  )
}
