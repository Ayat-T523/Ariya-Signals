/**
 * WarRoom.tsx — Phase 4 (docs/war-room-redesign-spec.md, Direction A).
 *
 * THESIS: "What needs me right now, and what should I do about it?" replaces
 * "what changed in HAE?" — the worklist is the spine; everything else recedes
 * to a condensed rail or a link, not a scroll.
 * OWN-WORLD: InForm — one glass stat bar (chrome) over a neumorphic cream
 * worklist plate (content); Signal Indigo marks synthesized text and links
 * only; severity reads as text + dot, never a colored border.
 * STORY: David lands, sees what needs him and how much pressure is building,
 * scans up to six worklist rows, handles or inspects, and is done.
 * FIRST VIEWPORT: header -> glass stat bar -> two-column grid (worklist spine
 * left, Market weather + Next up rail right) -> nothing below the fold at
 * 1440x900 or 1280x800.
 * FORM: Direction A ("Worklist") — one dominant column, chosen over the
 * two-column "Cockpit" (dilutes the one-job focus) and railless
 * "Single-stream" (demotes orientation too far) per the spec's own comparison.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Plus, Circle, PauseCircle, CheckCircle2, XCircle,
  ChevronDown, ExternalLink, MessageSquareText, Inbox, AlertTriangle,
} from 'lucide-react'
import { useApp, useConfig } from '../context/AppContext'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import SlideOver from '../components/ui/SlideOver'
import { AlertDetail } from '../components/inform/AlertDetail'
import { MarketWeather } from '../components/inform/MarketWeather'
import { SeverityDot, severityLabel } from '../components/inform/primitives'
import type { WeatherRow, WeatherState } from '../components/inform/types'
import { usePageLoad } from '../hooks/usePageLoad'
import { competitorsData, eventsData, userData } from '../data/kalvista'
import {
  getRegulatoryCalendar,
  getRecentSignals,
  getMarketImplications,
  type DbRegulatoryCalendarEvent,
  type DbMarketImplication,
  type HandlingState,
} from '../lib/db'
import { mapSignals, type MappedAlert } from '../lib/signalMapping'
import { cleanSignalText, SIGNAL_FALLBACK } from '../lib/signalText'
import { computeSeverity, summarizeSeverity, type Lexicon } from '../lib/signalSeverity'
import type { DbRecentSignal } from '../lib/db'

/** Days window for the worklist + market weather — must match buildNarration.mjs. */
const NARRATION_DAYS = 90
const SEVERITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

function isSignalReadable(s: DbRecentSignal): boolean {
  return cleanSignalText(s) !== SIGNAL_FALLBACK
}

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
}

function competitorById(id: string) {
  return competitorsData.find((c) => c.id === id)
}

// ── Header helpers ────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function headerTimestamp(lastRefreshedAt: Date) {
  const now = new Date()
  const dow = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = now.getDate()
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const diffMin = Math.round((now.getTime() - lastRefreshedAt.getTime()) / 60000)
  const refreshLabel = diffMin < 1 ? 'JUST NOW' : `${diffMin} MIN AGO`
  return `${dow} · ${month} ${day} · ${time} · LAST REFRESH ${refreshLabel}`
}

function relTimeShort(iso: string, now: Date = new Date()) {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const diffH = Math.round(diffMs / 3_600_000)
  if (diffH < 1) return 'now'
  if (diffH < 24) return `${diffH}h`
  return `${Math.round(diffH / 24)}d`
}

