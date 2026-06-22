import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarDays, FileText, TrendingUp,
  MapPin, Users, ChevronRight,
  Mic, DollarSign, FlaskConical, Landmark, Star, AlertCircle,
} from 'lucide-react'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import ConfidenceIndicator from '../components/ui/ConfidenceIndicator'
import FilterDropdown from '../components/ui/FilterDropdown'
import TimelineStrip from '../components/ui/TimelineStrip'
import eventsData from '../data/events.json'
import reportsData from '../data/reports.json'
import marketData from '../data/market-developments.json'
import competitorsData from '../data/competitors.json'
import { formatDateAbs } from '../utils/formatDate'

// ── Reference date ────────────────────────────────────────────────────────────
const TODAY = new Date('2026-04-21')

// ── Helpers ───────────────────────────────────────────────────────────────────
function competitorName(id) {
  return competitorsData.find((c) => c.id === id)?.name ?? id
}

function isPast(dateStr) {
  const d = new Date(dateStr)
  return d < TODAY
}

// Find a post-event digest: report.competitorId in event.attendingCompetitors AND
// report.date within 7 days AFTER event.date. Returns the earliest match (or null).
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function findDigestForEvent(event) {
  if (!event.attendingCompetitors?.length) return null
  const eventTs = new Date(event.date).getTime()
  return reportsData
    .filter((r) => {
      if (!event.attendingCompetitors.includes(r.competitorId)) return false
      const diff = new Date(r.date).getTime() - eventTs
      return diff >= 0 && diff <= SEVEN_DAYS_MS
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null
}

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_TYPE = {
  conference: { label: 'Conference', icon: Users,       bg: 'rgba(0,85,187,0.09)',   text: '#0055BB'            },
  earnings:   { label: 'Earnings',   icon: DollarSign,  bg: 'rgba(5,10,68,0.07)',    text: 'rgba(5,10,68,0.55)' },
  regulatory: { label: 'Regulatory', icon: Landmark,    bg: 'rgba(16,185,129,0.10)', text: '#065F46'            },
  investor:   { label: 'Investor',   icon: TrendingUp,  bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
  milestone:  { label: 'Milestone',  icon: Star,        bg: 'rgba(225,29,72,0.10)',  text: '#C01041'            },
}

// ── Report type config ────────────────────────────────────────────────────────
const REPORT_TYPE = {
  'earnings-call':    { label: 'Earnings call',    bg: 'rgba(5,10,68,0.07)',    text: 'rgba(5,10,68,0.55)', icon: Mic },
  'investor-day':     { label: 'Investor day',     bg: 'rgba(139,92,246,0.10)', text: '#5B21B6',            icon: TrendingUp },
  'analyst-report':   { label: 'Analyst report',   bg: 'rgba(245,158,11,0.10)', text: '#92500A',            icon: FileText },
  'earnings-digest':  { label: 'Earnings digest',  bg: 'rgba(0,85,187,0.10)',   text: '#0055BB',            icon: FileText },
}

// ── Market type config ─────────────────────────────────────────────────────────
const MARKET_TYPE = {
  guideline:    { label: 'Guideline',     bg: 'rgba(16,185,129,0.10)', text: '#065F46'            },
  epidemiology: { label: 'Epidemiology',  bg: 'rgba(0,85,187,0.09)',   text: '#0055BB'            },
  advocacy:     { label: 'Advocacy',      bg: 'rgba(245,158,11,0.10)', text: '#92500A'            },
  payer:        { label: 'Payer',         bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
  deal:         { label: 'Deal',          bg: 'rgba(0,85,187,0.09)',   text: '#0055BB'            },
  hta:          { label: 'HTA decision',  bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
}

// ── Leadership-priority annotations (Task 5b) ────────────────────────────────
const LEADERSHIP_TYPES = new Set(['conference', 'earnings', 'regulatory'])

const LEADERSHIP_ANNOTATIONS = {
  conference: {
    expect:   'Headline presentations centered on real-world evidence and dosing convenience narratives.',
    surprise: 'Unanticipated head-to-head efficacy data, new MoA claims, or unexpected competitor-led positioning.',
  },
  earnings: {
    expect:   'HAE revenue commentary consistent with prior guidance; routine pipeline updates.',
    surprise: 'Material guidance changes, pipeline reprioritization, or deal announcements.',
  },
  regulatory: {
    expect:   'Decision aligned with prior CHMP/FDA signals; standard label scope.',
    surprise: 'Broader-than-expected indication, accelerated pathway, or restrictive label conditions.',
  },
}

// ── Shared components ─────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      margin: '0 0 10px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color: 'rgba(5,10,68,0.38)',
    }}>
      {children}
    </p>
  )
}

function TypePill({ cfg }) {
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 9px', borderRadius: '9999px',
      fontSize: '11px', fontWeight: 700,
      background: cfg.bg, color: cfg.text,
    }}>
      {Icon && <Icon size={10} />}
      {cfg.label}
    </span>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Events', icon: CalendarDays },
  { label: 'Reports & Earnings', icon: FileText },
  { label: 'Market Developments', icon: TrendingUp },
]

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', borderBottom: '2px solid rgba(5,10,68,0.08)',
      marginBottom: '28px', gap: 0, overflowX: 'auto',
    }}>
      {TABS.map(({ label, icon: Icon }, i) => {
        const isActive = active === i
        return (
          <button
            key={label}
            onClick={() => onChange(i)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '10px 20px',
              fontSize: '14px', fontWeight: isActive ? 700 : 400,
              color: isActive ? 'rgba(5,10,68,0.92)' : 'rgba(5,10,68,0.45)',
              background: 'none', border: 'none',
              borderBottom: isActive ? '2px solid #050A44' : '2px solid transparent',
              marginBottom: '-2px', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 150ms ease',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: EVENTS
// ──────────────────────────────────────────────────────────────────────────────
function EventCard({ event, showLeadershipAnnotations, pastVariant, cardRef, flashing }) {
  const typeCfg = EVENT_TYPE[event.type] || { label: event.type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
  const past = Boolean(pastVariant)
  const isMultiDay = Boolean(event.endDate)
  const annotations = LEADERSHIP_ANNOTATIONS[event.type]
  const digestReport = past ? findDigestForEvent(event) : null

  const dateLabel = isMultiDay
    ? `${formatDateAbs(event.date)} – ${formatDateAbs(event.endDate)}`
    : formatDateAbs(event.date)

  return (
    <div
      ref={cardRef}
      style={{
        background: flashing ? '#E8EAF6' : '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        borderLeft: `4px solid ${past ? 'rgba(5,10,68,0.12)' : '#0055BB'}`,
        padding: '18px 20px',
        opacity: past ? 0.70 : 1,
        transition: 'background 350ms ease',
        scrollMarginTop: '80px',
      }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px', alignItems: 'center' }}>
            <TypePill cfg={typeCfg} />
            {past && (
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                borderRadius: '9999px', background: 'rgba(5,10,68,0.06)',
                color: 'rgba(5,10,68,0.40)',
              }}>
                Past
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.90)', lineHeight: '1.35' }}>
            {event.title}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'rgba(5,10,68,0.55)', whiteSpace: 'nowrap' }}>
            {dateLabel}
          </p>
          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '3px' }}>
              <MapPin size={11} color="rgba(5,10,68,0.30)" />
              <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.38)' }}>{event.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Attending competitors */}
      {event.attendingCompetitors?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.38)', fontWeight: 600 }}>Attending:</span>
          {event.attendingCompetitors.map((id) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CompetitorBadge name={competitorName(id)} size={20} />
              <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>{competitorName(id)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expected topics */}
      {event.expectedTopics?.length > 0 && (
        <div style={{ marginBottom: event.note ? '10px' : 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
            Expected topics
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {event.expectedTopics.map((t, i) => (
              <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <ChevronRight size={12} color="rgba(5,10,68,0.30)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.5' }}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Note */}
      {event.note && (
        <div style={{
          display: 'flex', gap: '6px', alignItems: 'flex-start',
          background: '#E8EAF6', borderRadius: '8px', padding: '8px 12px',
          marginTop: '10px',
        }}>
          <AlertCircle size={12} color="#0055BB" style={{ marginTop: '2px', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.68)', lineHeight: '1.55', fontStyle: 'italic' }}>
            {event.note}
          </p>
        </div>
      )}

      {/* Leadership-priority annotations (Task 5b) */}
      {showLeadershipAnnotations && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(5,10,68,0.06)',
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          {annotations ? (
            <>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.55' }}>
                <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.65)' }}>What we expect: </span>
                {annotations.expect}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.55' }}>
                <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.65)' }}>What would surprise us: </span>
                {annotations.surprise}
              </p>
              <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                <ConfidenceIndicator sourceCoverage="medium" dataFreshness="high" inferenceDepth="high" />
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>
              Annotations available for leadership-priority events. Contact your CI team to configure.
            </p>
          )}
        </div>
      )}

      {/* Post-event digest link (past variant only) */}
      {digestReport && (
        <div style={{
          marginTop: '12px', paddingTop: '10px',
          borderTop: '1px solid rgba(5,10,68,0.06)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Link
            to={`/intelligence?tab=reports&competitor=${digestReport.competitorId}`}
            style={{
              fontSize: '13px', fontWeight: 600,
              color: '#0055BB', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}
          >
            Read digest →
          </Link>
        </div>
      )}
    </div>
  )
}

function EventsTab() {
  const [searchParams] = useSearchParams()
  const eventFromUrl = searchParams.get('event')

  const [filter, setFilter] = useState('all') // 'all' | 'leadership' (Task 5b)
  const [flashedId, setFlashedId] = useState(null)
  const cardRefs = useRef(new Map())
  const leadershipMode = filter === 'leadership'

  // 90-day cutoff for past events
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const pastCutoffTs = TODAY.getTime() - NINETY_DAYS_MS

  // Apply leadership filter first
  const filtered = leadershipMode
    ? eventsData.filter((e) => LEADERSHIP_TYPES.has(e.type))
    : eventsData

  // Upcoming = event.date today or later, sorted ascending (soonest first)
  const upcoming = filtered
    .filter((e) => new Date(e.date) >= TODAY)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  // Past = event.date strictly before today AND within last 90 days, sorted descending
  const past = filtered
    .filter((e) => {
      const ts = new Date(e.date).getTime()
      return ts < TODAY.getTime() && ts >= pastCutoffTs
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  // Strip dots: only the next 90 days' worth of (filtered) events
  const stripCutoffTs = TODAY.getTime() + NINETY_DAYS_MS
  const stripEvents = filtered.filter((e) => {
    const ts = new Date(e.date).getTime()
    return ts >= TODAY.getTime() && ts <= stripCutoffTs
  })

  function jumpToEvent(eventId) {
    const node = cardRefs.current.get(eventId)
    if (node && node.scrollIntoView) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setFlashedId(eventId)
    setTimeout(() => setFlashedId(null), 1000)
  }

  function setCardRef(id, node) {
    if (node) cardRefs.current.set(id, node)
    else cardRefs.current.delete(id)
  }

  // Highlight an event passed in via ?event=<id> on Events-tab load
  useEffect(() => {
    if (!eventFromUrl) return
    const handle = setTimeout(() => jumpToEvent(eventFromUrl), 120)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFromUrl])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Leadership-priority filter toggle (Task 5b) */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
          View
        </span>
        {[
          { value: 'all',        label: 'All events' },
          { value: 'leadership', label: 'Leadership priority' },
        ].map((opt) => {
          const isActive = filter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              style={{
                padding: '4px 12px', borderRadius: '9999px',
                fontSize: '12px', fontWeight: 600,
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

      {/* 90-day timeline strip */}
      <div style={{
        background: '#F7F8FC',
        borderBottom: '1px solid rgba(5,10,68,0.08)',
        paddingBottom: '8px',
      }}>
        <TimelineStrip
          events={stripEvents}
          startDate={TODAY}
          days={90}
          height={80}
          onDotClick={jumpToEvent}
        />
        <p style={{
          margin: '4px 4px 0', fontSize: '11px',
          color: 'rgba(5,10,68,0.40)', fontStyle: 'italic',
          textAlign: 'right',
        }}>
          Showing 90 days · scroll to navigate
        </p>
      </div>

      {upcoming.length > 0 && (
        <div>
          <SectionLabel>Upcoming — {upcoming.length} {upcoming.length === 1 ? 'event' : 'events'}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {upcoming.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                showLeadershipAnnotations={leadershipMode}
                cardRef={(node) => setCardRef(e.id, node)}
                flashing={flashedId === e.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider only shows when both sections have content */}
      {upcoming.length > 0 && past.length > 0 && (
        <div style={{ height: '1px', background: 'rgba(5,10,68,0.08)' }} />
      )}

      {past.length > 0 && (
        <div>
          <SectionLabel>Past · last 90 days — {past.length} {past.length === 1 ? 'event' : 'events'}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {past.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                showLeadershipAnnotations={leadershipMode}
                pastVariant
                cardRef={(node) => setCardRef(e.id, node)}
                flashing={flashedId === e.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: REPORTS & EARNINGS
// ──────────────────────────────────────────────────────────────────────────────
function ReportCard({ report }) {
  const typeCfg = REPORT_TYPE[report.type] || { label: report.type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
  const cName = competitorName(report.competitorId)

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(5,10,68,0.08)',
      padding: '18px 20px',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
        <CompetitorBadge name={cName} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px', alignItems: 'center' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px',
              borderRadius: '9999px', background: 'rgba(5,10,68,0.07)',
              color: 'rgba(5,10,68,0.55)', textTransform: 'capitalize',
            }}>
              {cName}
            </span>
            <TypePill cfg={typeCfg} />
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(5,10,68,0.38)', whiteSpace: 'nowrap' }}>
              {formatDateAbs(report.date)}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.90)', lineHeight: '1.35' }}>
            {report.title}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic' }}>
            {report.source}
          </p>
        </div>
      </div>

      {/* HAE Extract */}
      {report.haeExtract && (
        <div style={{
          background: '#E8EAF6', borderRadius: '10px', padding: '12px 14px',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(5,10,68,0.40)' }}>
            HAE extract
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.60' }}>
            {report.haeExtract}
          </p>
        </div>
      )}

      {/* Confidence footer (Task 9d) */}
      {report.confidence && (
        <div style={{
          marginTop: '12px', paddingTop: '10px',
          borderTop: '1px solid rgba(5,10,68,0.06)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <ConfidenceIndicator {...report.confidence} />
        </div>
      )}
    </div>
  )
}

const ALL_REPORT_TYPES = [...new Set(reportsData.map((r) => r.type))]

function ReportsTab() {
  const [searchParams] = useSearchParams()
  const competitorFromUrl = searchParams.get('competitor')

  // Filter state — multi-select Sets backing the dropdowns
  const [competitorFilter, setCompetitorFilter] = useState(
    () => competitorFromUrl ? new Set([competitorFromUrl]) : new Set()
  )
  const [typeFilter, setTypeFilter] = useState(() => new Set())

  // Sync competitor filter when URL param changes (e.g. navigating from a past event's "Read digest →")
  useEffect(() => {
    if (competitorFromUrl) {
      setCompetitorFilter(new Set([competitorFromUrl]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitorFromUrl])

  // Option lists for each dropdown (with per-option report counts, alphabetically sorted)
  const byLabel = (a, b) => a.label.localeCompare(b.label)
  const competitorOptions = competitorsData.map((c) => ({
    value: c.id,
    label: c.name,
    count: reportsData.filter((r) => r.competitorId === c.id).length,
  })).sort(byLabel)
  const typeOptions = ALL_REPORT_TYPES.map((t) => ({
    value: t,
    label: REPORT_TYPE[t]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1)),
    count: reportsData.filter((r) => r.type === t).length,
  })).sort(byLabel)

  const filtered = reportsData
    .filter((r) => competitorFilter.size === 0 || competitorFilter.has(r.competitorId))
    .filter((r) => typeFilter.size === 0       || typeFilter.has(r.type))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter bar — dropdown pattern (matches Signals & Alerts) */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      }}>
        <FilterDropdown
          label="Competitor"
          options={competitorOptions}
          applied={competitorFilter}
          onApply={setCompetitorFilter}
        />
        <FilterDropdown
          label="Type"
          options={typeOptions}
          applied={typeFilter}
          onApply={setTypeFilter}
        />
      </div>

      {/* Cards */}
      <div>
        <SectionLabel>{filtered.length} {filtered.length === 1 ? 'report' : 'reports'}</SectionLabel>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(5,10,68,0.35)', fontSize: '14px' }}>
            No reports match the current filters.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 3: MARKET DEVELOPMENTS
// ──────────────────────────────────────────────────────────────────────────────
function MarketCard({ item }) {
  const typeCfg = MARKET_TYPE[item.type] || { label: item.type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(5,10,68,0.08)',
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
        <TypePill cfg={typeCfg} />
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(5,10,68,0.38)', whiteSpace: 'nowrap' }}>
          {formatDateAbs(item.date)}
        </span>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.90)', lineHeight: '1.35' }}>
        {item.headline}
      </p>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.62)', lineHeight: '1.60' }}>
        {item.summary}
      </p>

      {/* Deal-specific fields (Task 5d) */}
      {item.type === 'deal' && (item.parties?.length > 0 || item.dealValue) && (
        <div style={{
          marginTop: '12px', paddingTop: '12px',
          borderTop: '1px solid rgba(5,10,68,0.06)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {item.parties?.length > 0 && (
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
              <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.65)' }}>Parties: </span>
              {item.parties.join(' · ')}
            </p>
          )}
          {item.dealValue && (
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
              <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.65)' }}>Deal value: </span>
              {item.dealValue}
            </p>
          )}
        </div>
      )}

      {/* HTA-specific fields (Task 5d) */}
      {item.type === 'hta' && (item.agency || item.outcome || item.timeToReimbursement) && (
        <div style={{
          marginTop: '12px', paddingTop: '12px',
          borderTop: '1px solid rgba(5,10,68,0.06)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {item.agency && (
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
              <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.65)' }}>Agency: </span>
              {item.agency}
            </p>
          )}
          {item.outcome && (
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
              <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.65)' }}>Outcome: </span>
              {item.outcome}
            </p>
          )}
          {item.timeToReimbursement && (
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
              <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.65)' }}>Time to reimbursement: </span>
              {item.timeToReimbursement}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Deal landscape table (sortable, inline-expand rationale) ─────────────────
function formatMonthYear(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function truncate(text, n) {
  if (!text) return ''
  return text.length > n ? text.slice(0, n).trimEnd() + '…' : text
}

const DEAL_COLUMNS = [
  { key: 'date',       label: 'Date',                width: '90px',  align: 'left' },
  { key: 'headline',   label: 'Asset / deal',        width: 'auto',  align: 'left' },
  { key: 'parties',    label: 'Parties',             width: 'auto',  align: 'left' },
  { key: 'dealType',   label: 'Type',                width: '120px', align: 'left' },
  { key: 'dealValue',  label: 'Deal value',          width: '160px', align: 'left' },
  { key: 'summary',    label: 'Strategic rationale', width: 'auto',  align: 'left' },
]

const OUR_PARTY_NAMES = new Set(['Pharma Inc', 'KalVista', 'Ekterly'])
const isOurDeal = (deal) =>
  (deal.parties || []).some((p) => OUR_PARTY_NAMES.has(p))

function DealsLandscapeTable({ deals }) {
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const [expandedRows, setExpandedRows] = useState(() => new Set())

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  function toggleExpanded(id) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Sort key extractors per column
  function sortValue(deal, key) {
    if (key === 'date') return new Date(deal.date).getTime() || 0
    if (key === 'parties') return (deal.parties || []).join(' · ').toLowerCase()
    const v = deal[key] ?? ''
    return String(v).toLowerCase()
  }

  const sorted = [...deals].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div>
      {/* Header line */}
      <p style={{
        margin: '0 0 10px', fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.38)',
      }}>
        36-month HAE deal landscape · {deals.length} transactions
      </p>

      {/* Table */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: 'rgba(5,10,68,0.04)' }}>
                {DEAL_COLUMNS.map((col) => {
                  const isActive = sortKey === col.key
                  return (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      style={{
                        padding: '11px 14px',
                        textAlign: col.align,
                        width: col.width,
                        fontSize: '11px', fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: isActive ? 'rgba(5,10,68,0.85)' : 'rgba(5,10,68,0.45)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                      {isActive && (
                        <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.7 }}>
                          {sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((deal) => {
                const isOurs    = isOurDeal(deal)
                const expanded  = expandedRows.has(deal.id)
                const fullText  = deal.summary || ''
                const isLong    = fullText.length > 80
                const showText  = expanded || !isLong ? fullText : truncate(fullText, 80)

                return (
                  <tr
                    key={deal.id}
                    style={{
                      borderTop: '1px solid rgba(5,10,68,0.06)',
                      background: isOurs ? 'rgba(0,85,187,0.04)' : 'transparent',
                      borderLeft: isOurs ? '3px solid #0055BB' : '3px solid transparent',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isOurs) e.currentTarget.style.background = 'rgba(5,10,68,0.025)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isOurs) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <td style={dealTdStyle()}>
                      {formatMonthYear(deal.date)}
                    </td>
                    <td style={{ ...dealTdStyle(), fontWeight: 600, color: 'rgba(5,10,68,0.88)' }}>
                      {truncate(deal.headline, 60)}
                      {isOurs && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          background: '#0055BB', color: '#FFFFFF',
                          fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                          verticalAlign: '2px',
                        }}>
                          OUR DEAL
                        </span>
                      )}
                    </td>
                    <td style={dealTdStyle()}>
                      {(deal.parties || []).join(' · ') || '—'}
                    </td>
                    <td style={dealTdStyle()}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '9999px',
                        background: 'rgba(5,10,68,0.06)',
                        color: 'rgba(5,10,68,0.65)',
                        fontSize: '11px', fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {deal.dealType || '—'}
                      </span>
                    </td>
                    <td style={{ ...dealTdStyle(), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {deal.dealValue || '—'}
                    </td>
                    <td style={{ ...dealTdStyle(), color: 'rgba(5,10,68,0.65)', lineHeight: '1.55', minWidth: '260px' }}>
                      {showText}
                      {isLong && (
                        <>
                          {' '}
                          <button
                            onClick={() => toggleExpanded(deal.id)}
                            style={{
                              background: 'none', border: 'none', padding: 0,
                              color: '#0055BB', cursor: 'pointer',
                              fontSize: '12px', fontWeight: 600,
                              fontFamily: 'inherit',
                            }}
                          >
                            {expanded ? 'Read less' : 'Read more'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Caption */}
      <p style={{
        margin: '12px 0 0', fontSize: '11px',
        color: 'rgba(5,10,68,0.40)', fontStyle: 'italic',
      }}>
        Sources: GlobalData Deals · PharmaDeals · SEC 8-K filings · Illustrative
      </p>
    </div>
  )
}

function dealTdStyle() {
  return {
    padding: '12px 14px',
    fontSize: '13px',
    color: 'rgba(5,10,68,0.78)',
    verticalAlign: 'top',
  }
}

function MarketTab() {
  const [activeFilter, setActiveFilter] = useState(null) // null | 'deal' | 'hta'
  const [dealsView, setDealsView]       = useState('feed') // 'feed' | 'landscape'
  const sorted = [...marketData].sort((a, b) => new Date(b.date) - new Date(a.date))
  const filtered = activeFilter ? sorted.filter((item) => item.type === activeFilter) : sorted

  const toggleFilter = (value) => setActiveFilter(activeFilter === value ? null : value)
  const isDealsActive = activeFilter === 'deal'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-stream filter + (Deals only) view toggle */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
          Stream
        </span>
        {[
          { value: 'deal', label: 'Deals' },
          { value: 'hta',  label: 'HTA decisions' },
        ].map((opt) => {
          const isActive = activeFilter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => toggleFilter(opt.value)}
              style={{
                padding: '4px 12px', borderRadius: '9999px',
                fontSize: '12px', fontWeight: 600,
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

        {/* Feed | Landscape view toggle — only visible when Deals is active */}
        {isDealsActive && (
          <div style={{
            marginLeft: 'auto',
            display: 'inline-flex', gap: '2px',
            background: 'rgba(5,10,68,0.06)',
            borderRadius: '9999px', padding: '2px',
          }}>
            {[
              { value: 'feed',      label: 'Feed' },
              { value: 'landscape', label: 'Landscape' },
            ].map((opt) => {
              const isOn = dealsView === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setDealsView(opt.value)}
                  style={{
                    padding: '4px 12px', borderRadius: '9999px',
                    fontSize: '12px', fontWeight: isOn ? 700 : 500,
                    background: isOn ? '#050A44' : 'transparent',
                    color: isOn ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Landscape table view (Deals + Landscape only) */}
      {isDealsActive && dealsView === 'landscape' ? (
        <DealsLandscapeTable deals={filtered} />
      ) : (
        <div>
          <SectionLabel>{filtered.length} developments</SectionLabel>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(5,10,68,0.35)', fontSize: '14px' }}>
              No developments match the current filter.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map((item) => <MarketCard key={item.id} item={item} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TAB_NAME_TO_INDEX = { events: 0, reports: 1, market: 2 }

export default function Portal() {
  const [searchParams] = useSearchParams()
  const tabFromUrl = TAB_NAME_TO_INDEX[searchParams.get('tab')]
  const [activeTab, setActiveTab] = useState(tabFromUrl ?? 0)

  // Sync tab state when URL param changes (e.g. tour navigation)
  useEffect(() => {
    if (tabFromUrl !== undefined && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl])

  const upcomingCount = eventsData.filter((e) => !isPast(e.endDate || e.date)).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1180px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Intelligence Feed
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.50)' }}>
          {upcomingCount} upcoming events · {reportsData.length} reports · {marketData.length} market developments
        </p>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <div style={{ display: activeTab === 0 ? 'block' : 'none' }}><EventsTab /></div>
      <div style={{ display: activeTab === 1 ? 'block' : 'none' }}><ReportsTab /></div>
      <div style={{ display: activeTab === 2 ? 'block' : 'none' }}><MarketTab /></div>
    </div>
  )
}
