'use client'

import type { ReactNode } from 'react'

export function MaterialButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return <button className={className} type="button" onClick={onClick}>{children}</button>
}

export function MaterialFilterChip({
  children,
  selected,
  onClick,
}: {
  children: ReactNode
  selected: boolean
  onClick: () => void
}) {
  return <button className={`chip ${selected ? 'chip--active' : ''}`} type="button" aria-pressed={selected} onClick={onClick}>{children}</button>
}
