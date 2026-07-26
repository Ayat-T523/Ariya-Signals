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
import { useEffect, useMemo, useState } from 'react'
import { Bookmark, BookmarkCheck, Check, ChevronDown, ChevronRight, ExternalLink, Inbox, CheckCircle2, FilterX, AlertTriangle, Database } from 'lucide-react'
import { analytics } from '../lib/analytics'
import { useApp } from '../context/AppContext'
import { usePageLoad } from '../hooks/usePageLoad'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import FilterDropdown from '../components/ui/FilterDropdown'
import SlideOver from '../components/ui/SlideOver'
import ProvenanceChip from '../components/ui/ProvenanceChip'
import { SeverityDot, SeverityTag } from '../components/inform/primitives'
import { FeedFilterBar, type FeedTab, type SortMode, type AppliedChip } from '../components/inform/FeedFilterBar'
import competitorsData from '../data/competitors.json'
import { getRecentSignals } from '../lib/db'
import { mapSignals } from '../lib/signalMapping'
import type { MappedAlert } from '../lib/signalMapping'
import { formatDateAbs } from '../utils/formatDate'

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
function AlertRow({ alert, isRead, isSaved, onOpen, onToggleRead, onToggleSave }: {
  alert: MappedAlert
  isRead: boolean
  isSaved: boolean
  onOpen: () => void
  onToggleRead: (e: React.MouseEvent) => void
  onToggleSave: (e: React.MouseEvent) => void
}) {
  return (
    <div className={`alert-row${isRead ? '' : ' is-unread'}`} onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <SeverityDot sev={alert.severity} />
      <span className="alert-row-headline">{alert.headline}</span>
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
    </div>
  )
}

