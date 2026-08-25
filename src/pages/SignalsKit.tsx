// Dev-only scratch route to render the shared Signals component set in
// isolation (Phase 0.4 verification -- "render each in isolation" per the
// build instructions; no Storybook configured in this repo). Not linked
// from nav. Renamed from InformKit (Inform naming hardening checkpoint,
// 2026-08-25) -- same file, same purpose, neutral current name.
import { useState } from 'react'
import { KpiCard } from '../components/signals/KpiCard'
import { SignalCard } from '../components/signals/SignalCard'
import { SignalFeed } from '../components/signals/SignalFeed'
import { FeedFilterBar, type FeedTab, type SortMode } from '../components/signals/FeedFilterBar'
import { MarketWeather } from '../components/signals/MarketWeather'
import type { Signal, KpiDatum, WeatherRow } from '../components/signals/types'

const SIGNALS: Signal[] = [
  { id: '1', competitor: 'Pharvaris', competitorId: 'pharvaris', type: 'Publication', severity: 'high', headline: 'FDA accepts NDA for deucrictibant in hereditary angioedema, sets PDUFA date', source: 'FDA.gov', sourceUrl: 'https://fda.gov', time: '2h ago', excerpt: 'the Agency has accepted the New Drug Application and assigned a target action date', why: 'Clinical update from Pharvaris — assess relative positioning vs Ekterly on efficacy and safety.', unread: true },
  { id: '2', competitor: 'BioCryst', competitorId: 'biocryst', type: 'Company IR', severity: 'medium', headline: 'Q2 earnings: Orladeyo revenue up 42% YoY, raises FY guidance', source: 'investors.biocryst.com', time: '6h ago', excerpt: 'Orladeyo net revenue grew 42% year-over-year; raising full-year guidance', why: 'Orladeyo growth rate is the benchmark our launch forecast is measured against.', unread: true },
  { id: '3', competitor: 'KalVista', competitorId: 'kalvista', type: 'Trial', severity: 'low', headline: 'KalVista completes enrollment in Phase 3 pediatric extension study', source: 'clinicaltrials.gov', time: '1d ago', excerpt: 'enrollment is now complete across all sites', why: 'Pediatric data timeline informs when a competing label expansion could reach market.' },
]

const KPIS: KpiDatum[] = [
  { label: 'New this week', value: 12, delta: '8%', deltaTone: 'up', caption: 'vs last 7 days', link: 'Open new arrivals', linkTo: '/alerts' },
  { label: 'Unread signals', value: 6, caption: 'across 3 competitors', breakdown: [{ label: '11 clinical', color: 'var(--indigo-500)' }, { label: '3 commercial', color: 'var(--crimson-600)' }], link: 'Open inbox', linkTo: '/alerts' },
  { label: 'High importance', value: 6, sparkline: [24, 22, 26, 18, 20, 12, 16, 8, 10, 4, 6], deltaTone: 'down', link: 'Triage now', linkTo: '/alerts' },
]

const WEATHER_ROWS: WeatherRow[] = [
  { competitor: 'Pharvaris', competitorId: 'pharvaris', count: 12, severity: 'high', summary: 'NDA accepted for deucrictibant, PDUFA set; differentiated data at EAACI 2026.' },
  { competitor: 'BioCryst', competitorId: 'biocryst', count: 8, severity: 'medium', summary: 'Q2 earnings: Orladeyo revenue up 42% YoY, guidance raised.' },
  { competitor: 'Takeda', competitorId: 'takeda', count: 5, severity: 'low', summary: 'Real-world evidence defending Takhzyro; no new launches.' },
]

export default function SignalsKit() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<FeedTab>('All')
  const [sortMode, setSortMode] = useState<SortMode>('importance')
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D'>('30D')

  return (
    <div className="signals-app-bg" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {KPIS.map(k => <KpiCard key={k.label} kpi={k} />)}
      </section>

      <section>
        <FeedFilterBar
          query={query} onQueryChange={setQuery}
          tab={tab} onTabChange={setTab}
          sortMode={sortMode} onSortModeChange={setSortMode}
          facetLabel="Filter"
          facetOptions={[{ value: 'Pharvaris', label: 'Pharvaris', count: 12 }, { value: 'BioCryst', label: 'BioCryst', count: 8 }]}
          appliedChips={[{ key: 'competitor', value: 'Pharvaris', label: 'Pharvaris' }]}
        />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SignalCard signal={SIGNALS[0]} />
        <SignalCard signal={SIGNALS[1]} compact />
      </section>

      <section>
        <SignalFeed status="ready" signals={SIGNALS} openFeedTo="/alerts" />
      </section>

      <section>
        <SignalFeed status="loading" signals={[]} />
      </section>

      <section>
        <SignalFeed status="ready" signals={[]} emptyVariant="no-results" emptyAction={{ label: 'Clear filters' }} />
      </section>

      <section style={{ maxWidth: 400 }}>
        <MarketWeather
          asset="Ekterly" isLive state="pressure" qualifier="over the last 30 days"
          timeframe={timeframe} onTimeframeChange={setTimeframe}
          rows={WEATHER_ROWS}
          implication="On-demand oral competition is intensifying. Pharvaris' NDA acceptance and differentiated profile put near-term pressure on Ekterly's on-demand positioning."
          readMoreTo="/alerts"
        />
      </section>
    </div>
  )
}
