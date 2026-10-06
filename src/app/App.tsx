 'use client'

import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { ClosedTrade, ConnectionStatus, DealHistory, MarketSession, Position, QuoteSnapshot, ScreenerRow } from '../domain/types'
import { marketApi } from '../data/api'
import { useMarketData } from '../lib/useMarketData'
import { useDealLedger } from '../lib/useDealLedger'
import { useTheme } from '../lib/useTheme'
import { formatClock, sessionFromOpenD, sessionLabel } from '../lib/format'
import { PortfolioCards } from '../features/market-overview/PortfolioCards'
import { Watchlist } from '../features/quotes/Watchlist'
import { Positions } from '../features/positions/Positions'
import { ClosedPositions } from '../features/closed-positions/ClosedPositions'
import { Screener } from '../features/screener/Screener'

type NavKey = 'dashboard' | 'watchlist' | 'screener' | 'positions' | 'settings'

const NAV_ITEMS: readonly { key: NavKey; label: string; icon: IconName; disabled?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'watchlist', label: 'Watchlist', icon: 'watchlist' },
  { key: 'screener', label: 'Screener', icon: 'screener' },
  { key: 'positions', label: 'Positions', icon: 'wallet' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

type IconName = 'menu' | 'sun' | 'moon' | 'dashboard' | 'watchlist' | 'screener' | 'wallet' | 'settings'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactElement> = {
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
    moon: <path d="M19.2 14.3A7.8 7.8 0 0 1 9.7 4.8a8 8 0 1 0 9.5 9.5Z" />,
    dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    watchlist: <><path d="M5 6.5h14M5 12h14M5 17.5h9" /><circle cx="4" cy="6.5" r=".7" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r=".7" fill="currentColor" stroke="none" /><circle cx="4" cy="17.5" r=".7" fill="currentColor" stroke="none" /></>,
    screener: <><path d="M4 5h16l-6 7v5.5l-4 2V12Z" /></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5Z" /><path d="M4 8h15M15 12h4" /><circle cx="15" cy="12" r=".7" fill="currentColor" stroke="none" /></>,
    settings: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.5" /></>,
  }
  return <svg className="block" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const label =
    status === 'connected' ? 'OpenD connected' : status === 'connecting' ? 'Connecting' : 'OpenD unavailable'

  return (
    <span className={`inline-flex items-center gap-2 rounded-full bg-secondary-container px-3 py-1.5 text-[0.72rem] font-semibold text-[var(--m3-on-secondary-container)] ${status === 'disconnected' ? 'bg-[var(--negative-container)] text-[var(--negative)]' : ''}`}>
      <span className={`size-2 rounded-full bg-[var(--positive)] ${status === 'connecting' ? 'animate-pulse bg-[var(--m3-tertiary)]' : ''} ${status === 'disconnected' ? 'bg-[var(--negative)]' : ''}`} aria-hidden="true" />
      {label}
    </span>
  )
}

