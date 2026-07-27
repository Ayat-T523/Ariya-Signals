/**
 * AlertsPage.tsx — InForm Alerts inbox (Phase 3.1).
 *
 * THESIS: an inbox you triage, not a feed you scroll — dense grouped rows,
 * one primary action (Read more → drawer), evidence one click away, never
 * dumped inline. Refuses the tall-card-per-alert template this page used to
 * ship (73 scrollable cards is an archive, not a triage surface).
 * OWN-WORLD: cream neumorphic rows grouped by competitor (digest-plate),
 * glass FeedFilterBar chrome, a glass-chrome/cream-content SlideOver drawer.
 * Severity is the only per-row color signal (SeverityDot); Signal Indigo is
 * reserved for AI-synthesized content (why-it-matters, chip counts, links).
 * STORY: David opens Alerts already scoped to what needs him (unread +
 * medium/high), scans grouped rows in seconds, opens one for full context,
 * decides, moves on.
 * FIRST VIEWPORT: stat line ("Showing N of M") → FeedFilterBar (search,
 * tabs, competitor/type facets, sort) → grouped rows. Primary action (Read
 * more) sits rightmost on every row.
 * FORM: whole-surface build inside the established InForm world (DESIGN.md
 * already committed) — content and layout precisely specified by
 * docs/alerts-ai-synthesis-spec.md §3, not an open concept choice.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bookmark, BookmarkCheck, Check, ChevronDown, ChevronUp, ExternalLink, Inbox, CheckCircle2, FilterX, AlertTriangle, Database } from 'lucide-react'
import { analytics } from '../lib/analytics'
import { useApp, useConfig } from '../context/AppContext'
import { usePageLoad } from '../hooks/usePageLoad'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import FilterDropdown from '../components/ui/FilterDropdown'
import SlideOver from '../components/ui/SlideOver'
import { SeverityDot, severityLabel } from '../components/inform/primitives'
import { FeedFilterBar, type FeedTab, type SortMode, type AppliedChip } from '../components/inform/FeedFilterBar'
import { AlertDetail } from '../components/inform/AlertDetail'
import competitorsData from '../data/competitors.json'
import { getRecentSignals } from '../lib/db'
import { mapSignals } from '../lib/signalMapping'
import type { MappedAlert } from '../lib/signalMapping'
import { Link } from 'react-router-dom'

// ── Type labels (sentence case; no per-type color — severity is the only
//    color-coded signal on a row, per DESIGN.md's one-accent discipline) ──
const TYPE_LABEL: Record<string, string> = {
  'trial-update':    'Trial update',
  'exec-move':       'Exec move',
  'publication':     'Publication',
  'regulatory':      'Regulatory',
  'earnings':        'Earnings',
  'deal':            'Deal',
  'conference':      'Conference',
  'label-change':    'Label change',
  'field-signal':    'Field signal',
  'strategic-shift': 'Strategic shift',
}
function typeLabel(t: string) {
  return TYPE_LABEL[t] ?? (t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Signal')
}

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

// Per alerts-ai-synthesis-spec.md §3.2/§5: filter/sort choice persists across
// reloads (search text does not -- that's a per-session query, not a saved
// scope, same convention most inbox tools use).
const FILTERS_KEY = 'pharma-inc-ciwarroom-alerts-filters'
interface PersistedFilters {
  tab: FeedTab
  sortMode: SortMode
  competitorFilter: string[]
  typeFilter: string[]
}
function loadPersistedFilters(): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      tab: parsed.tab ?? 'Unread',
      sortMode: parsed.sortMode ?? 'importance',
      competitorFilter: Array.isArray(parsed.competitorFilter) ? parsed.competitorFilter : [],
      typeFilter: Array.isArray(parsed.typeFilter) ? parsed.typeFilter : [],
    }
  } catch { return null }
}

function competitorName(id: string) {
  return (competitorsData as Array<{ id: string; name: string }>).find((c) => c.id === id)?.name ?? id
}

// Compact recency for the mono column — real clock, not the app-wide
// DEMO.snapshotDate frozen date that src/utils/formatDate.ts uses (that
// mismatch is a pre-existing bug outside this page's scope; this row needs
// a short, correct value regardless).
function relTimeShort(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const diffH  = Math.round(diffMs / 3_600_000)
  if (diffH < 1)  return 'now'
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `${diffD}d`
  return `${Math.round(diffD / 30)}mo`
}

// ── Row ────────────────────────────────────────────────────────────────────
// Not role="button" on the wrapper: it contains three real <button> children
// (Read more/Save/Mark read), and a button-in-button is invalid ARIA that
// breaks keyboard and screen-reader navigation. The onClick below is a mouse
// convenience only; "Read more" is the one real keyboard-reachable entry
// point into the drawer, so nothing is lost by not double-exposing the row.
function AlertRow({ alert, isRead, isSaved, onOpen, onToggleRead, onToggleSave }: {
  alert: MappedAlert
  isRead: boolean
  isSaved: boolean
  onOpen: () => void
  onToggleRead: (e: React.MouseEvent) => void
  onToggleSave: (e: React.MouseEvent) => void
}) {
  return (
    <div className={`alert-row${isRead ? '' : ' is-unread'}`} onClick={onOpen}>
      <SeverityDot sev={alert.severity} />
      <span className="alert-row-sev">{severityLabel(alert.severity)}</span>
      <span className="alert-row-headline">{alert.headline}</span>
      <span className="alert-row-meta">
      <span className="alert-row-type">{typeLabel(alert.type)}</span>
      <span className="alert-row-time">{relTimeShort(alert.timestamp)}</span>
      <span className="alert-row-actions">
        <button
          type="button" className="alert-row-action" title="Read more" aria-label="Read more"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
        >
          <ExternalLink size={14} aria-hidden="true" />
        </button>
        <button
          type="button" className={`alert-row-action${isSaved ? ' is-active' : ''}`}
          title={isSaved ? 'Unsave' : 'Save'} aria-label={isSaved ? 'Unsave' : 'Save'} aria-pressed={isSaved}
          onClick={onToggleSave}
        >
          {isSaved ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
        </button>
        <button
          type="button" className={`alert-row-action${isRead ? ' is-active' : ''}`}
          title={isRead ? 'Mark unread' : 'Mark read'} aria-label={isRead ? 'Mark unread' : 'Mark read'} aria-pressed={isRead}
          onClick={onToggleRead}
        >
          <Check size={14} aria-hidden="true" />
        </button>
      </span>
      </span>
    </div>
  )
}

// Per alerts-ai-synthesis-spec.md §3.3: each group shows its top 3 (by the
// page's current sort) plus a "See all N" expander, not an unbounded list --
// otherwise a broad filter regrows the same unscannable-list problem this
// redesign exists to fix.
const GROUP_CAP = 3

// ── Grouped-by-competitor plate ──────────────────────────────────────────────
function AlertGroups({ alerts, readAlerts, savedAlerts, onOpen, onToggleRead, onToggleSave }: {
  alerts: MappedAlert[]
  readAlerts: Set<string>
  savedAlerts: Set<string>
  onOpen: (a: MappedAlert) => void
  onToggleRead: (id: string) => void
  onToggleSave: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const order: string[] = []
  for (const a of alerts) if (!order.includes(a.competitorId)) order.push(a.competitorId)
  const groups = order.map((id) => ({
    id, name: competitorName(id),
    items: alerts.filter((a) => a.competitorId === id),
  }))

  return (
    <div className="digest-plate inf-raised">
      {groups.map((g) => {
        const worstSev = g.items.reduce((worst, a) => (SEVERITY_RANK[a.severity] > SEVERITY_RANK[worst] ? a.severity : worst), 'low')
        const isExpanded = expanded.has(g.id)
        const visibleItems = isExpanded ? g.items : g.items.slice(0, GROUP_CAP)
        const hiddenCount = g.items.length - visibleItems.length
        return (
          <div className="digest-group" key={g.id}>
            <div className="digest-group-hd">
              <CompetitorBadge name={g.name} id={g.id} size={24} />
              <span className="name">{g.name}</span>
              <span className="count">{g.items.length} signal{g.items.length === 1 ? '' : 's'}</span>
              <span className="alert-group-sev"><SeverityDot sev={worstSev as 'high' | 'medium' | 'low'} /></span>
            </div>
            {visibleItems.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                isRead={readAlerts.has(a.id)}
                isSaved={savedAlerts.has(a.id)}
                onOpen={() => onOpen(a)}
                onToggleRead={(e) => { e.stopPropagation(); onToggleRead(a.id) }}
                onToggleSave={(e) => { e.stopPropagation(); onToggleSave(a.id) }}
              />
            ))}
            {hiddenCount > 0 && (
              <button
                type="button" className="alert-group-more"
                onClick={() => setExpanded((prev) => new Set(prev).add(g.id))}
              >
                See all {g.items.length} ({hiddenCount} more)
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Empty / loading / error states ──────────────────────────────────────────
function Skel({ w, h, r = 6, style }: { w: string | number; h: number; r?: number; style?: React.CSSProperties }) {
  return <div className="inf-sk" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}
function LoadingRows() {
  return (
    <div className="digest-plate inf-raised" aria-busy="true" aria-label="Loading signals">
      {[3, 2].map((rows, gi) => (
        <div className="digest-group" key={gi}>
          <div className="digest-group-hd">
            <Skel w={24} h={24} r={7} />
            <Skel w={90 + gi * 20} h={13} />
            <Skel w={44} h={11} style={{ marginLeft: 6 }} />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div className="alert-row" key={i} style={{ cursor: 'default' }}>
              <Skel w={8} h={8} r={999} />
              <Skel w={`${60 - i * 10}%`} h={13} />
              <Skel w={70} h={20} r={999} />
              <Skel w={28} h={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
function EmptyRows({ variant, onShowAll, onClearFilters }: {
  variant: 'fresh' | 'caught-up' | 'no-results'
  onShowAll?: () => void
  onClearFilters?: () => void
}) {
  const copy = {
    fresh:       { icon: Inbox,        heading: 'Your inbox is warming up',  body: "We're pulling signals for your tracked competitors. New ones land here as they're found." },
    'caught-up': { icon: CheckCircle2, heading: "You're all caught up",      body: 'No unread signals at medium severity or higher right now.' },
    'no-results':{ icon: FilterX,      heading: 'No signals match these filters', body: 'Try a different search term, or clear the filters to see everything.' },
  }[variant]
  const Icon = copy.icon
  return (
    <div className="digest-plate inf-raised signal-feed-empty">
      <div className="icon-circle"><Icon size={26} aria-hidden="true" /></div>
      <h3>{copy.heading}</h3>
      <p>{copy.body}</p>
      {variant === 'fresh' && (
        <Link to="/competitors" className="btn btn-secondary">Review tracked competitors</Link>
      )}
      {variant === 'caught-up' && onShowAll && (
        <button type="button" className="btn btn-secondary" onClick={onShowAll}>Show all signals</button>
      )}
      {variant === 'no-results' && onClearFilters && (
        <button type="button" className="btn btn-secondary" onClick={onClearFilters}>Clear filters</button>
      )}
    </div>
  )
}
function ErrorRows({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="digest-plate inf-raised signal-feed-empty">
      <div className="icon-circle is-error"><AlertTriangle size={26} aria-hidden="true" /></div>
      <h3>Couldn&rsquo;t load your signals</h3>
      <p>Check your connection and try again.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>Retry</button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { readAlerts, markAlertRead, markAlertUnread, savedAlerts, toggleSavedAlert, watchedCompetitors, syncUnreadCount } = useApp()
  const { lexiconInns, lexiconTaTerms } = useConfig()
  const lexicon = useMemo(() => ({ inns: lexiconInns, ta_terms: lexiconTaTerms }), [lexiconInns, lexiconTaTerms])
  const loaded = usePageLoad('alerts')

  const [liveAlerts, setLiveAlerts] = useState<MappedAlert[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryKey, setRetryKey]     = useState(0)

  const fetchSignals = useCallback(() => {
    setIsLoading(true)
    setFetchError(null)
    const competitorIds = watchedCompetitors.size > 0 ? [...watchedCompetitors] : undefined
    getRecentSignals(180, competitorIds)
      .then((signals) => { setLiveAlerts(mapSignals(signals, lexicon)); setIsLoading(false) })
      .catch((err) => { setFetchError(String(err)); setIsLoading(false) })
  }, [watchedCompetitors, lexicon])

  useEffect(() => { fetchSignals() }, [fetchSignals, retryKey])

  const [query, setQuery]         = useState('')
  const [tab, setTab]             = useState<FeedTab>(() => loadPersistedFilters()?.tab ?? 'Unread')
  const [sortMode, setSortMode]   = useState<SortMode>(() => loadPersistedFilters()?.sortMode ?? 'importance')
  const [competitorFilter, setCompetitorFilter] = useState<Set<string>>(() => new Set(loadPersistedFilters()?.competitorFilter ?? []))
  const [typeFilter, setTypeFilter]             = useState<Set<string>>(() => new Set(loadPersistedFilters()?.typeFilter ?? []))

  useEffect(() => {
    try {
      const payload: PersistedFilters = {
        tab, sortMode,
        competitorFilter: [...competitorFilter],
        typeFilter: [...typeFilter],
      }
      localStorage.setItem(FILTERS_KEY, JSON.stringify(payload))
    } catch { /* noop */ }
  }, [tab, sortMode, competitorFilter, typeFilter])

  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [drawerAlert, setDrawerAlert] = useState<MappedAlert | null>(null)

  function openDrawer(alert: MappedAlert) {
    setDrawerAlert(alert)
    setDrawerOpen(true)
    if (!readAlerts.has(alert.id)) {
      analytics.alert_expanded(alert.id)
      markAlertRead(alert.id)
    }
  }
  function toggleRead(id: string) {
    if (readAlerts.has(id)) markAlertUnread(id)
    else { analytics.alert_expanded(id); markAlertRead(id) }
  }

  const baseAlerts = watchedCompetitors.size > 0
    ? liveAlerts.filter((a) => watchedCompetitors.has(a.competitorId))
    : liveAlerts

  const unreadCount = baseAlerts.filter((a) => !readAlerts.has(a.id)).length
  useEffect(() => { syncUnreadCount(unreadCount) }, [unreadCount])

  const sorted = useMemo(() => [...baseAlerts].sort((a, b) => {
    if (sortMode === 'importance') {
      const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
      if (sevDiff !== 0) return sevDiff
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }
    const aRead = readAlerts.has(a.id), bRead = readAlerts.has(b.id)
    if (aRead !== bRead) return aRead ? 1 : -1
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  }), [baseAlerts, sortMode, readAlerts])

  // Tab: 'Unread' is the smart default from alerts-ai-synthesis-spec.md §3.2 —
  // unread AND medium/high severity, not just unread. 'High' = high severity
  // regardless of read state. 'All' is the explicit opt-in to the full log.
  const filtered = useMemo(() => sorted.filter((a) => {
    if (tab === 'High' && a.severity !== 'high') return false
    if (tab === 'Unread' && (readAlerts.has(a.id) || a.severity === 'low')) return false
    if (query.trim() && !a.headline.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (competitorFilter.size > 0 && !competitorFilter.has(a.competitorId)) return false
    if (typeFilter.size > 0 && !typeFilter.has(a.type)) return false
    return true
  }), [sorted, tab, query, competitorFilter, typeFilter, readAlerts])

  // Drawer prev/next walks the current filtered order (§3.5) -- not the
  // grouped-by-competitor visual order, so it can cross group boundaries,
  // but it stays a well-defined "next most important/recent" step either way.
  const drawerIndex = drawerAlert ? filtered.findIndex((a) => a.id === drawerAlert.id) : -1
  function goToAdjacent(delta: 1 | -1) {
    if (drawerIndex === -1) return
    const next = filtered[drawerIndex + delta]
    if (next) openDrawer(next)
  }

  // §3.5 keyboard triage, adapted to this page's shape: there is no separate
  // roving list-selection state outside the drawer, so ↑/↓/E/S act on the
  // open drawer's current alert rather than a highlighted-but-unopened row.
  useEffect(() => {
    if (!drawerOpen || !drawerAlert) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowUp')   { e.preventDefault(); goToAdjacent(-1) }
      if (e.key === 'ArrowDown') { e.preventDefault(); goToAdjacent(1) }
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); toggleRead(drawerAlert!.id) }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); toggleSavedAlert(drawerAlert!.id) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, drawerAlert, drawerIndex, filtered])

  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)
  const competitorOptions = (competitorsData as Array<{ id: string; name: string }>).map((c) => ({
    value: c.id, label: c.name, count: baseAlerts.filter((a) => a.competitorId === c.id).length,
  })).filter((o) => o.count > 0).sort(byLabel)
  const typeOptions = [...new Set(baseAlerts.map((a) => a.type))].map((t) => ({
    value: t, label: typeLabel(t), count: baseAlerts.filter((a) => a.type === t).length,
  })).sort(byLabel)

  const appliedChips: AppliedChip[] = [
    ...[...competitorFilter].map((id) => ({ key: 'competitor', value: id, label: competitorName(id) })),
    ...[...typeFilter].map((t) => ({ key: 'type', value: t, label: typeLabel(t) })),
  ]
  function removeChip(key: string, value: string) {
    if (key === 'competitor') setCompetitorFilter((prev) => { const n = new Set(prev); n.delete(value); return n })
    if (key === 'type')       setTypeFilter((prev) => { const n = new Set(prev); n.delete(value); return n })
  }
  function clearAllChips() { setCompetitorFilter(new Set()); setTypeFilter(new Set()) }
  function clearAllFilters() { setCompetitorFilter(new Set()); setTypeFilter(new Set()); setQuery(''); setTab('All') }

  const emptyVariant: 'fresh' | 'caught-up' | 'no-results' =
    baseAlerts.length === 0 ? 'fresh' : (tab === 'Unread' && appliedChips.length === 0 && !query) ? 'caught-up' : 'no-results'

  return (
    <div data-tour="alerts-page" style={{ padding: '20px 36px 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 'var(--t-caption)', color: 'var(--ink-600)' }}>
        {isLoading ? 'Loading signals…' : (
          <>Showing <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{filtered.length}</span> of{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{baseAlerts.length}</span>
            {tab === 'Unread' && ' — unread, medium+ severity'}
            {tab === 'High' && ' — high severity'}
            {tab !== 'All' && (
              <> — <button type="button" onClick={() => setTab('All')} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--indigo-600)', font: 'inherit', fontWeight: 600 }}>Show all</button></>
            )}
          </>
        )}
      </p>

      <FeedFilterBar
        query={query} onQueryChange={setQuery}
        tab={tab} onTabChange={setTab}
        sortMode={sortMode} onSortModeChange={setSortMode}
        appliedChips={appliedChips} onRemoveChip={removeChip} onClearAll={clearAllChips}
      />

      {/* Second facet row reuses .feed-filter-bar's glass chrome so it reads as
          part of one toolbar system with the bar above, not a bolted-on strip --
          FeedFilterBar only exposes one facet slot, so a second row is needed,
          but it should not look like a different component. */}
      <div className="feed-filter-bar">
        <FilterDropdown label="Competitor" options={competitorOptions} applied={competitorFilter} onApply={setCompetitorFilter} />
        <FilterDropdown label="Type" options={typeOptions} applied={typeFilter} onApply={setTypeFilter} />
      </div>

      {(!loaded || isLoading) && <LoadingRows />}

      {loaded && !isLoading && fetchError && <ErrorRows onRetry={() => setRetryKey((k) => k + 1)} />}

      {loaded && !isLoading && !fetchError && (
        filtered.length === 0
          ? <EmptyRows variant={emptyVariant} onShowAll={() => setTab('All')} onClearFilters={clearAllFilters} />
          : (
            <AlertGroups
              alerts={filtered}
              readAlerts={readAlerts}
              savedAlerts={savedAlerts}
              onOpen={openDrawer}
              onToggleRead={toggleRead}
              onToggleSave={toggleSavedAlert}
            />
          )
      )}

      <SlideOver open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Signal detail">
        {drawerAlert && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <button
                type="button" className="alert-row-action" title="Previous (↑)" aria-label="Previous signal"
                disabled={drawerIndex <= 0}
                onClick={() => goToAdjacent(-1)}
                style={drawerIndex <= 0 ? { opacity: 0.35, cursor: 'default' } : undefined}
              >
                <ChevronUp size={14} aria-hidden="true" />
              </button>
              <button
                type="button" className="alert-row-action" title="Next (↓)" aria-label="Next signal"
                disabled={drawerIndex === -1 || drawerIndex >= filtered.length - 1}
                onClick={() => goToAdjacent(1)}
                style={drawerIndex === -1 || drawerIndex >= filtered.length - 1 ? { opacity: 0.35, cursor: 'default' } : undefined}
              >
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-caption)', color: 'var(--ink-600)' }}>
                {drawerIndex + 1} of {filtered.length}
              </span>
            </div>
            <AlertDetail alert={drawerAlert} />
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--cream-300)', display: 'flex', gap: '8px' }}>
              <button
                type="button" className="btn btn-secondary btn-sm"
                onClick={() => toggleSavedAlert(drawerAlert.id)}
              >
                {savedAlerts.has(drawerAlert.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                {savedAlerts.has(drawerAlert.id) ? 'Saved' : 'Save'}
              </button>
              <button
                type="button" className="btn btn-ghost btn-sm"
                onClick={() => toggleRead(drawerAlert.id)}
              >
                <Check size={14} />
                {readAlerts.has(drawerAlert.id) ? 'Mark unread' : 'Mark read'}
              </button>
              {drawerAlert.source && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-ui)', fontSize: 'var(--t-caption)', color: 'var(--ink-600)' }}>
                  <Database size={12} aria-hidden="true" /> {drawerAlert.source}
                </span>
              )}
            </div>
          </>
        )}
      </SlideOver>

    </div>
  )
}
