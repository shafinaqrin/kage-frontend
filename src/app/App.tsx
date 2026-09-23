 'use client'

import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { ConnectionStatus, DataSource, MarketOverview, QuoteSnapshot } from '../domain/types'
import { marketApi } from '../data/api'
import { useMarketData } from '../lib/useMarketData'
import { useTheme } from '../lib/useTheme'
import { formatClock } from '../lib/format'
import { OverviewCards } from '../features/market-overview/OverviewCards'
import { Watchlist } from '../features/quotes/Watchlist'

type NavKey = 'dashboard' | 'watchlist' | 'positions' | 'settings'

const NAV_ITEMS: readonly { key: NavKey; label: string; icon: IconName; disabled?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'watchlist', label: 'Watchlist', icon: 'watchlist' },
  { key: 'positions', label: 'Positions', icon: 'wallet', disabled: true },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

type IconName = 'menu' | 'sun' | 'moon' | 'dashboard' | 'watchlist' | 'wallet' | 'settings'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactElement> = {
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
    moon: <path d="M19.2 14.3A7.8 7.8 0 0 1 9.7 4.8a8 8 0 1 0 9.5 9.5Z" />,
    dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    watchlist: <><path d="M5 6.5h14M5 12h14M5 17.5h9" /><circle cx="4" cy="6.5" r=".7" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r=".7" fill="currentColor" stroke="none" /><circle cx="4" cy="17.5" r=".7" fill="currentColor" stroke="none" /></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5Z" /><path d="M4 8h15M15 12h4" /><circle cx="15" cy="12" r=".7" fill="currentColor" stroke="none" /></>,
    settings: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.5" /></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function ConnectionBadge({ status, source }: { status: ConnectionStatus; source: DataSource }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full bg-secondary-container px-3 py-1.5 text-[0.72rem] font-semibold text-[var(--m3-on-secondary-container)] ${status === 'disconnected' ? 'bg-[var(--negative-container)] text-[var(--negative)]' : ''}`}>
      <span className={`size-2 rounded-full bg-[var(--positive)] ${status === 'connecting' ? 'animate-pulse bg-[var(--m3-tertiary)]' : ''}`} aria-hidden="true" />
      {source === 'demo' ? 'Demo data' : 'Live data'} · {status}
    </span>
  )
}

