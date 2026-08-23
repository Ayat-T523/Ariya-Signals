/**
 * WarRoom.tsx — Phase 4 (docs/war-room-redesign-spec.md, Direction A).
 *
 * THESIS: "What needs me right now, and what should I do about it?" replaces
 * "what changed in HAE?" — the worklist is the spine; everything else recedes
 * to a condensed rail or a link, not a scroll.
 * OWN-WORLD: Clean Clinical — one flat white stat bar (chrome) over a flat
 * bordered worklist plate (content), no neumorphic emboss; Signal Indigo
 * marks synthesized text and links only; severity reads as text + dot,
 * never a colored border.
 * STORY: David lands, sees what needs him and how much pressure is building,
 * scans up to six worklist rows, handles or inspects, and is done.
 * FIRST VIEWPORT: header -> glass stat bar -> two-column grid (worklist spine
 * left, Market weather + Next up rail right) -> nothing below the fold at
 * 1440x900 or 1280x800.
 * FORM: Direction A ("Worklist") — one dominant column, chosen over the
 * two-column "Cockpit" (dilutes the one-job focus) and railless
 * "Single-stream" (demotes orientation too far) per the spec's own comparison.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { fadeIn, REDUCED_MOTION } from '../lib/motion'
import { Link } from 'react-router-dom'
// Icons: animate-ui's Lucide-sourced, motion-wrapped set where available
// (critique 2026-07-28 -- "for all icons, use animate UI"), plain lucide-react
// for the handful animate-ui's registry doesn't carry (Circle, PauseCircle,
// Inbox, AlertTriangle, Bookmark, BookmarkCheck -- confirmed absent via
// registry.json, same check as NavPanel.tsx).
import { Circle, PauseCircle, Inbox, AlertTriangle, Bookmark, BookmarkCheck } from 'lucide-react'
import type { NavIcon } from '../components/animate-ui/icons/types'
import { ArrowRight } from '../components/animate-ui/icons/arrow-right'
import { Plus } from '../components/animate-ui/icons/plus'
import { CircleCheckBig as CheckCircle2 } from '../components/animate-ui/icons/circle-check-big'
import { CircleX as XCircle } from '../components/animate-ui/icons/circle-x'
import { ChevronUp } from '../components/animate-ui/icons/chevron-up'
import { ChevronDown } from '../components/animate-ui/icons/chevron-down'
import { ChevronLeft } from '../components/animate-ui/icons/chevron-left'
import { ChevronRight } from '../components/animate-ui/icons/chevron-right'
import { ExternalLink } from '../components/animate-ui/icons/external-link'
import { MessageSquareText } from '../components/animate-ui/icons/message-square-text'
import { Sparkles } from '../components/animate-ui/icons/sparkles'
import { useApp, useConfig } from '../context/AppContext'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import SlideOver from '../components/ui/SlideOver'
import { AlertDetail } from '../components/inform/AlertDetail'
import { MarketWeather } from '../components/inform/MarketWeather'
import { SeverityDot, severityLabel, severityText, FLAT_CARD_STYLE } from '../components/inform/primitives'
import type { WeatherRow, WeatherState } from '../components/inform/types'
import { Accordion, AccordionItem } from '../components/shadcn/ui/accordion'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import { Tabs, TabsList, TabsTrigger } from '../components/animate-ui/components/radix/tabs'
import { Button } from '../components/shadcn/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/animate-ui/components/radix/tooltip'
import { CountingNumber } from '../components/animate-ui/primitives/texts/counting-number'
import { Shine } from '../components/animate-ui/primitives/effects/shine'
import { usePageLoad } from '../hooks/usePageLoad'
import { competitorsData, eventsData, userData } from '../data/kalvista'
import { activeLandscapeSignalScope } from '../lib/activeLandscape'
import { fetchLandscapeEvidence, type LandscapeEvidenceItem } from '../lib/api/landscapeEvidence'
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
import { summarizeSeverity, type Lexicon } from '../lib/signalSeverity'
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
// icon: NavIcon (not `typeof Circle`) — Circle/PauseCircle are plain lucide-react
// icons (ForwardRefExoticComponent), while CheckCircle2/XCircle below are restored
// Animate UI icons (plain function components under React 19's ref-as-prop model).
// The two are typed incompatibly by their own upstream libraries; NavIcon is the
// same union already used for exactly this mix in NavPanel.tsx.
const STATE_META: Record<HandlingState, { label: string; icon: NavIcon }> = {
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`worklist-handle-trigger${current === 'in_progress' ? ' is-in-progress' : ''}`}
        aria-haspopup="menu" aria-expanded={open}
        title="Update triage status"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon size={13} aria-hidden="true" />
        {meta.label}
        <ChevronDown size={12} aria-hidden="true" animateOnHover />
      </Button>
      {open && (
        <motion.div
          className="menu-glass is-light is-compact worklist-handle-menu" role="menu"
          variants={fadeIn} initial="initial" animate="animate"
        >
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
        </motion.div>
      )}
    </div>
  )
}

// ── Worklist row ────────────────────────────────────────────────────────────
// Collapsed: severity + competitor + time + headline (never truncated) --
// the scan layer. Expanded: a decorated "situation" card carrying
// whyItMatters + suggestedAction together, the synthesis layer, on shadcn's
// Collapsible (critique 2026-07-28). Only rows with real synthesized content
// get the expand affordance at all -- an empty decorated card would be worse
// than no card. Given its own visual identity (indigo tint, sparkle header)
// per that note, distinct from the plain white Market Weather / Next Up
// cards -- but no colored border-left (craft-floor's side-tab ban), so the
// distinction comes from fill + iconography, not an accent bar.
function WorklistRow({ alert, state, resolving, rowRef, onStateChange, onInspect }: {
  alert: MappedAlert
  state: HandlingState
  resolving: boolean
  rowRef: (el: HTMLDivElement | null) => void
  onStateChange: (state: HandlingState) => void
  onInspect: () => void
}) {
  const competitor = competitorById(alert.competitorId)
  const hasSituation = Boolean(alert.whyItMatters || alert.suggestedAction)

  return (
    <AccordionItem value={alert.id} className="worklist-accordion-item border-b-0">
      <div
        ref={rowRef}
        tabIndex={0}
        className={`worklist-row${resolving ? ' is-resolving' : ''}`}
      >
        <div className="worklist-row-top">
          <span className="worklist-row-sev" style={{ color: severityText(alert.severity) }}><SeverityDot sev={alert.severity} /> {severityLabel(alert.severity)}</span>
          <div className="worklist-row-competitor" title={competitor?.name ?? alert.competitorId}>
            <CompetitorBadge name={competitor?.name ?? alert.competitorId} id={alert.competitorId} size={18} />
            <span className="name">{competitor?.name ?? alert.competitorId}</span>
          </div>
          <span className="worklist-row-time">{relTimeShort(alert.timestamp)}</span>
          {resolving ? (
            <span className="worklist-row-resolved" aria-live="polite"><CheckCircle2 size={14} aria-hidden="true" animate="path" /> Updated</span>
          ) : (
            <>
              <HandleMenu current={state} onChange={onStateChange} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Inspect" onClick={onInspect}>
                    <ExternalLink size={14} aria-hidden="true" animateOnHover />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Inspect</TooltipContent>
              </Tooltip>
              {hasSituation && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AccordionPrimitive.Trigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="worklist-situation-trigger"
                        aria-label="Why this needs you"
                      >
                        <Sparkles size={14} aria-hidden="true" animateOnHover />
                      </Button>
                    </AccordionPrimitive.Trigger>
                  </TooltipTrigger>
                  <TooltipContent>Why this needs you</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>

        <p className="worklist-row-headline">{decodeEntities(alert.headline)}</p>

        {hasSituation && (
          <AccordionPrimitive.Content className="worklist-situation-wrap">
            <div className="worklist-situation-card">
              <div className="worklist-situation-hd">
                <Sparkles size={12} aria-hidden="true" animate="path" />
                Why this needs you
              </div>
              {alert.whyItMatters && <p className="worklist-situation-why">{alert.whyItMatters}</p>}
              {alert.suggestedAction && (
                <p className="worklist-situation-action">
                  <MessageSquareText size={13} aria-hidden="true" animateOnHover />
                  <span>{alert.suggestedAction}</span>
                </p>
              )}
            </div>
          </AccordionPrimitive.Content>
        )}
      </div>
    </AccordionItem>
  )
}

// ── Next up carousel (critique 2026-07-28: widened from a narrow rail list to
// a full-width horizontal scroller so Kokonut UI's Carousel Cards mechanic --
// scroll-snap row + chevron buttons -- actually has room to show 3+ cards at
// once; a single-card-peek carousel in a 360px rail wasn't worth the chevrons
// it'd need for just 2 events. Cards stay compact (date + title + countdown,
// no imagery) to keep the strip inside the page's no-scroll budget. ─────────
function NextUpCard({ event }: { event: NextUpEvent }) {
  const { day, month } = dayMonthParts(event.date)
  return (
    <Link to={`/intelligence?tab=events&event=${event.id}`} className="next-up-card">
      <div className="next-up-date">
        <span className="day">{day}</span>
        <span className="month">{month}</span>
      </div>
      <div className="next-up-card-body">
        <span className="next-up-title">{event.title}</span>
        <span className="next-up-countdown">{daysUntilLabel(event.date)}</span>
      </div>
    </Link>
  )
}

function NextUpCarousel({ events }: { events: NextUpEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  function scrollBy(dir: 1 | -1) { scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' }) }
  return (
    <div className="digest-plate" style={{ ...FLAT_CARD_STYLE, padding: '5px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--neutral-900)' }}>Next up</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Button type="button" variant="outline" size="icon-xs" aria-label="Scroll left" onClick={() => scrollBy(-1)}>
            <ChevronLeft size={13} aria-hidden="true" animateOnHover />
          </Button>
          <Button type="button" variant="outline" size="icon-xs" aria-label="Scroll right" onClick={() => scrollBy(1)}>
            <ChevronRight size={13} aria-hidden="true" animateOnHover />
          </Button>
          <Link to="/intelligence?tab=events" style={{ marginLeft: '6px', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--indigo-600)', textDecoration: 'none' }}>All</Link>
        </div>
      </div>
      {events.length > 0 ? (
        <div ref={scrollRef} className="next-up-scroller">
          {events.map((e) => <NextUpCard key={e.id} event={e} />)}
        </div>
      ) : (
        <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--neutral-600)', fontStyle: 'italic' }}>
          No upcoming events found.
        </p>
      )}
    </div>
  )
}
// ── Recent Evidence — ingestion -> persistence -> landscape bridge (V1) ──────
// Deliberately labeled "Recent Evidence", never "Signals": every item here is
// a durably-recorded, source-backed observation from real discovery ingestion
// -- no change-detection, no significance judgment, no narrative has been
// derived from it. See landscapeEvidence.ts's own module docstring.
function RecentEvidenceCard({ items, loading }: { items: LandscapeEvidenceItem[]; loading: boolean }) {
  return (
    <div className="digest-plate" style={{ ...FLAT_CARD_STYLE, padding: '10px 16px' }}>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--neutral-900)' }}>
        Recent evidence
      </h2>
      {loading ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--neutral-600)' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--neutral-600)', fontStyle: 'italic' }}>
          No persisted evidence yet for your tracked companies in this landscape — evidence accumulates as discovery runs.
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.slice(0, 6).map((item) => (
            <li key={item.id} style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--neutral-800)' }}>
              <a href={item.sourceLocator} target="_blank" rel="noreferrer" style={{ color: 'var(--indigo-600)', textDecoration: 'none', fontWeight: 600 }}>
                {item.companyName ?? item.assetName ?? 'Unknown source'}
              </a>
              {item.assetName && item.companyName && <span style={{ color: 'var(--neutral-600)' }}> · {item.assetName}</span>}
              <span style={{ color: 'var(--neutral-600)' }}>
                {' — '}{item.sourceType ?? 'source'}
                {item.sourcePublishedDate ? ` · published ${item.sourcePublishedDate}` : ''}
                {' · last confirmed '}{item.lastObservedAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WarRoom() {
  const {
    openAskModal, watchedCompetitors, trackedCompetitors, handlingStates, getHandlingState, setHandlingState,
    savedAlerts, toggleSavedAlert,
  } = useApp()
  const { assetName, indication, lexiconInns, lexiconTaTerms } = useConfig()
  const lexicon = useMemo(() => ({ inns: lexiconInns, ta_terms: lexiconTaTerms }), [lexiconInns, lexiconTaTerms])
  // SETUP PROPAGATION: once a real completed landscape exists, it is
  // authoritative over the legacy HAE default -- see activeLandscape.ts.
  const { hasActiveLandscape, legacyIds: activeLandscapeIds } = useMemo(
    () => activeLandscapeSignalScope(trackedCompetitors, competitorsData),
    [trackedCompetitors],
  )
  const effectiveCompetitorIds = hasActiveLandscape ? activeLandscapeIds : watchedCompetitors

  // INGESTION -> PERSISTENCE -> LANDSCAPE BRIDGE (V1): canonical company ids
  // only -- a manually-added competitor's companyId is a locally-generated
  // id with no durable evidence to match, so it is excluded here rather than
  // sent to a query that could never honestly return anything for it.
  const discoveredCompanyIds = useMemo(
    () => trackedCompetitors.filter((c) => c.source === 'discovered').map((c) => c.companyId),
    [trackedCompetitors],
  )
  const [evidenceItems, setEvidenceItems] = useState<LandscapeEvidenceItem[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  useEffect(() => {
    if (discoveredCompanyIds.length === 0) { setEvidenceItems([]); return }
    let cancelled = false
    setEvidenceLoading(true)
    fetchLandscapeEvidence(discoveredCompanyIds, indication)
      .then((items) => { if (!cancelled) setEvidenceItems(items) })
      .catch(() => { if (!cancelled) setEvidenceItems([]) })
      .finally(() => { if (!cancelled) setEvidenceLoading(false) })
    return () => { cancelled = true }
  }, [discoveredCompanyIds, indication])

  const loaded = usePageLoad('war-room')
  const [sortMode, setSortMode] = useState<'importance' | 'recency'>('importance')
  const [inspecting, setInspecting] = useState<MappedAlert | null>(null)
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(() => new Set())
  // Keyboard triage (4.3): the roving-selected row when the drawer is closed.
  // Synced with `inspecting` when the drawer opens/navigates so arrow keys mean
  // the same thing whether the drawer is open or not.
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [weatherWindow, setWeatherWindow] = useState<7 | 30 | 90>(90)

  const watchedIds = Array.from(effectiveCompetitorIds).sort()
  const filterIds = watchedIds.length > 0 ? watchedIds : undefined

  const { data: liveData, isSuccess: liveDataLoaded, isError: liveDataFailed, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['war-room-live', watchedIds],
    queryFn: () => Promise.all([
      getRecentSignals(NARRATION_DAYS, filterIds),
      getRegulatoryCalendar(),
      getMarketImplications(NARRATION_DAYS),
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
  const relevantSignals = readableSignals.filter((s) => effectiveCompetitorIds.has(s.competitor_id ?? ''))

  // Alert objects + severity come from the same mapSignal() pipeline the
  // Alerts page and its drawer use (signalMapping.ts) — so a row's severity
  // badge always matches what its own Inspect drawer shows. As of Round 2 R3,
  // mapSignal itself resolves severity via signalSeverity.ts's
  // resolveSeverity() (ai_severity first, computeSeverity() fallback) — the
  // same resolver Market Weather's summarizeSeverity() now calls internally,
  // so the two engines this comment used to describe as separate are one.
  const allAlerts = useMemo(() => mapSignals(relevantSignals, lexicon), [relevantSignals, lexicon])

  // "Needs you" = not yet resolved (critique 2026-07-27, P0 fix). Originally
  // this also required needs_triage-or-high-severity, which meant starting
  // work on a non-high item ("in_progress" — literally "I'm on this")
  // instantly dropped it from both the worklist and the hero count: a user
  // who got interrupted mid-task would find no trace of it tomorrow unless
  // it happened to be high-severity. With only four states, "not resolved"
  // already means needs_triage or in_progress, so severity no longer gates
  // membership at all — only handled/dismissed ever remove an item.
  function isNeedsYou(a: MappedAlert): boolean {
    const hs = handlingStates[a.id] ?? 'needs_triage'
    return hs !== 'handled' && hs !== 'dismissed'
  }
  const needsYouAlerts = allAlerts.filter(isNeedsYou)

  // De-duplicate near-identical signals before filling the worklist's scarce
  // 6-slot budget (critique 2026-07-27, P1): the same competitor filing
  // (e.g. one 6-K's several exhibits — CEO letter, incoming-CEO letter,
  // meeting notice) often lands as several company_signals rows sharing a
  // competitor + date + type. Collapsing those to the single highest-severity
  // representative is a worklist-display decision, not a data fix — nothing
  // is deleted, Alerts still shows every row.
  const dedupedNeedsYou = (() => {
    const bestByKey = new Map<string, MappedAlert>()
    const order: string[] = []
    for (const a of needsYouAlerts) {
      const key = `${a.competitorId}|${a.timestamp.slice(0, 10)}|${a.type}`
      const existing = bestByKey.get(key)
      if (!existing) { bestByKey.set(key, a); order.push(key); continue }
      if ((SEVERITY_RANK[a.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) bestByKey.set(key, a)
    }
    return order.map((key) => bestByKey.get(key)!)
  })()
  // The hero count reflects the same deduped set the worklist draws from —
  // otherwise "N need you" could promise more distinct items than the
  // worklist could ever actually show, repeating the P0 trust problem at
  // one remove.
  const needsYouCount = dedupedNeedsYou.length

  function sortComparator(a: MappedAlert, b: MappedAlert): number {
    if (sortMode === 'importance') {
      const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
      if (sevDiff !== 0) return sevDiff
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  }
  const sortedNeedsYou = [...dedupedNeedsYou].sort(sortComparator)

  // Cap any single competitor at 2 of the worklist's 6 slots (feedback
  // 2026-07-28): a pure severity/recency sort let one competitor with
  // several high-severity items crowd out every other tracked competitor
  // entirely -- "Takeda most active" in the stat bar with zero Takeda rows
  // visible below it undermined trust in the list. Two passes over the
  // already-sorted list preserve rank within each: fill up to the cap per
  // competitor first, then backfill remaining slots from the overflow
  // (ignoring the cap) so the list never shows fewer than 6 rows just
  // because too few competitors have activity. Final re-sort restores the
  // chosen display order across the now-diverse selection.
  const WORKLIST_SIZE = 6
  const PER_COMPETITOR_CAP = 2
  const worklistItems = (() => {
    const capped: MappedAlert[] = []
    const overflow: MappedAlert[] = []
    const countByCompetitor = new Map<string, number>()
    for (const a of sortedNeedsYou) {
      const count = countByCompetitor.get(a.competitorId) ?? 0
      if (count < PER_COMPETITOR_CAP) {
        capped.push(a)
        countByCompetitor.set(a.competitorId, count + 1)
      } else {
        overflow.push(a)
      }
    }
    return [...capped, ...overflow].slice(0, WORKLIST_SIZE).sort(sortComparator)
  })()
  const hiddenCount = Math.max(0, needsYouCount - worklistItems.length)

  // Most-active tracked competitor — highest relevant-signal count in the window.
  const countsByCompetitor = new Map<string, number>()
  for (const s of relevantSignals) countsByCompetitor.set(s.competitor_id, (countsByCompetitor.get(s.competitor_id) ?? 0) + 1)
  const mostActive = [...countsByCompetitor.entries()].sort((a, b) => b[1] - a[1])[0]
  const mostActiveName = mostActive ? competitorById(mostActive[0])?.name ?? mostActive[0] : null

  const signalVolume = relevantSignals.length // total in the window; read/unread state lives on the Alerts page, not here

  // Market weather — windowed to whatever the card's own 7D/30D/90D toggle
  // selects (critique 2026-07-28), not hardcoded to the page's NARRATION_DAYS.
  // Both signals and implications are fetched once at the max (90d) and
  // filtered client-side per window, same pattern the rest of the page
  // already uses for relevantSignals -- avoids a refetch on every toggle.
  const weatherCutoffDate = new Date(); weatherCutoffDate.setDate(weatherCutoffDate.getDate() - weatherWindow)
  const weatherCutoff = weatherCutoffDate.toISOString().slice(0, 10)

  const windowedMarketSignals = recentLiveSignals.filter((s) => s.date !== null && s.date >= weatherCutoff)
  const weatherSeverity = summarizeSeverity(windowedMarketSignals, lexicon, new Date())
  const pressureState: WeatherState =
    weatherSeverity.high >= 2 ? 'pressure'
    : (weatherSeverity.high >= 1 || weatherSeverity.medium >= 3) ? 'stable'
    : 'clearing'
  const pressureQualifier = `over the last ${weatherWindow} days`

  const windowedRelevantSignals = relevantSignals.filter((s) => s.date !== null && s.date >= weatherCutoff)
  const windowedSignalsByCompetitor = new Map<string, DbRecentSignal[]>()
  for (const s of windowedRelevantSignals) {
    const arr = windowedSignalsByCompetitor.get(s.competitor_id) ?? []
    arr.push(s)
    windowedSignalsByCompetitor.set(s.competitor_id, arr)
  }
  const weatherRows: WeatherRow[] = [...windowedSignalsByCompetitor.entries()]
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
        summary: top ? decodeEntities(cleanSignalText(top)) : `New activity in the last ${weatherWindow} days.`,
      }
    })

  const windowedImplications = marketImplications.filter((imp) => imp.created_at >= weatherCutoffDate.toISOString())
  const weatherImplications = windowedImplications.slice(0, 3).map((imp) => decodeEntities(imp.content))

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
    .slice(0, 8) // horizontally scrollable now (critique 2026-07-28), not vertically listed -- no longer height-constrained the way the old rail list was

  function openInspect(alert: MappedAlert) { setInspecting(alert); setFocusedId(alert.id) }

  // Drawer prev/next (4.3) -- walks the same worklistItems order the list
  // itself uses, so "next" always means what the visible list currently
  // shows next, under whichever sort mode is active.
  const drawerIndex = inspecting ? worklistItems.findIndex((a) => a.id === inspecting.id) : -1
  function goToAdjacent(delta: 1 | -1) {
    if (drawerIndex === -1) return
    const next = worklistItems[drawerIndex + delta]
    if (next) { setInspecting(next); setFocusedId(next.id) }
  }

  // Keyboard triage (4.3): E steps a signal forward one triage state --
  // needs_triage -> in_progress -> handled. Dismiss stays menu-only (an
  // exit, not a step in the normal advance sequence) so a stray keypress
  // can't dismiss something by accident.
  const ADVANCE_SEQUENCE: Record<HandlingState, HandlingState> = {
    needs_triage: 'in_progress', in_progress: 'handled', handled: 'handled', dismissed: 'dismissed',
  }
  function advanceState(id: string) {
    const current = getHandlingState(id)
    const next = ADVANCE_SEQUENCE[current]
    if (next !== current) handleChange(id, next)
  }

  // Resolving (handled/dismissed) removes a row from the worklist -- an
  // instant vanish reads as data loss on a page whose whole premise is a
  // trustworthy count. Deliberately NOT using AnimatePresence/exit
  // animations for this: that exact approach (Phase 3.1, AlertGroups) let
  // the rendered row outlive the data it was computed from and the group
  // count and visible rows fell out of sync. Instead: hold the real state
  // write for one short beat, during which the row (still driven by the
  // OLD, still-accurate handling_state) naturally stays in the list with a
  // "resolving" visual — count and rows can never disagree because nothing
  // is rendered from stale data at any point.
  function handleChange(id: string, state: HandlingState) {
    if (state !== 'handled' && state !== 'dismissed') { setHandlingState(id, state); return }
    setResolvingIds((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setHandlingState(id, state)
      setResolvingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }, REDUCED_MOTION ? 0 : 260)
  }

  // Keyboard triage (4.3), mirroring AlertsPage's established scheme so the
  // same muscle memory (↑/↓ + E + S) works on both pages:
  //   - Drawer open: ↑/↓ walk prev/next through the worklist, E advances the
  //     open item's triage state, S toggles saved.
  //   - Drawer closed: ↑/↓ move a roving selection through the worklist rows,
  //     Enter opens Inspect for the selected row, E/S act on it directly --
  //     full triage without ever touching the mouse.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (target.closest('.menu-glass')) return // let an open Handle menu own its own keys

      if (inspecting) {
        if (e.key === 'ArrowUp')   { e.preventDefault(); goToAdjacent(-1) }
        if (e.key === 'ArrowDown') { e.preventDefault(); goToAdjacent(1) }
        if (e.key === 'e' || e.key === 'E') { e.preventDefault(); advanceState(inspecting.id) }
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); toggleSavedAlert(inspecting.id) }
        return
      }

      if (worklistItems.length === 0) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = focusedId ? worklistItems.findIndex((a) => a.id === focusedId) : -1
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(idx + 1, worklistItems.length - 1)
          : Math.max(idx - 1, 0)
        const next = worklistItems[idx === -1 && e.key === 'ArrowUp' ? 0 : nextIdx]
        if (next) { setFocusedId(next.id); rowRefs.current.get(next.id)?.focus() }
      }
      if (e.key === 'Enter' && focusedId) {
        e.preventDefault()
        const alert = worklistItems.find((a) => a.id === focusedId)
        if (alert) openInspect(alert)
      }
      if ((e.key === 'e' || e.key === 'E') && focusedId) { e.preventDefault(); advanceState(focusedId) }
      if ((e.key === 's' || e.key === 'S') && focusedId) { e.preventDefault(); toggleSavedAlert(focusedId) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inspecting, focusedId, worklistItems, drawerIndex])

  const showSkeleton = !loaded || !liveDataLoaded

  return (
    <div data-page-pad className="war-room-page inform-app-bg">

      {/* Header */}
      <div className="war-room-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--neutral-600)' }}>
            {headerTimestamp(lastRefreshedAt)}
          </p>
          <h1 className="war-room-title" style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--neutral-900)', lineHeight: 1.25 }}>
            {greeting()}, {userData.user.name}.{' '}
            <span style={{ color: 'var(--neutral-600)', fontWeight: 500 }}>Here&rsquo;s what needs you in {indication}.</span>
          </h1>
        </div>
        <Shine asChild enableOnHover color="#ffffff" opacity={0.45} duration={700}>
          <Button
            type="button"
            onClick={() => openAskModal('war-room-header-ask')}
            size="sm"
            style={{ flexShrink: 0, marginTop: '4px' }}
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" animateOnHover />
            Ask InForm
          </Button>
        </Shine>
      </div>

      {/* Glass stat bar */}
      <div className="stat-bar" data-tour="war-room">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`stat-bar-item${needsYouCount > 0 ? ' is-urgent' : ''}`}>
              <span className="num"><CountingNumber number={needsYouCount} /></span> need{needsYouCount === 1 ? 's' : ''} you
            </span>
          </TooltipTrigger>
          <TooltipContent>Signals not yet marked handled or dismissed — includes anything still in progress, not just untouched items.</TooltipContent>
        </Tooltip>
        <span className="stat-bar-sep" aria-hidden="true" />
        <span className="stat-bar-item"><span className="num"><CountingNumber number={signalVolume} /></span> signals · {NARRATION_DAYS}d</span>
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
        <Link to="/alerts" className="stat-bar-link">Open Alerts <ArrowRight size={11} aria-hidden="true" animateOnHover /></Link>
      </div>

      {/* Bento grid: worklist + weather side by side, Next up widened to a
          full-width carousel row underneath (critique 2026-07-28) — needs
          the width to show 3+ event cards, which a 360px rail column can't. */}
      <div
        data-war-room-grid
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gridTemplateRows: 'auto auto',
          gridTemplateAreas: '"worklist weather" "nextup nextup"',
          gap: '10px',
          alignItems: 'start',
        }}
      >

        {/* WORKLIST tile — dominant */}
        <div style={{ gridArea: 'worklist', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--neutral-900)' }}>
              What needs your attention
            </h2>
            <Tabs value={sortMode} onValueChange={(v) => setSortMode(v as 'importance' | 'recency')}>
              <TabsList aria-label="Sort worklist by" style={{ height: '26px', padding: '2px' }}>
                <TabsTrigger value="importance" style={{ fontSize: '12px', padding: '0 10px' }}>Importance</TabsTrigger>
                <TabsTrigger value="recency" style={{ fontSize: '12px', padding: '0 10px' }}>Recency</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {liveDataFailed ? (
            <div className="digest-plate worklist-empty" style={FLAT_CARD_STYLE}>
              <div className="icon-circle is-error"><AlertTriangle size={26} aria-hidden="true" /></div>
              <h3>Couldn&rsquo;t load your worklist</h3>
              <p>Check your connection and try again.</p>
              <Button type="button" size="sm" style={{ marginTop: '12px' }} onClick={() => refetch()}>Retry</Button>
            </div>
          ) : showSkeleton ? (
            <div className="digest-plate worklist-plate" style={FLAT_CARD_STYLE} aria-busy="true" aria-label="Loading worklist">
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
            <div className="digest-plate worklist-plate" style={FLAT_CARD_STYLE}>
              <Accordion type="multiple">
                {worklistItems.map((alert) => (
                  <WorklistRow
                    key={alert.id}
                    alert={alert}
                    state={getHandlingState(alert.id)}
                    resolving={resolvingIds.has(alert.id)}
                    rowRef={(el) => { if (el) rowRefs.current.set(alert.id, el); else rowRefs.current.delete(alert.id) }}
                    onStateChange={(s) => handleChange(alert.id, s)}
                    onInspect={() => openInspect(alert)}
                  />
                ))}
              </Accordion>
            </div>
          ) : (
            <div className="digest-plate worklist-empty" style={FLAT_CARD_STYLE}>
              <div className="icon-circle"><Inbox size={26} aria-hidden="true" /></div>
              <h3>You&rsquo;re caught up</h3>
              <p>
                {effectiveCompetitorIds.size === 0
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

        {/* WEATHER tile */}
        <div className="inf-raised-lg" style={{ gridArea: 'weather', minWidth: 0 }}>
          <MarketWeather
            asset={assetName}
            isLive={liveDataLoaded}
            state={pressureState}
            qualifier={pressureQualifier}
            timeframe={(`${weatherWindow}D` as '7D' | '30D' | '90D')}
            onTimeframeChange={(tf) => setWeatherWindow(Number(tf.slice(0, -1)) as 7 | 30 | 90)}
            rows={weatherRows}
            rowsEmptyMessage={effectiveCompetitorIds.size === 0 ? 'Track competitors to see their weekly moves here.' : 'No notable moves from your tracked competitors this week.'}
            implications={weatherImplications}
            readMoreTo="/alerts"
            compact
          />
        </div>

        {/* NEXT UP — full-width horizontal carousel, spans both columns */}
        <div style={{ gridArea: 'nextup', minWidth: 0 }}>
          <NextUpCarousel events={upcomingEvents} />
        </div>
      </div>

      {discoveredCompanyIds.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <RecentEvidenceCard items={evidenceItems} loading={evidenceLoading} />
        </div>
      )}

      <SlideOver open={!!inspecting} onClose={() => setInspecting(null)} title="Signal detail">
        {inspecting && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <Button
                type="button" variant="ghost" size="icon-xs" title="Previous (↑)" aria-label="Previous signal"
                disabled={drawerIndex <= 0}
                onClick={() => goToAdjacent(-1)}
              >
                <ChevronUp size={14} aria-hidden="true" animateOnHover />
              </Button>
              <Button
                type="button" variant="ghost" size="icon-xs" title="Next (↓)" aria-label="Next signal"
                disabled={drawerIndex === -1 || drawerIndex >= worklistItems.length - 1}
                onClick={() => goToAdjacent(1)}
              >
                <ChevronDown size={14} aria-hidden="true" animateOnHover />
              </Button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-caption)', color: 'var(--neutral-600)' }}>
                {drawerIndex + 1} of {worklistItems.length}
              </span>
            </div>
            <AlertDetail alert={inspecting} />
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                type="button" variant="secondary" size="sm"
                onClick={() => toggleSavedAlert(inspecting.id)}
              >
                {savedAlerts.has(inspecting.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                {savedAlerts.has(inspecting.id) ? 'Saved' : 'Save'}
              </Button>
              <HandleMenu current={getHandlingState(inspecting.id)} onChange={(s) => handleChange(inspecting.id, s)} />
            </div>
          </>
        )}
      </SlideOver>
    </div>
  )
}