export default function App() {
  const { theme, toggleTheme, hydrated } = useTheme()
  const [nav, setNav] = useState<NavKey>('dashboard')
  const [railOpen, setRailOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  // The watchlist (and therefore the symbol set) is owned by OpenD: the client
  // never holds its own copy of the codes.
  const quotes = useMarketData<readonly QuoteSnapshot[]>(
    (signal) => marketApi.quotes(signal),
    [],
    30_000,
  )

  // Positions come from OpenD's trade context, a different provider path from
  // quotes: holdings carry real figures even when the MY quote entitlement is
  // missing. Polled on the same cadence as quotes since both are account-facing.
  const positions = useMarketData<readonly Position[]>(
    (signal) => marketApi.positions(signal),
    [],
    30_000,
  )

  // The Bursa session is read from OpenD, not assumed: when OpenD reports
  // nothing usable we fall back to "closed" rather than claiming "Market Open".
  const session = useMarketData<MarketSession | null>(
    (signal) => marketApi.marketSession(signal).then(sessionFromOpenD),
    null,
    60_000,
  )

  // Deal history is the source of the Realized figure. It was briefly not —
  // OpenD's booked `realized_pl` via `/api/market/realized` looked authoritative
  // and was used instead — but OpenD *evicts* a sold-out position from its
  // position query after a few days, taking the booked profit with it. On this
  // account the booked total quietly fell to RM 248.00 while four stocks had in
  // fact been closed for RM 475.50. The deal stream never lost them, and the
  // derivation reproduces OpenD's booked figure exactly wherever both exist, so
  // deals are the more complete source. Deal history is still capped at ~90 days
  // by OpenD, which is why the card labels its scope.
  const deals = useMarketData<DealHistory | null>(
    (signal) => marketApi.deals(signal),
    null,
    5 * 60_000,
  )

  // The durable ledger: every fill moomoo has ever delivered, accrued across
  // loads so history outlives OpenD's ~90-day window. The live feed above still
  // drives display; this union drives the all-time Realized figure.
  const ledger = useDealLedger(deals)

  // The same deal stream, regrouped per stock: a stock whose every recorded buy
  // has been sold again has no row in `positions()` any more. Separate state
  // rather than a `useMemo` over `deals` so the grouping reads as its own
  // request lifecycle — and so a failure to derive cannot be mistaken for a
  // failure to fetch.
  const closed = useMarketData<readonly ClosedTrade[]>(
    (signal) => marketApi.closedPositions(signal),
    [],
    5 * 60_000,
  )

  // The screener is a separate source from OpenD: it is crawled from KLSE
  // Screener by the kage-screener sidecar and already filtered to Shariah names.
  // Slower-moving than quotes, so it is polled far less often.
  const screener = useMarketData<readonly ScreenerRow[]>(
    (signal) => marketApi.screenerShariah(signal),
    [],
    15 * 60_000,
  )

  const symbol = selectedSymbol ?? quotes.data[0]?.symbol ?? ''

  const handleSelect = (next: string) => setSelectedSymbol(next)

  // Breadth and session are derived from the live Moomoo quotes rather than a
  // stored or invented snapshot: no data in, no data shown.
  const marketSession: MarketSession = session.data ?? 'closed'

  // OpenD reports an explicit reason when MY quote rights are missing. Surface
  // it once, prominently, instead of repeating it on every row.
  const unavailableReason = useMemo(
    () => quotes.data.find((q) => !q.available)?.reason ?? quotes.error ?? null,
    [quotes.data, quotes.error],
  )
  const pricingUnavailable = quotes.data.length > 0 && quotes.data.every((q) => !q.available)

  const quotesErrorBanner = quotes.error && (
    <p
      className="m-0 rounded-2xl bg-negative-container px-[1.1rem] py-[0.7rem] text-[0.76rem] font-semibold text-negative"
      role="status"
    >
      {quotes.error} — no quote data shown.
    </p>
  )

  const pricingBanner = !quotes.error && pricingUnavailable && (
    <p
      className="m-0 rounded-2xl bg-negative-container px-[1.1rem] py-[0.7rem] text-[0.76rem] font-semibold text-negative"
      role="status"
    >
      {unavailableReason}
    </p>
  )

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
          <span className="text-[0.72rem] text-muted max-[768px]:hidden">Bursa {sessionLabel(marketSession)}{hydrated ? ` · ${formatClock(new Date().toISOString())} MYT` : ''}</span>
        </div>
        <ConnectionBadge status={quotes.status} />
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
                 <button type="button" className="cursor-pointer rounded-full border border-[color-mix(in_srgb,var(--m3-outline-variant)_70%,transparent)] bg-primary px-[0.9rem] py-[0.35rem] text-[0.75rem] font-bold text-on-primary transition-[background,color,transform] duration-250 hover:bg-primary active:scale-95" onClick={toggleTheme}>
                   {theme === 'dark' ? 'Dark' : 'Light'}
                 </button>
              </div>
            </section>
          ) : nav === 'watchlist' ? (
            <>
              {quotesErrorBanner}
              {pricingBanner}
              <Watchlist quotes={quotes.data} selected={symbol} onSelect={handleSelect} status={quotes.status} />
            </>
          ) : nav === 'positions' ? (
            <>
              <Positions positions={positions.data} status={positions.status} error={positions.error} />
              <ClosedPositions trades={closed.data} status={closed.status} error={closed.error} />
            </>
          ) : nav === 'screener' ? (
            <Screener rows={screener.data} status={screener.status} error={screener.error} />
          ) : (
            <>
              <PortfolioCards
                positions={positions.data}
                status={positions.status}
                error={positions.error}
                session={marketSession}
                deals={ledger.allDeals.length > 0 ? ledger.allDeals : null}
              />
              {/*
                Left: the account's two tables stacked — what is still held, then
                what has been sold off. They answer the same question about
                different holdings, so reading them one above the other is how a
                stock you own is told apart from one you are finished with.
                Right: the screener, which is market-wide rather than
                account-specific, spanning the full height of both.
              */}
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-stretch gap-6 max-[1080px]:grid-cols-1">
                <div className="flex min-w-0 min-h-0 flex-col gap-6">
                  <Positions positions={positions.data} status={positions.status} error={positions.error} />
                  <ClosedPositions trades={closed.data} status={closed.status} error={closed.error} />
                </div>
                <div className="flex min-w-0 min-h-0 flex-col">
                  <Screener rows={screener.data} status={screener.status} error={screener.error} />
                </div>
              </div>
              {quotesErrorBanner}
              {pricingBanner}
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