// ── Grouped-by-competitor plate ──────────────────────────────────────────────
function AlertGroups({ alerts, readAlerts, savedAlerts, onOpen, onToggleRead, onToggleSave }: {
  alerts: MappedAlert[]
  readAlerts: Set<string>
  savedAlerts: Set<string>
  onOpen: (a: MappedAlert) => void
  onToggleRead: (id: string) => void
  onToggleSave: (id: string) => void
}) {
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
        return (
          <div className="digest-group" key={g.id}>
            <div className="digest-group-hd">
              <CompetitorBadge name={g.name} id={g.id} size={24} />
              <span className="name">{g.name}</span>
              <span className="count">{g.items.length} signal{g.items.length === 1 ? '' : 's'}</span>
              <span className="alert-group-sev"><SeverityDot sev={worstSev as 'high' | 'medium' | 'low'} /></span>
            </div>
            {g.items.map((a) => (
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
function EmptyRows({ variant, onShowAll }: { variant: 'fresh' | 'caught-up' | 'no-results'; onShowAll?: () => void }) {
  const copy = {
    fresh:       { icon: Inbox,        heading: 'Your inbox is warming up',  body: "We're pulling signals for your tracked competitors. New ones land here as they're found." },
    'caught-up': { icon: CheckCircle2, heading: "You're all caught up",      body: 'No unread high-priority signals right now.' },
    'no-results':{ icon: FilterX,      heading: 'No signals match these filters', body: 'Try widening the filters or clearing the search.' },
  }[variant]
  const Icon = copy.icon
  return (
    <div className="digest-plate inf-raised signal-feed-empty">
      <div className="icon-circle"><Icon size={26} aria-hidden="true" /></div>
      <h3>{copy.heading}</h3>
      <p>{copy.body}</p>
      {variant === 'caught-up' && onShowAll && (
        <button type="button" className="btn btn-secondary" onClick={onShowAll}>Show all signals</button>
      )}
    </div>
  )
}
function ErrorRows({ message }: { message: string }) {
  return (
    <div className="digest-plate inf-raised signal-feed-empty">
      <div className="icon-circle is-error"><AlertTriangle size={26} aria-hidden="true" /></div>
      <h3>Couldn&rsquo;t load your signals</h3>
      <p>{message}</p>
    </div>
  )
}

// ── Detail drawer content ────────────────────────────────────────────────────
function AlertDetail({ alert }: { alert: MappedAlert }) {
  const [sourceOpen, setSourceOpen] = useState(false)
  return (
    <div>
      <div className="alert-drawer-hd">
        <SeverityTag sev={alert.severity} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-600)' }}>
          {formatDateAbs(alert.timestamp)}
        </span>
      </div>
      <h3 className="alert-drawer-title">{alert.headline}</h3>

      {alert.whatHappened && (
        <div className="alert-drawer-section">
          <p className="alert-drawer-label">What changed</p>
          <p className="alert-drawer-body">{alert.whatHappened}</p>
        </div>
      )}

      {alert.whyItMatters && (
        <div className="alert-drawer-section">
          <p className="alert-drawer-label">Why it matters</p>
          <div className="mw-callout"><p>{alert.whyItMatters}</p></div>
        </div>
      )}

      {(alert.labelDiff || alert.source) && (
        <div className="alert-drawer-section">
          {alert.source && (
            <ProvenanceChip sourceLabel={alert.source} date={alert.timestamp} isLive />
          )}
          {alert.labelDiff && (
            <>
              <button
                type="button" className="alert-drawer-source-toggle"
                aria-expanded={sourceOpen} onClick={() => setSourceOpen((v) => !v)}
              >
                {sourceOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                Original source
              </button>
              {sourceOpen && (
                <div className="alert-drawer-source-body">
                  <div className="signal-excerpt">
                    <p className="signal-excerpt-quote">&ldquo;{alert.labelDiff.current}&rdquo;</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { readAlerts, markAlertRead, markAlertUnread, savedAlerts, toggleSavedAlert, watchedCompetitors, syncUnreadCount } = useApp()
  const loaded = usePageLoad('alerts')

  const [liveAlerts, setLiveAlerts] = useState<MappedAlert[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setFetchError(null)
    const competitorIds = watchedCompetitors.size > 0 ? [...watchedCompetitors] : undefined
    getRecentSignals(180, competitorIds)
      .then((signals) => { setLiveAlerts(mapSignals(signals)); setIsLoading(false) })
      .catch((err) => { setFetchError(String(err)); setIsLoading(false) })
  }, [watchedCompetitors])

  const [query, setQuery]         = useState('')
  const [tab, setTab]             = useState<FeedTab>('Unread')
  const [sortMode, setSortMode]   = useState<SortMode>('importance')
  const [competitorFilter, setCompetitorFilter] = useState<Set<string>>(() => new Set())
  const [typeFilter, setTypeFilter]             = useState<Set<string>>(() => new Set())

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

  const emptyVariant: 'fresh' | 'caught-up' | 'no-results' =
    baseAlerts.length === 0 ? 'fresh' : (tab === 'Unread' && appliedChips.length === 0 && !query) ? 'caught-up' : 'no-results'

  return (
    <div data-tour="alerts-page" style={{ padding: '20px 36px 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-600)' }}>
        {isLoading ? 'Loading signals…' : (
          <>Showing <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{filtered.length}</span> of{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{baseAlerts.length}</span>
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

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <FilterDropdown label="Competitor" options={competitorOptions} applied={competitorFilter} onApply={setCompetitorFilter} />
        <FilterDropdown label="Type" options={typeOptions} applied={typeFilter} onApply={setTypeFilter} />
      </div>

      {(!loaded || isLoading) && <LoadingRows />}

      {loaded && !isLoading && fetchError && <ErrorRows message="Could not load signals. Check your connection and try again." />}

      {loaded && !isLoading && !fetchError && (
        filtered.length === 0
          ? <EmptyRows variant={emptyVariant} onShowAll={() => setTab('All')} />
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
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-600)' }}>
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
