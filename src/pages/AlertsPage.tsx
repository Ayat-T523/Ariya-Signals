import { useState, useEffect } from 'react'
import { analytics } from '../lib/analytics'
import {
  CheckCheck, Circle,
  ChevronDown, ChevronRight,
  LayoutList, LayoutGrid,
  Layers,
  Database,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { staggerContainer, listItem } from '../lib/motion'
import { usePageLoad } from '../hooks/usePageLoad'
import { SkeletonAlertList } from '../components/ui/Skeleton'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import FilterDropdown from '../components/ui/FilterDropdown'
import competitorsData from '../data/competitors.json'
import { getRecentSignals } from '../lib/db'
import { mapSignals } from '../lib/signalMapping'
import type { MappedAlert } from '../lib/signalMapping'
import { formatDate, formatDateAbs } from '../utils/formatDate'

// ── Type display config (labels in sentence case) ────────────────────────────
const TYPE_CONFIG = {
  'trial-update':    { label: 'Trial update',    bg: 'rgba(0,85,187,0.09)',  text: '#0055BB' },
  'exec-move':       { label: 'Exec move',       bg: 'rgba(245,158,11,0.10)',text: '#92500A' },
  'publication':     { label: 'Publication',     bg: 'rgba(5,10,68,0.07)',   text: 'rgba(5,10,68,0.60)' },
  'regulatory':      { label: 'Regulatory',      bg: 'rgba(16,185,129,0.10)',text: '#065F46' },
  'earnings':        { label: 'Earnings',        bg: 'rgba(5,10,68,0.07)',   text: 'rgba(5,10,68,0.60)' },
  'deal':            { label: 'Deal',            bg: 'rgba(139,92,246,0.10)',text: '#5B21B6' },
  'conference':      { label: 'Conference',      bg: 'rgba(0,85,187,0.09)',  text: '#0055BB' },
  'label-change':    { label: 'Label change',    bg: 'rgba(16,185,129,0.10)',text: '#065F46' },
  'field-signal':    { label: 'Field signal',    bg: 'rgba(0,85,187,0.09)',  text: '#0055BB' },
  'strategic-shift': { label: 'Strategic shift', bg: 'rgba(225,29,72,0.10)', text: '#C01041' },
}

// Severity lives entirely in its badge, not on the card edge — matches the
// War Room feed card. `high` is solid so it anchors a scan; medium and low stay
// tinted so only what needs triage carries weight. White on #C01041 is 6.2:1.
const SEVERITY_LABEL = {
  high:   { text: '#FFFFFF', bg: '#C01041' },
  medium: { text: '#92500A', bg: 'rgba(245,158,11,0.10)' },
  low:    { text: 'rgba(5,10,68,0.70)', bg: 'rgba(5,10,68,0.06)' },
}

// Severity rank used by the "Importance" sort mode
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 }

// ── Competitor name lookup ────────────────────────────────────────────────────
function competitorName(id: string) {
  return (competitorsData as Array<{ id: string; name: string }>).find((c) => c.id === id)?.name ?? id
}

