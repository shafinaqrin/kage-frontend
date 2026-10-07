'use client'

import {
  LayoutDashboard,
  LayoutList,
  LineChart,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Trash2,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The app's icon set, drawn from `lucide-react`.
 *
 * Every icon the interface needs is declared here by a semantic name rather
 * than being hand-drawn inline or imported ad hoc, so the whole app draws from
 * one palette. Icons inherit `currentColor`, so they re-tone with the M3 role
 * of wherever they sit (e.g. `text-negative` turns a delete/trash icon red).
 */
type IconName =
  | 'menu'
  | 'sun'
  | 'moon'
  | 'dashboard'
  | 'watchlist'
  | 'screener'
  | 'positions'
  | 'settings'
  | 'search'
  | 'refresh'
  | 'trash'

export type { IconName }

const ICONS: Record<IconName, LucideIcon> = {
  menu: Menu,
  sun: Sun,
  moon: Moon,
  dashboard: LayoutDashboard,
  watchlist: LayoutList,
  screener: LineChart,
  positions: Wallet,
  settings: Settings,
  search: Search,
  refresh: RefreshCw,
  trash: Trash2,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Lucide = ICONS[name]
  return <Lucide className="block" width={size} height={size} strokeWidth={1.7} aria-hidden="true" />
}