function daysUntilLabel(date: string) {
  const diff = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d ago`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}

function dayMonthParts(date: string) {
  const d = new Date(date)
  return {
    day: String(d.getUTCDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
  }
}

// ── Events: merge live EMA calendar + static eventsData, condensed to 3 ───────
type NextUpEvent = { id: string; date: string; title: string; sourceUrl?: string | null }

const ALLOWED_EMA_EVENT_TYPES = new Set(['CHMP', 'PRAC', 'OTHER'])
function isRelevantEMAEvent(e: DbRegulatoryCalendarEvent, lexicon: Lexicon): boolean {
  if (!ALLOWED_EMA_EVENT_TYPES.has(e.event_type)) return false
  if (e.event_type === 'CHMP' || e.event_type === 'PRAC') return true
  const title = (e.title ?? '').toLowerCase()
  return (
    lexicon.inns.some((t) => title.includes(t.toLowerCase())) ||
    lexicon.ta_terms.some((t) => title.includes(t.toLowerCase()))
  )
}

// ── Handling-state menu ────────────────────────────────────────────────────────
const STATE_META: Record<HandlingState, { label: string; icon: typeof Circle }> = {
  needs_triage: { label: 'Handle', icon: Circle },
  in_progress: { label: 'In progress', icon: PauseCircle },
  handled: { label: 'Handled', icon: CheckCircle2 },
  dismissed: { label: 'Dismissed', icon: XCircle },
}

function HandleMenu({ current, onChange }: { current: HandlingState; onChange: (state: HandlingState) => void }) {
  const [open, setOpen] = useState(false)
  const meta = STATE_META[current]
  const Icon = meta.icon

  const options: { state: HandlingState; label: string }[] =
    current === 'in_progress'
      ? [
          { state: 'handled', label: 'Mark handled' },
          { state: 'dismissed', label: 'Dismiss' },
          { state: 'needs_triage', label: 'Back to triage' },
        ]
      : [
          { state: 'in_progress', label: 'Start progress' },
          { state: 'handled', label: 'Mark handled' },
          { state: 'dismissed', label: 'Dismiss' },
        ]

  function choose(state: HandlingState) {
    onChange(state)
    setOpen(false)
  }

  return (
    <div
      className="worklist-handle"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
    >
      <button
        type="button"
        className={`worklist-handle-trigger${open ? ' is-open' : ''}${current === 'in_progress' ? ' is-in-progress' : ''}`}
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon size={13} aria-hidden="true" />
        {meta.label}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div className="menu-glass is-light is-compact worklist-handle-menu" role="menu">
          {options.map((opt) => {
            const OptIcon = STATE_META[opt.state].icon
            return (
              <div key={opt.state} className="item" role="menuitem" tabIndex={0}
                onClick={() => choose(opt.state)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(opt.state) } }}
              >
                <OptIcon size={14} aria-hidden="true" />
                {opt.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Worklist row ────────────────────────────────────────────────────────────
function WorklistRow({ alert, state, onStateChange, onInspect }: {
  alert: MappedAlert
  state: HandlingState
  onStateChange: (state: HandlingState) => void
  onInspect: () => void
}) {
  const competitor = competitorById(alert.competitorId)
  return (
    <div className="worklist-row">
      <div className="worklist-row-top">
        <span className="worklist-row-sev"><SeverityDot sev={alert.severity} /> {severityLabel(alert.severity)}</span>
        <div className="worklist-row-competitor" title={competitor?.name ?? alert.competitorId}>
          <CompetitorBadge name={competitor?.name ?? alert.competitorId} id={alert.competitorId} size={18} />
          <span className="name">{competitor?.name ?? alert.competitorId}</span>
        </div>
        <span className="worklist-row-headline" title={decodeEntities(alert.headline)}>{decodeEntities(alert.headline)}</span>
        <span className="worklist-row-time">{relTimeShort(alert.timestamp)}</span>
        <HandleMenu current={state} onChange={onStateChange} />
        <button type="button" className="worklist-inspect-btn" title="Inspect" aria-label="Inspect" onClick={onInspect}>
          <ExternalLink size={14} aria-hidden="true" />
        </button>
      </div>

      {alert.suggestedAction && (
        <p className="worklist-row-action-line" title={alert.suggestedAction}>
          <MessageSquareText aria-hidden="true" />
          <span>{alert.suggestedAction}</span>
        </p>
      )}
    </div>
  )
}

// ── Next up row (condensed) ──────────────────────────────────────────────────
function NextUpRow({ event }: { event: NextUpEvent }) {
  const { day, month } = dayMonthParts(event.date)
  return (
    <Link to={`/intelligence?tab=events&event=${event.id}`} className="next-up-row">
      <div className="next-up-date">
        <span className="day">{day}</span>
        <span className="month">{month}</span>
      </div>
      <span className="next-up-title">{event.title}</span>
      <span className="next-up-countdown">{daysUntilLabel(event.date)}</span>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WarRoom() {
  const { openAskModal, watchedCompetitors, handlingStates, getHandlingState, setHandlingState } = useApp()
  const { assetName, indication, lexiconInns, lexiconTaTerms } = useConfig()
  const lexicon = useMemo(() => ({ inns: lexiconInns, ta_terms: lexiconTaTerms }), [lexiconInns, lexiconTaTerms])
  const loaded = usePageLoad('war-room')
  const [sortMode, setSortMode] = useState<'importance' | 'recency'>('importance')
  const [inspecting, setInspecting] = useState<MappedAlert | null>(null)

  const watchedIds = Array.from(watchedCompetitors).sort()
  const filterIds = watchedIds.length > 0 ? watchedIds : undefined

  const { data: liveData, isSuccess: liveDataLoaded, isError: liveDataFailed, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['war-room-live', watchedIds],
    queryFn: () => Promise.all([
      getRecentSignals(NARRATION_DAYS, filterIds),
      getRegulatoryCalendar(),
      getMarketImplications(),
    ]).then(([recent, calendar, implications]) => ({ recent, calendar, implications })),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  })

  const recentLiveSignals = liveData?.recent ?? ([] as DbRecentSignal[])
  const calendarEvents = liveData?.calendar ?? ([] as DbRegulatoryCalendarEvent[])
  const marketImplications = liveData?.implications ?? ([] as DbMarketImplication[])
  const lastRefreshedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date()

  // Readable + watchlist-scoped, same order as the rest of the app: strip
  // XBRL/accession boilerplate first, then confirm competitor scope.
  const readableSignals = recentLiveSignals.filter(isSignalReadable)
  const relevantSignals = readableSignals.filter((s) => watchedCompetitors.has(s.competitor_id ?? ''))

  // Alert objects + severity come from the same mapSignal() pipeline the Alerts
  // page and its drawer use (signalMapping.ts) — not the WarRoom-only
  // computeSeverity() heuristic below — so a row's severity badge always
  // matches what its own Inspect drawer shows. Market weather (below) keeps
  // computeSeverity()/summarizeSeverity() as before: it's a different,
  // pre-existing, asset/lexicon-aware severity read used across WarRoom and
  // Competitors, and reconciling the two severity engines app-wide is out of
  // scope for this worklist build.
  const allAlerts = useMemo(() => mapSignals(relevantSignals), [relevantSignals])

  // "Needs you" = not already resolved, and either genuinely untouched or
  // high-severity (war-room-redesign-spec.md §4/§8 — explicit rule, since the
  // spec itself leaves this as an open question). Clearing this list, and the
  // count below, is the job of the page.
  function isNeedsYou(a: MappedAlert): boolean {
    const hs = handlingStates[a.id] ?? 'needs_triage'
    if (hs === 'handled' || hs === 'dismissed') return false
    return hs === 'needs_triage' || a.severity === 'high'
  }
  const needsYouAlerts = allAlerts.filter(isNeedsYou)
  const needsYouCount = needsYouAlerts.length

  const worklistItems = [...needsYouAlerts]
    .sort((a, b) => {
      if (sortMode === 'importance') {
        const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
        if (sevDiff !== 0) return sevDiff
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    .slice(0, 6)
  const hiddenCount = Math.max(0, needsYouCount - worklistItems.length)

  // Most-active tracked competitor — highest relevant-signal count in the window.
  const countsByCompetitor = new Map<string, number>()
  for (const s of relevantSignals) countsByCompetitor.set(s.competitor_id, (countsByCompetitor.get(s.competitor_id) ?? 0) + 1)
  const mostActive = [...countsByCompetitor.entries()].sort((a, b) => b[1] - a[1])[0]
  const mostActiveName = mostActive ? competitorById(mostActive[0])?.name ?? mostActive[0] : null

  const signalVolume = relevantSignals.length // total in the window; read/unread state lives on the Alerts page, not here

  // Market weather — same pressure computation as before Phase 4 (unchanged).
  const weatherSeverity = summarizeSeverity(recentLiveSignals, lexicon, new Date())
  const pressureState: WeatherState =
    weatherSeverity.high >= 2 ? 'pressure'
    : (weatherSeverity.high >= 1 || weatherSeverity.medium >= 3) ? 'stable'
    : 'clearing'
  const pressureQualifier = `over the last ${NARRATION_DAYS} days`

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const cutoff7d = sevenDaysAgo.toISOString().slice(0, 10)
  const weeklySignalsByCompetitor = new Map<string, DbRecentSignal[]>()
  for (const s of relevantSignals) {
    if (s.date === null || s.date < cutoff7d) continue
    const arr = weeklySignalsByCompetitor.get(s.competitor_id) ?? []
    arr.push(s)
    weeklySignalsByCompetitor.set(s.competitor_id, arr)
  }
  const weatherRows: WeatherRow[] = [...weeklySignalsByCompetitor.entries()]
    .slice(0, 5)
    .map(([competitorId, sigs]) => {
      const name = competitorById(competitorId)?.name ?? competitorId
      const counts = summarizeSeverity(sigs, lexicon, new Date())
      const worst: 'high' | 'medium' | 'low' = counts.high > 0 ? 'high' : counts.medium > 0 ? 'medium' : 'low'
      const top = sigs.find(isSignalReadable)
      return {
        competitor: name,
        competitorId,
        count: sigs.length,
        severity: worst,
        summary: top ? decodeEntities(cleanSignalText(top)) : 'New activity this week.',
      }
    })

  const weatherImplications = marketImplications.slice(0, 3).map((imp) => decodeEntities(imp.content))

  // Upcoming events — merged live EMA calendar + static eventsData, condensed to 3.
  const nowStr = new Date().toISOString().slice(0, 10)
  const liveEventItems: NextUpEvent[] = calendarEvents
    .filter((e) => e.start_date !== null && (e.start_date as string) >= nowStr)
    .filter((e) => isRelevantEMAEvent(e, lexicon))
    .filter((e) => !/^\d{1,2}:\d{2}$/.test(e.title ?? ''))
    .map((e) => ({ id: e.id, date: e.start_date ?? '', title: e.title ?? `${e.event_type} Meeting`, sourceUrl: e.source_url }))
  const liveTitles = new Set(liveEventItems.map((e) => e.title.toLowerCase()))
  const staticEventItems: NextUpEvent[] = (eventsData as unknown as Array<{ id: string; date: string; title: string; sourceUrl?: string | null }>)
    .filter((e) => new Date(e.date) >= new Date())
    .filter((e) => !liveTitles.has((e.title ?? '').toLowerCase()))
    .map((e) => ({ id: e.id, date: e.date, title: e.title, sourceUrl: e.sourceUrl }))
  const upcomingEvents = [...liveEventItems, ...staticEventItems]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 3)

  function openInspect(alert: MappedAlert) { setInspecting(alert) }
  function handleChange(id: string, state: HandlingState) { setHandlingState(id, state) }

  const showSkeleton = !loaded || !liveDataLoaded

  return (
    <div data-page-pad className="war-room-page">

      {/* Header */}
      <div className="war-room-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-600)' }}>
            {headerTimestamp(lastRefreshedAt)}
          </p>
          <h1 className="war-room-title" style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.25 }}>
            {greeting()}, {userData.user.name}.{' '}
            <span style={{ color: 'var(--ink-600)', fontWeight: 500 }}>Here&rsquo;s what needs you in {indication}.</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => openAskModal('war-room-header-ask')}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0, marginTop: '4px' }}
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          Ask Ariya
        </button>
      </div>

      {/* Glass stat bar */}
      <div className="stat-bar" data-tour="war-room">
        <span className={`stat-bar-item${needsYouCount > 0 ? ' is-urgent' : ''}`}>
          <span className="num">{needsYouCount}</span> need{needsYouCount === 1 ? 's' : ''} you
        </span>
        <span className="stat-bar-sep" aria-hidden="true" />
        <span className="stat-bar-item"><span className="num">{signalVolume}</span> signals · {NARRATION_DAYS}d</span>
        <span className="stat-bar-sep" aria-hidden="true" />
        <span className="stat-bar-item">
          Pressure {pressureState === 'pressure' ? 'building' : pressureState === 'clearing' ? 'easing' : 'stable'}
        </span>
        {mostActiveName && (
          <>
            <span className="stat-bar-sep" aria-hidden="true" />
            <span className="stat-bar-item">{mostActiveName} most active</span>
          </>
        )}
        <Link to="/alerts" className="stat-bar-link">Open Alerts <ArrowRight size={11} aria-hidden="true" /></Link>
      </div>

      {/* Two-column grid: worklist spine + rail */}
      <div data-war-room-grid style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '20px', alignItems: 'flex-start' }}>

        {/* LEFT — worklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--ink-900)' }}>
              What needs you
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {([
                { value: 'importance', label: 'Importance' },
                { value: 'recency', label: 'Recency' },
              ] as const).map((opt) => {
                const on = sortMode === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSortMode(opt.value)}
                    aria-pressed={on}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--r-pill)',
                      fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: on ? 700 : 500,
                      background: on ? 'var(--navy-700)' : 'transparent',
                      color: on ? '#FFFFFF' : 'var(--ink-600)',
                      border: `1.5px solid ${on ? 'var(--navy-700)' : 'var(--cream-400)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {liveDataFailed ? (
            <div className="digest-plate inf-raised worklist-empty">
              <div className="icon-circle is-error"><AlertTriangle size={26} aria-hidden="true" /></div>
              <h3>Couldn&rsquo;t load your worklist</h3>
              <p>Check your connection and try again.</p>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={() => refetch()}>Retry</button>
            </div>
          ) : showSkeleton ? (
            <div className="digest-plate inf-raised worklist-plate" aria-busy="true" aria-label="Loading worklist">
              {[0, 1, 2].map((i) => (
                <div className="worklist-row" key={i}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="inf-sk" style={{ width: 40, height: 12, borderRadius: 6 }} />
                    <div className="inf-sk" style={{ width: 90, height: 12, borderRadius: 6 }} />
                  </div>
                  <div className="inf-sk" style={{ width: `${70 - i * 10}%`, height: 16, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ) : worklistItems.length > 0 ? (
            <div className="digest-plate inf-raised worklist-plate">
              {worklistItems.map((alert) => (
                <WorklistRow
                  key={alert.id}
                  alert={alert}
                  state={getHandlingState(alert.id)}
                  onStateChange={(s) => handleChange(alert.id, s)}
                  onInspect={() => openInspect(alert)}
                />
              ))}
            </div>
          ) : (
            <div className="digest-plate inf-raised worklist-empty">
              <div className="icon-circle"><Inbox size={26} aria-hidden="true" /></div>
              <h3>You&rsquo;re caught up</h3>
              <p>
                {watchedCompetitors.size === 0
                  ? 'Track competitors to see what needs you here.'
                  : 'Nothing needs triage right now — check back as new signals arrive.'}
              </p>
            </div>
          )}
          {hiddenCount > 0 && (
            <Link to="/alerts" style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--indigo-600)', textDecoration: 'none', alignSelf: 'flex-start' }}>
              +{hiddenCount} more waiting · Open Alerts
            </Link>
          )}
        </div>

        {/* RIGHT — rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div className="inf-raised-lg">
            <MarketWeather
              asset={assetName}
              isLive={liveDataLoaded}
              state={pressureState}
              qualifier={pressureQualifier}
              timeframe="90D"
              rows={weatherRows}
              rowsEmptyMessage={watchedCompetitors.size === 0 ? 'Track competitors to see their weekly moves here.' : 'No notable moves from your tracked competitors this week.'}
              implications={weatherImplications}
              readMoreTo="/alerts"
              compact
            />
          </div>

          <div className="digest-plate inf-raised" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--ink-900)' }}>Next up</h2>
              <Link to="/intelligence?tab=events" style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--indigo-600)', textDecoration: 'none' }}>All</Link>
            </div>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((e) => <NextUpRow key={e.id} event={e} />)
            ) : (
              <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-600)', fontStyle: 'italic' }}>
                No upcoming events found.
              </p>
            )}
          </div>
        </div>
      </div>

      <SlideOver open={!!inspecting} onClose={() => setInspecting(null)} title="Signal detail">
        {inspecting && <AlertDetail alert={inspecting} />}
      </SlideOver>
    </div>
  )
}