// ── Filter chip ───────────────────────────────────────────────────────────────
function Chip({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 13px',
        borderRadius: '9999px',
        fontSize: '14px', fontWeight: active ? 700 : 500,
        background: active ? '#050A44' : 'transparent',
        color: active ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
        border: `1.5px solid ${active ? '#050A44' : 'rgba(5,10,68,0.15)'}`,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {count != null && (
        <span style={{
          fontSize: '11px', fontWeight: 700,
          background: active ? 'rgba(255,255,255,0.20)' : 'rgba(5,10,68,0.08)',
          color: active ? '#fff' : 'rgba(5,10,68,0.50)',
          borderRadius: '9999px', padding: '0px 6px',
          minWidth: '18px', textAlign: 'center',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── View toggle (List / Grouped) ──────────────────────────────────────────────
function ViewToggle({ value, onChange }) {
  const options = [
    { id: 'list',    Icon: LayoutList,  label: 'List' },
    { id: 'grouped', Icon: LayoutGrid,  label: 'Grouped' },
  ]
  return (
    <div style={{
      display: 'flex', gap: '2px',
      background: 'rgba(5,10,68,0.06)',
      borderRadius: '9999px', padding: '2px',
      flexShrink: 0,
    }}>
      {options.map(({ id, Icon, label }) => {
        const active = value === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={active}
            aria-label={label}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 11px', borderRadius: '9999px',
              fontSize: '14px', fontWeight: active ? 700 : 500,
              background: active ? '#050A44' : 'transparent',
              color: active ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
              border: 'none', cursor: 'pointer',
              transition: 'all 120ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={12} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Single alert card ─────────────────────────────────────────────────────────
function AlertCard({ alert }) {
  const { readAlerts, markAlertRead, markAlertUnread } = useApp()
  const isRead = readAlerts.has(alert.id)
  const [whatChangedOpen, setWhatChangedOpen] = useState(true)

  const typeCfg = TYPE_CONFIG[alert.type] || { label: alert.type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
  const sevLabel  = SEVERITY_LABEL[alert.severity]  ?? SEVERITY_LABEL.low

  function toggleRead(e) {
    e.stopPropagation()
    if (!isRead) analytics.alert_expanded(alert.id)
    isRead ? markAlertUnread(alert.id) : markAlertRead(alert.id)
  }

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(210,226,255,1)',
      padding: '18px 20px',
      opacity: isRead ? 0.72 : 1,
      transition: 'opacity 150ms ease',
    }}>

      {/* Top row: badge + chips + timestamp + read toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
        <CompetitorBadge name={competitorName(alert.competitorId)} size={32} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Chips row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
            {/* Competitor chip */}
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px',
              borderRadius: '9999px', background: 'rgba(5,10,68,0.07)',
              color: 'rgba(5,10,68,0.55)', textTransform: 'capitalize',
            }}>
              {competitorName(alert.competitorId)}
            </span>
            {/* Type chip */}
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px',
              borderRadius: '9999px', background: typeCfg.bg, color: typeCfg.text,
            }}>
              {typeCfg.label}
            </span>
            {/* Severity badge */}
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px',
              borderRadius: '9999px', background: sevLabel.bg, color: sevLabel.text,
              textTransform: 'capitalize',
            }}>
              {alert.severity}
            </span>

            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(5,10,68,0.60)', whiteSpace: 'nowrap' }}>
              {formatDate(alert.timestamp)}
            </span>
          </div>

          {/* Headline */}
          <p style={{
            margin: 0,
            fontSize: '15px', fontWeight: isRead ? 500 : 700,
            color: isRead ? 'rgba(5,10,68,0.55)' : 'rgba(5,10,68,0.90)',
            lineHeight: '1.4',
          }}>
            {!isRead && (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block', width: '7px', height: '7px',
                  borderRadius: '50%', background: '#E11D48',
                  marginRight: '8px', marginBottom: '1px', verticalAlign: 'middle',
                }}
              />
            )}
            {alert.headline}
          </p>
        </div>
      </div>

      {/* What happened */}
      {alert.whatHappened && (
        <p style={{
          margin: '0 0 10px', fontSize: '13px',
          color: 'rgba(5,10,68,0.65)', lineHeight: '1.60',
          paddingLeft: '44px',
        }}>
          {alert.whatHappened}
        </p>
      )}

      {/* Why it matters strip */}
      {alert.whyItMatters && (
        <div style={{
          background: 'rgba(42,118,244,0.12)', borderRadius: '8px',
          padding: '10px 14px', marginLeft: '44px', marginBottom: '12px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
            <strong style={{
              color: 'rgba(5,10,68,0.50)', fontWeight: 600,
              fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Why it matters —{' '}
            </strong>
            {alert.whyItMatters}
          </p>
        </div>
      )}

      {/* What changed — diff panel for signals that carry a body diff */}
      {alert.labelDiff && (
        <div style={{ marginLeft: '44px', marginBottom: '12px' }}>
          <button
            onClick={() => setWhatChangedOpen((v) => !v)}
            aria-expanded={whatChangedOpen}
            aria-controls={`diff-${alert.id}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '5px 12px', borderRadius: '9999px',
              fontSize: '14px', fontWeight: 600,
              background: 'transparent', color: 'rgba(5,10,68,0.65)',
              border: '1.5px solid rgba(5,10,68,0.12)',
              cursor: 'pointer', transition: 'all 120ms ease',
            }}
          >
            {whatChangedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            What changed
          </button>
          {whatChangedOpen && (
            <div id={`diff-${alert.id}`} style={{
              marginTop: '10px',
              display: 'grid',
              gridTemplateColumns: alert.labelDiff.previous ? '1fr 1fr' : '1fr',
              gap: '10px',
            }}>
              {alert.labelDiff.previous && (
                <div style={{
                  background: 'rgba(225,29,72,0.05)',
                  border: '1px solid rgba(225,29,72,0.15)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C01041' }}>
                    Previous
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
                    {alert.labelDiff.previous}
                  </p>
                </div>
              )}
              <div style={{
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.18)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#065F46' }}>
                  Current
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
                  {alert.labelDiff.current}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer: date + source + confidence + read toggle */}
      <div style={{
        display: 'flex', alignItems: 'center',
        paddingLeft: '44px', gap: '12px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.60)', whiteSpace: 'nowrap' }}>
          {formatDateAbs(alert.timestamp)}
        </span>
        {alert.source && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontWeight: 600, padding: '2px 8px',
            borderRadius: '9999px',
            background: 'rgba(5,10,68,0.06)',
            color: 'rgba(5,10,68,0.60)',
            whiteSpace: 'nowrap',
          }}>
            <Database size={10} strokeWidth={1.8} />
            {alert.source}
          </span>
        )}
        <button
          onClick={toggleRead}
          aria-label={isRead ? `Mark unread: ${alert.headline}` : `Mark read: ${alert.headline}`}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 11px', borderRadius: '9999px',
            fontSize: '14px', fontWeight: 600,
            background: 'transparent',
            color: isRead ? 'rgba(5,10,68,0.55)' : 'rgba(5,10,68,0.65)',
            border: '1.5px solid rgba(5,10,68,0.12)',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}
        >
          {isRead
            ? <><Circle size={11} aria-hidden="true" /> Mark unread</>
            : <><CheckCheck size={11} aria-hidden="true" /> Mark read</>
          }
        </button>
      </div>

    </div>
  )
}

// ── Theme cluster card ────────────────────────────────────────────────────────
function ThemeCluster({ theme, clusterAlerts }) {
  const { readAlerts } = useApp()
  const [expanded, setExpanded] = useState(false)

  const hasUnread = clusterAlerts.some((a) => !readAlerts.has(a.id))
  const latestTs = clusterAlerts.reduce((max, a) => {
    return a.timestamp > max ? a.timestamp : max
  }, '')

  const IconComp = Layers

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(210,226,255,1)',
      overflow: 'hidden',
    }}>

      {/* Cluster header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Theme icon */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'rgba(42,118,244,0.10)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <IconComp size={16} color="rgba(5,10,68,0.60)" />
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(5,10,68,0.90)' }}>
              {theme.name}
            </span>
            {/* Alert count badge */}
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px',
              borderRadius: '9999px', background: '#050A44', color: '#FFFFFF',
            }}>
              {clusterAlerts.length} alert{clusterAlerts.length !== 1 ? 's' : ''}
            </span>
            {/* Unread indicator dot */}
            {hasUnread && (
              <span style={{
                display: 'inline-block', width: '7px', height: '7px',
                borderRadius: '50%', background: '#E11D48', flexShrink: 0,
              }} />
            )}
          </div>
          {latestTs && (
            <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.38)' }}>
              Updated {formatDate(latestTs)}
            </span>
          )}
        </div>

        {/* Chevron */}
        {expanded
          ? <ChevronDown size={16} color="rgba(5,10,68,0.35)" style={{ flexShrink: 0 }} />
          : <ChevronRight size={16} color="rgba(5,10,68,0.35)" style={{ flexShrink: 0 }} />
        }
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(5,10,68,0.06)', padding: '16px 20px' }}>

          {/* Theme summary callout */}
          <div style={{
            background: 'rgba(42,118,244,0.08)', borderRadius: '8px',
            border: '1px solid rgba(210,226,255,1)',
            padding: '12px 16px', marginBottom: '16px',
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
              <strong style={{
                color: 'rgba(5,10,68,0.50)', fontWeight: 600,
                fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Theme insight —{' '}
              </strong>
              {theme.summary}
            </p>
          </div>

          {/* Individual alert cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clusterAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>

          {/* The per-theme Ask Ariya CTA that sat here is removed: RAG chat is AI
              and is excluded (handoff index §2, frontend §2). */}

        </div>
      )}
    </div>
  )
}

// ── Grouped view ──────────────────────────────────────────────────────────────
// Live data has no pre-built theme clusters. All signals land in a single group.
// AI-generated theme clusters will be available in a future phase.
function GroupedView({ filteredAlerts }: { filteredAlerts: MappedAlert[] }) {
  if (filteredAlerts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(5,10,68,0.35)', fontSize: '14px' }}>
        No signals match the current filters. Switch to List view or clear filters to see all signals.
      </div>
    )
  }

  const liveTheme = {
    id: 'live-signals',
    icon: 'layers',
    name: 'Live signals',
    summary: 'All live signals from ClinicalTrials.gov, FDA, SEC, and other monitored sources. AI-generated theme grouping will be available in a future update.',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <ThemeCluster theme={liveTheme} clusterAlerts={filteredAlerts} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { readAlerts, markAllRead, watchedCompetitors, syncUnreadCount } = useApp()
  const loaded = usePageLoad('alerts')

  // Live signals fetched from company_signals via getRecentSignals
  const [liveAlerts, setLiveAlerts] = useState<MappedAlert[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setFetchError(null)
    const competitorIds = watchedCompetitors.size > 0 ? [...watchedCompetitors] : undefined
    getRecentSignals(180, competitorIds)
      .then((signals) => {
        setLiveAlerts(mapSignals(signals))
        setIsLoading(false)
      })
      .catch((err) => {
        setFetchError(String(err))
        setIsLoading(false)
      })
  }, [watchedCompetitors])

  // Filter state — multi-select Sets backing the dropdowns
  const [competitorFilter, setCompetitorFilter] = useState(() => new Set<string>())
  const [typeFilter, setTypeFilter]             = useState(() => new Set<string>())
  const [sourceFilter, setSourceFilter]         = useState(() => new Set<string>())
  const [onlyUnread, setOnlyUnread]             = useState(false)

  // Sort mode — matches War Room toggle (default: Importance)
  const [sortMode, setSortMode] = useState('importance') // 'importance' | 'recency'

  // View mode — persisted in localStorage
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem('alertsView')
      return stored === 'grouped' ? 'grouped' : 'list'
    } catch {
      return 'list'
    }
  })

  function handleViewChange(mode: string) {
    setViewMode(mode)
    try { localStorage.setItem('alertsView', mode) } catch { /* noop */ }
  }

  // Base alerts are already scoped by competitor in the DB query;
  // re-filter client-side for watchlist changes before the next fetch resolves.
  const baseAlerts = watchedCompetitors.size > 0
    ? liveAlerts.filter((a) => watchedCompetitors.has(a.competitorId))
    : liveAlerts

  // Sort: Importance = severity desc then recency; Recency = unread first then recency
  const sorted = [...baseAlerts].sort((a, b) => {
    if (sortMode === 'importance') {
      const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
      if (sevDiff !== 0) return sevDiff
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }
    // Recency
    const aRead = readAlerts.has(a.id)
    const bRead = readAlerts.has(b.id)
    if (aRead !== bRead) return aRead ? 1 : -1
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  // Apply filters (multi-select: empty Set = no filter on that dimension)
  const filtered = sorted.filter((a) => {
    if (onlyUnread && readAlerts.has(a.id)) return false
    if (competitorFilter.size > 0 && !competitorFilter.has(a.competitorId)) return false
    if (typeFilter.size > 0       && !typeFilter.has(a.type))               return false
    if (sourceFilter.size > 0     && !sourceFilter.has(a.source ?? ''))     return false
    return true
  })

  const unreadCount = baseAlerts.filter((a) => !readAlerts.has(a.id)).length

  // Sync unread count to AppContext so NavPanel badge stays current
  useEffect(() => { syncUnreadCount(unreadCount) }, [unreadCount])

  // Option lists derived from live data
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)
  const allTypes   = [...new Set(baseAlerts.map((a) => a.type))]
  const allSources = [...new Set(baseAlerts.map((a) => a.source).filter(Boolean))].sort() as string[]

  const competitorOptions = (competitorsData as Array<{ id: string; name: string }>).map((c) => ({
    value: c.id,
    label: c.name,
    count: baseAlerts.filter((a) => a.competitorId === c.id).length,
  })).filter((o) => o.count > 0).sort(byLabel)

  const typeOptions = allTypes.map((t) => ({
    value: t,
    label: TYPE_CONFIG[t as keyof typeof TYPE_CONFIG]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1)),
    count: baseAlerts.filter((a) => a.type === t).length,
  })).sort(byLabel)

  const sourceOptions = allSources.map((s) => ({
    value: s,
    label: s,
    count: baseAlerts.filter((a) => a.source === s).length,
  })).sort(byLabel)

  function resetFilters() {
    setCompetitorFilter(new Set())
    setTypeFilter(new Set())
    setSourceFilter(new Set())
    setOnlyUnread(false)
  }

  const hasActiveFilter =
    competitorFilter.size > 0 ||
    typeFilter.size > 0 ||
    sourceFilter.size > 0 ||
    onlyUnread

  return (
    <div data-tour="alerts-page" style={{ padding: '20px 36px 36px' }}>

      {/* Description */}
      <p style={{ margin: '0 0 24px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#434c5b' }}>
        {isLoading ? 'Loading signals…' : `${baseAlerts.length} signals tracked · ${unreadCount} unread`}
      </p>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(210,226,255,1)',
        padding: '14px 16px',
        marginBottom: '20px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>

        {/* Row 1: quick chips (All / Unread) + View toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Chip
            label="All signals"
            active={!hasActiveFilter}
            onClick={resetFilters}
            count={baseAlerts.length}
          />
          <Chip
            label="Unread"
            active={onlyUnread}
            onClick={() => {
              setOnlyUnread((v) => !v)
              setCompetitorFilter(new Set())
              setTypeFilter(new Set())
              setSourceFilter(new Set())
            }}
            count={unreadCount}
          />
          <button
            onClick={() => markAllRead(baseAlerts.map((a) => a.id))}
            disabled={unreadCount === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '5px 13px', borderRadius: '9999px',
              fontSize: '14px', fontWeight: 500,
              background: 'transparent',
              color: unreadCount > 0 ? 'rgba(5,10,68,0.55)' : 'rgba(5,10,68,0.25)',
              border: `1.5px solid ${unreadCount > 0 ? 'rgba(5,10,68,0.15)' : 'rgba(5,10,68,0.08)'}`,
              cursor: unreadCount > 0 ? 'pointer' : 'default',
              transition: 'all 120ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <ViewToggle value={viewMode} onChange={handleViewChange} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)' }} />

        {/* Row 2: dropdown filters (Competitor · Type · Source) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <FilterDropdown
            label="Competitor"
            options={competitorOptions}
            applied={competitorFilter}
            onApply={(next) => { setCompetitorFilter(next); setOnlyUnread(false) }}
          />
          <FilterDropdown
            label="Type"
            options={typeOptions}
            applied={typeFilter}
            onApply={(next) => { setTypeFilter(next); setOnlyUnread(false) }}
          />
          <FilterDropdown
            label="Source"
            options={sourceOptions}
            applied={sourceFilter}
            onApply={(next) => { setSourceFilter(next); setOnlyUnread(false) }}
          />
        </div>
      </div>

      {/* ── Loading skeleton ────────────────────────────────────────────────── */}
      {(!loaded || isLoading) && <SkeletonAlertList count={8} />}

      {/* ── Fetch error ─────────────────────────────────────────────────────── */}
      {loaded && !isLoading && fetchError && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(5,10,68,0.35)', fontSize: '14px' }}>
          Could not load signals. Check your connection and try again.
        </div>
      )}

      {/* ── List view ───────────────────────────────────────────────────────── */}
      {loaded && !isLoading && !fetchError && viewMode === 'list' && (
        <>
          {/* Sort toggle — matches War Room (Task 4b) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
              Sort by
            </span>
            {[
              { value: 'importance', label: 'Importance' },
              { value: 'recency',    label: 'Recency' },
            ].map((opt) => {
              const isActive = sortMode === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setSortMode(opt.value)}
                  style={{
                    padding: '4px 12px', borderRadius: '9999px',
                    fontSize: '14px', fontWeight: 600,
                    border: `1.5px solid ${isActive ? '#050A44' : 'rgba(5,10,68,0.15)'}`,
                    background: isActive ? '#050A44' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
                    cursor: 'pointer', transition: 'all 120ms ease',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(5,10,68,0.35)', fontSize: '14px' }}>
              No signals match the current filters.
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
            >
              {!hasActiveFilter && (
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(5,10,68,0.35)' }}>
                  {sortMode === 'importance'
                    ? `${filtered.length} signals — highest severity first`
                    : `${unreadCount} unread`}
                </p>
              )}
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                {filtered.map((alert) => (
                  <motion.div key={alert.id} variants={listItem}>
                    <AlertCard alert={alert} />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </>
      )}

      {/* ── Grouped view ────────────────────────────────────────────────────── */}
      {loaded && !isLoading && !fetchError && viewMode === 'grouped' && (
        <GroupedView filteredAlerts={filtered} />
      )}

    </div>
  )
}