export default function App() {
  const { theme, toggleTheme, hydrated } = useTheme()
  const [nav, setNav] = useState<NavKey>('dashboard')
  const [railOpen, setRailOpen] = useState(false)
  const [symbol, setSymbol] = useState('1155')

  const quotes = useMarketData(
    (signal) => marketApi.quotes(signal).then((d) => ({ data: d, source: 'live' as const })),
    [],
    15_000,
  )

  // Breadth and session are derived from the live Moomoo quotes rather than a
  // stored or invented snapshot: no data in, no data shown.
  const overview: MarketOverview = useMemo(() => {
    const live = quotes.data.filter(
      (q): q is QuoteSnapshot & { change: number } => q.available && q.change !== null,
    )
    const advancing = live.filter((q) => q.change > 0).length
    const declining = live.filter((q) => q.change < 0).length

    return {
      session: 'open',
      dataSource: 'live',
      index: { name: 'Bursa watchlist', value: live.length, change: advancing - declining, changePercent: 0 },
      breadth: { advancing, declining, unchanged: live.length - advancing - declining },
      updatedAt: new Date().toISOString(),
    }
  }, [quotes.data])

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-surface bg-[radial-gradient(circle_at_72%_-10%,color-mix(in_srgb,var(--m3-primary-container)_42%,transparent),transparent_28rem)] text-ink">
      <header className="sticky top-0 z-10 flex min-h-[4.25rem] w-full items-center gap-3 border-b border-[color-mix(in_srgb,var(--m3-outline-variant)_55%,transparent)] bg-[color-mix(in_srgb,var(--m3-surface)_88%,transparent)] px-5 py-3 backdrop-blur-[18px] transition-[background] duration-500 motion-standard max-[768px]:px-3.5">
        <button
          type="button"
          className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-transparent text-muted transition-transform duration-300 motion-spring hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] active:scale-95 max-[768px]:hidden"
          aria-label={railOpen ? 'Collapse navigation' : 'Expand navigation'}
          aria-expanded={railOpen}
          onClick={() => setRailOpen((v) => !v)}
        >
           <Icon name="menu" />
        </button>
        <div className="mr-auto flex flex-col leading-tight">
          <span className="text-[1.05rem] font-extrabold tracking-[-0.01em]">Kage</span>
          <span className="text-[0.72rem] text-muted max-[768px]:hidden">Bursa Intraday · {formatClock(overview.updatedAt)} MYT</span>
        </div>
        <ConnectionBadge status={quotes.status} source={quotes.dataSource} />
         <button type="button" className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-transparent text-muted transition-transform duration-300 motion-spring hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] active:scale-95" onClick={toggleTheme} aria-label={hydrated ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme` : 'Toggle theme'}>
           <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </header>

      <div className="flex min-h-0 w-full min-w-0">
        <nav className={`w-16 shrink-0 overflow-hidden border-r border-[color-mix(in_srgb,var(--m3-outline-variant)_34%,transparent)] bg-[color-mix(in_srgb,var(--m3-surface-container)_42%,transparent)] px-1.5 py-3 transition-[width,flex-basis,background] duration-500 motion-spring max-[768px]:hidden ${railOpen ? 'w-48' : ''}`} aria-label="Primary">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={`mx-auto grid h-[3.25rem] min-h-[3.25rem] w-[3.25rem] place-items-center rounded-[1.1rem] border-0 bg-transparent px-2 py-1 text-sm font-semibold text-muted transition-[background,color,transform] duration-300 motion-spring hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${railOpen ? 'w-full grid-cols-[2.15rem_minmax(0,1fr)] justify-items-start gap-3' : 'grid-cols-1 justify-items-center'} ${nav === item.key ? 'bg-secondary-container text-[var(--m3-on-secondary-container)]' : ''}`}
                  title={item.label}
                  disabled={item.disabled}
                  aria-current={nav === item.key ? 'page' : undefined}
                  onClick={() => setNav(item.key)}
                >
                  <span className="grid size-[2.15rem] shrink-0 place-items-center"><Icon name={item.icon} /></span>
                  <span className={`overflow-hidden whitespace-nowrap transition-[width,opacity,transform] duration-300 motion-standard ${railOpen ? 'w-auto translate-x-0 opacity-100' : 'w-0 -translate-x-2 opacity-0'}`}>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-6 px-9 pb-16 pt-8 max-[768px]:gap-4 max-[768px]:px-3.5 max-[768px]:pb-24 max-[768px]:pt-4" id="main">
          {nav === 'settings' ? (
            <section className="min-w-0 max-w-full rounded-[1.6rem] border border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] bg-[color-mix(in_srgb,var(--m3-on-surface)_4%,transparent)] p-2 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_5%,transparent)]" aria-label="Settings">
              <h2 className="px-4 pt-3 text-base font-bold">Settings</h2>
              <p className="px-4 text-xs text-muted">Theme, data source, and OpenD configuration arrive with the backend slice.</p>
              <div className="flex items-center justify-between px-4 py-3.5 text-sm font-semibold">
                <span>Dark theme</span>
                 <button className="md3-settings-button chip chip--active" type="button" onClick={toggleTheme}>
                   {theme === 'dark' ? 'Dark' : 'Light'}
                 </button>
              </div>
            </section>
          ) : nav === 'watchlist' ? (
            <Watchlist quotes={quotes.data} selected={symbol} onSelect={setSymbol} status={quotes.status} />
          ) : (
            <>
              <OverviewCards overview={overview} quotes={quotes.data} />
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start gap-6 max-[1080px]:grid-cols-1 max-[768px]:gap-4">
                <Watchlist quotes={quotes.data} selected={symbol} onSelect={setSymbol} status={quotes.status} />
              </div>
              {quotes.error && (
                <p className="conn-banner" role="status">
                  Moomoo OpenD unreachable ({quotes.error}) — no quote data shown.
                </p>
              )}
            </>
          )}
        </main>
        <nav className="fixed bottom-[max(0.7rem,env(safe-area-inset-bottom))] left-1/2 z-10 hidden w-max max-w-[calc(100vw-1.4rem)] -translate-x-1/2 items-center justify-center gap-1 rounded-[1.65rem] border border-[color-mix(in_srgb,var(--m3-outline-variant)_46%,transparent)] bg-[color-mix(in_srgb,var(--m3-surface-container-high)_90%,transparent)] px-2 py-2 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_16%,transparent),inset_0_1px_0_color-mix(in_srgb,white_52%,transparent)] backdrop-blur-[18px] max-[768px]:flex" aria-label="Mobile navigation">
          {NAV_ITEMS.filter((item) => !item.disabled).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`grid size-11 place-items-center rounded-full border-0 bg-transparent text-muted transition-[color,transform] duration-300 motion-spring active:scale-90 ${nav === item.key ? 'text-[var(--m3-primary)] drop-shadow-[0_0_0.5rem_color-mix(in_srgb,var(--m3-primary)_30%,transparent)]' : ''}`}
              aria-label={item.label}
              title={item.label}
              aria-current={nav === item.key ? 'page' : undefined}
              onClick={() => { setNav(item.key); setRailOpen(false) }}
            >
              <span className="grid size-10 place-items-center"><Icon name={item.icon} size={19} /></span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
