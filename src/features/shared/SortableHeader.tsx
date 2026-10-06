'use client'

import type { SortControl } from '../../lib/useSort'
import { tableCellClass, tableHeaderClass } from './positionCells'

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

  // The sort button fills the header cell so the whole header is a click target;
  // numeric columns are right-aligned, so their control follows the text.
  return (
    <th scope="col" aria-sort={ariaSort} className={`${tableCellClass} ${tableHeaderClass} ${className ?? ''}`}>
      <button
        type="button"
        className={`group inline-flex w-full cursor-pointer items-center gap-[0.3rem] border-0 bg-transparent p-0 [font:inherit] [letter-spacing:inherit] [text-transform:inherit] text-inherit transition-colors duration-[220ms] motion-standard hover:text-ink focus-visible:rounded-[0.4rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          numeric ? 'justify-end' : ''
        }${control.isActive ? ' text-primary' : ''}`}
        onClick={control.onToggle}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span
          className={`text-[0.6rem] leading-none opacity-45 transition-opacity duration-[220ms] motion-standard group-hover:opacity-85 max-md:hidden ${control.isActive ? 'opacity-100' : ''}`}
          aria-hidden="true"
        >
          {control.active === 'asc' ? '▲' : control.active === 'desc' ? '▼' : '↕'}
        </span>
      </button>
    </th>
  )
}
