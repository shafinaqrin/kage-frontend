import type { MarketOverview, QuoteSnapshot } from '../../domain/types'
import { formatIndex, formatSigned, formatSignedPercent, formatVolume, sessionLabel } from '../../lib/format'

interface OverviewCardsProps {
  overview: MarketOverview
  quotes: readonly QuoteSnapshot[]
}

export function OverviewCards({ overview, quotes }: OverviewCardsProps) {
  // Only rank symbols Moomoo actually returned; unavailable rows have null change.
  const ranked = quotes
    .filter(
      (q): q is QuoteSnapshot & { change: number; changePercent: number; volume: number } =>
        q.available && q.change !== null && q.changePercent !== null && q.volume !== null,
    )
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
  const topMover = ranked[0]
  const advancingShare =
    overview.breadth.advancing + overview.breadth.declining + overview.breadth.unchanged > 0
      ? Math.round(
          (overview.breadth.advancing /
            (overview.breadth.advancing + overview.breadth.declining + overview.breadth.unchanged)) *
            100,
        )
      : 0

  return (
    <div className="grid w-full min-w-0 grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[768px]:grid-cols-1">
      <article className="min-w-0 rounded-[1.6rem] border border-transparent bg-primary-container p-5 text-[var(--m3-on-primary-container)] shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_5%,transparent)]" aria-label="Market session">
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] opacity-80">{sessionLabel(overview.session)}</p>
        <p className="my-1 truncate text-[2rem] font-extrabold tracking-[-0.03em] tabular-nums">{formatIndex(overview.index.value)}</p>
        <p className={`m-0 truncate pb-1 text-[0.74rem] font-semibold ${overview.index.change >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
          {overview.index.name} · {formatSigned(overview.index.change)} ({formatSignedPercent(overview.index.changePercent)})
        </p>
      </article>

      <article className="min-w-0 rounded-[1.6rem] border border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] bg-[color-mix(in_srgb,var(--m3-on-surface)_4%,transparent)] p-5 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_5%,transparent)]" aria-label="Top mover">
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted">Top mover</p>
        <p className="my-1 text-[1.45rem] font-extrabold tracking-[-0.03em]">{topMover?.symbol ?? '—'}</p>
        <p className={`m-0 pb-1 text-[0.74rem] font-semibold ${topMover && topMover.change >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
          {topMover ? `${formatSignedPercent(topMover.changePercent)} · ${formatVolume(topMover.volume)}` : 'No data'}
        </p>
      </article>

      <article className="min-w-0 rounded-[1.6rem] border border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] bg-[color-mix(in_srgb,var(--m3-on-surface)_4%,transparent)] p-5 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_5%,transparent)]" aria-label="Market breadth">
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted">Breadth</p>
        <p className="my-1 text-[1.45rem] font-extrabold tracking-[-0.03em]">{advancingShare}%</p>
        <div className="my-2 h-2 overflow-hidden rounded-full bg-[var(--negative-container)]" role="img" aria-label={`${overview.breadth.advancing} advancing, ${overview.breadth.declining} declining`}>
          <span className="block h-full rounded-full bg-[var(--positive)] transition-[width] duration-700 motion-standard" style={{ width: `${advancingShare}%` }} />
        </div>
        <p className="m-0 pb-1 text-[0.74rem] font-semibold text-[var(--positive)]">
          {overview.breadth.advancing} adv · <span className="tone-down">{overview.breadth.declining} dec</span> · {overview.breadth.unchanged} unch
        </p>
      </article>

      <article className="min-w-0 rounded-[1.6rem] border border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] bg-[color-mix(in_srgb,var(--m3-on-surface)_4%,transparent)] p-5 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_5%,transparent)]" aria-label="Positions placeholder">
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted">Positions</p>
        <p className="my-1 text-[1.45rem] font-extrabold tracking-[-0.03em]">—</p>
        <p className="m-0 pb-1 text-[0.74rem] font-semibold text-muted">Connect OpenD to enable</p>
      </article>
    </div>
  )
}
