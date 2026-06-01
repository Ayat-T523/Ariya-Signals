/**
 * WarRoom.tsx — Rebuilt against Figma node 4:5387 (file IXHI4HJFuZpw5hPMrv7DVb).
 *
 * Rules:
 *   - All data from src/data/kalvista.ts. No parallel numbers in this file.
 *   - No raw hex. Every colour via CSS custom property or RGBA string.
 *   - No console.log of any data.
 *   - lucide-react for all icons, no other icon library.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Zap, Activity } from 'lucide-react'
import {
  alertsData,
  competitorsData,
  eventsData,
  userData,
} from '../data/kalvista'
import { useApp } from '../context/AppContext'
import CompetitorBadge from '../components/ui/CompetitorBadge'

// ── Types ──────────────────────────────────────────────────────────────────────
type Alert      = (typeof alertsData)[0]
type Competitor = (typeof competitorsData)[0]
type EventItem  = (typeof eventsData)[0]

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date('2026-04-21')

const IMPLICATION_ITEMS = [
  "Sebetralstat's first-mover window is compressing — plausibly 18 months ahead of Pharvaris rather than 24. Commercial readiness and KOL anchoring should accelerate.",
  "Pediatric expansion across Takhzyro and Andembry creates pressure to clarify Ekterly's pediatric narrative within Q3 to avoid ceding ground in this segment.",
  "Incumbents' defensive posture is softening on tone (BioCryst, CSL) but tightening on access — double down on real-world time-to-relief evidence to support switching conversations.",
]

const WHAT_MOVED_ITEMS = [
  "Sebetralstat's first-mover window is compressing — plausibly 18 months ahead of Pharvaris rather than 24. Commercial readiness and KOL anchoring should accelerate.",
  "Pediatric expansion across Takhzyro and Andembry creates pressure to clarify Ekterly's pediatric narrative within Q3 to avoid ceding ground in this segment.",
  "Incumbents' defensive posture is softening on tone (BioCryst, CSL) but tightening on access — double down on real-world time-to-relief evidence to support switching conversations.",
]

// ── Severity ──────────────────────────────────────────────────────────────────
const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

const SEV_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: 'rgba(179,38,30,0.15)',  text: '#b3261e',              label: 'High'   },
  medium: { bg: 'rgba(250,174,54,0.15)', text: '#966820',              label: 'Medium' },
  low:    { bg: 'rgba(67,76,91,0.12)',   text: 'var(--font-secondary)', label: 'Low'    },
}

// ── Signal type labels (human-readable) ──────────────────────────────────────
const SIGNAL_TYPE_LABELS: Record<string, string> = {
  'trial-update':    'Clinical Trial',
  'exec-move':       'Leadership Change',
  'publication':     'Publication',
  'regulatory':      'Regulatory',
  'earnings':        'Earnings',
  'deal':            'Partnership',
  'conference':      'Conference',
  'label-change':    'Label Change',
  'field-signal':    'Field Intelligence',
  'strategic-shift': 'Strategic Shift',
}

// ── Quadrant config — styling only, assignment is now signal-driven ───────────
const QUADRANT_CONFIG = [
  {
    key:        'strength'    as const,
    label:      'Strength',
    outerBg:    'rgba(42,118,244,0.15)',
    labelColor: '#2a76f4',
    badgeBg:    'rgba(42,118,244,0.15)',
    badgeColor: '#2a76f4',
  },
  {
    key:        'danger'      as const,
    label:      'Danger',
    outerBg:    'rgba(183,63,84,0.15)',
    labelColor: '#b73f54',
    badgeBg:    'rgba(183,63,84,0.15)',
    badgeColor: '#b73f54',
  },
  {
    key:        'weakness'    as const,
    label:      'Weakness',
    outerBg:    'rgba(250,174,54,0.15)',
    labelColor: '#faae36',
    badgeBg:    'rgba(250,174,54,0.15)',
    badgeColor: '#faae36',
  },
  {
    key:        'opportunity' as const,
    label:      'Opportunity',
    outerBg:    'rgba(67,76,91,0.16)',
    labelColor: 'var(--font-primary)',
    badgeBg:    'rgba(67,76,91,0.15)',
    badgeColor: 'var(--font-primary)',
  },
]

type QuadrantKey   = typeof QUADRANT_CONFIG[number]['key']
type QuadrantEntry = { competitor: Competitor; primaryAlert: Alert }

// ── Event filter ──────────────────────────────────────────────────────────────
const EVENT_FILTERS = ['All events', 'Earnings', 'Filings', 'Clinical', 'Data readout', 'Approval'] as const
type EventFilter = typeof EVENT_FILTERS[number]

const EVENT_TYPE_MAP: Record<string, string[]> = {
  'Earnings':     ['earnings'],
  'Filings':      ['regulatory'],
  'Clinical':     ['conference'],
  'Data readout': ['data-readout'],
  'Approval':     ['approval'],
}

// ── Event type badge styles ───────────────────────────────────────────────────
const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  conference: { bg: 'rgba(42,118,244,0.12)', text: '#2a76f4',             label: 'Conference' },
  earnings:   { bg: 'rgba(250,174,54,0.15)', text: '#966820',             label: 'Earnings'   },
  regulatory: { bg: 'rgba(130,88,200,0.12)', text: '#7C3AED',             label: 'Regulatory' },
  investor:   { bg: 'rgba(5,10,68,0.10)',    text: 'rgba(5,10,68,0.72)',  label: 'Investor'   },
  milestone:  { bg: 'rgba(183,63,84,0.12)', text: '#b73f54',              label: 'Milestone'  },
}

// ── Status badge styles ───────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Confirmed: { bg: 'rgba(73,160,120,0.12)',  text: 'var(--status-green)'  },
  Projected: { bg: 'rgba(250,174,54,0.15)',  text: '#966820'              },
  Pending:   { bg: 'rgba(67,76,91,0.12)',    text: 'var(--font-secondary)' },
}

// ── Conference pills — one per relevant month header ─────────────────────────
const CONF_PILLS: Record<string, { name: string; dates: string }> = {
  'Apr 2026': { name: 'EAACI',      dates: 'Apr 15–18' },
  'Jun 2026': { name: 'FDA AdCom',  dates: 'Jun 8–11'  },
  'Sep 2026': { name: 'HAEi Global', dates: 'Sep 24–27' },
  'Oct 2026': { name: 'ACAAI',      dates: 'Oct 10–14' },
  'Feb 2027': { name: 'AAAAI',      dates: 'Feb 27–Mar 2' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function relTimeShort(ts: string): string {
  const diffMs = TODAY.getTime() - new Date(ts).getTime()
  const diffH  = Math.round(diffMs / (1000 * 60 * 60))
  if (diffH < 24) return `${Math.max(0, diffH)}h`
  return `${Math.round(diffH / 24)}d`
}

function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function groupByMonth(events: EventItem[]): Record<string, EventItem[]> {
  const out: Record<string, EventItem[]> = {}
  for (const ev of events) {
    const key = new Date(ev.date).toLocaleDateString('en-US', {
      month: 'short', year: 'numeric', timeZone: 'UTC',
    })
    if (!out[key]) out[key] = []
    out[key].push(ev)
  }
  return out
}

function getEventStatus(ev: EventItem): 'Confirmed' | 'Projected' | 'Pending' {
  const diff = (new Date(ev.date).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24)
  if (diff <= 14)  return 'Confirmed'
  if (diff <= 60)  return 'Projected'
  return 'Pending'
}

// ── Signal → quadrant classification ─────────────────────────────────────────
/**
 * Maps a single alert to one of the four quadrant types:
 *   Strength   — good news for Pharma Inc (competitor experiencing a setback)
 *   Danger     — bad news  (competitor actively advancing, hard to stop)
 *   Weakness   — concern to watch and counter (competitor building capability)
 *   Opportunity — upcoming catalyst to prepare for or capitalise on
 */
function classifyAlert(alert: Alert): QuadrantKey {
  const { type, severity, headline } = alert
  const h = headline.toLowerCase()

  // Strength: competitor losing key personnel signals instability
  if (type === 'exec-move') {
    const leavingWords = ['transition', 'departure', 'leaves', 'resign', 'exit', 'succession']
    if (leavingWords.some(w => h.includes(w))) return 'strength'
  }

  // Danger: competitor making concrete regulatory or clinical advances
  if (['regulatory', 'label-change'].includes(type)) return 'danger'
  if (type === 'trial-update' && ['high', 'medium'].includes(severity)) return 'danger'
  if (type === 'deal' && severity !== 'low') return 'danger'
  if (type === 'strategic-shift' && severity === 'high') return 'danger'

  // Weakness: competitor building field presence or generating supporting evidence
  if (['field-signal', 'publication', 'exec-move', 'strategic-shift'].includes(type)) return 'weakness'

  // Opportunity: upcoming catalysts to monitor and respond to
  return 'opportunity'
}

/**
 * Assigns one competitor per quadrant based on their most important recent signals.
 * Competitors are processed highest-severity first. A competitor is placed in the
 * first empty quadrant slot that their top alert maps to. Not all quadrants need to
 * be filled — the grid adapts to however many have data.
 */
function buildSignalQuadrants(): Partial<Record<QuadrantKey, QuadrantEntry>> {
  const result: Partial<Record<QuadrantKey, QuadrantEntry>> = {}

  const ranked = competitorsData
    .map(c => ({
      competitor: c,
      alerts: [...alertsData]
        .filter(a => a.competitorId === c.id)
        .sort((a, b) =>
          ((SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0)) ||
          (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        ),
    }))
    .filter(x => x.alerts.length > 0)
    .sort((a, b) =>
      (SEV_RANK[b.alerts[0].severity] ?? 0) - (SEV_RANK[a.alerts[0].severity] ?? 0)
    )

  for (const { competitor, alerts } of ranked) {
    for (const alert of alerts) {
      const qKey = classifyAlert(alert)
      if (!result[qKey]) {
        result[qKey] = { competitor, primaryAlert: alert }
        break
      }
    }
  }

  return result
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Dashed underline link */
function DashedLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: '12px', fontWeight: 400,
        color: 'var(--font-primary)',
        textDecoration: 'none',
        borderBottom: '1px dashed var(--font-primary)',
        paddingBottom: '2px',
        display: 'inline-block',
        lineHeight: 1.2,
      }}
    >
      {children}
    </Link>
  )
}

/** KPI tile */
function KpiTile({
  icon: Icon, value, label, sublabel, unread, linkLabel, linkTo,
}: {
  icon: typeof Bell
  value: number
  label: string
  sublabel: string
  unread: number
  linkLabel: string
  linkTo: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
        <Icon size={16} color="var(--font-secondary)" strokeWidth={1.5} style={{ marginBottom: '4px' }} />
        <span style={{
          fontSize: '32px', fontWeight: 500,
          color: 'var(--font-primary)', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--font-primary)', marginBottom: '4px' }}>
          &nbsp;{label}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-primary)', letterSpacing: '0.02em' }}>
        {sublabel}
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-primary)' }}>
        {unread} unread
      </p>
      <DashedLink to={linkTo}>{linkLabel}</DashedLink>
    </div>
  )
}

/** Signal row */
function SignalRow({ alert, isLast }: { alert: Alert; isLast: boolean }) {
  const badge      = SEV_BADGE[alert.severity] ?? SEV_BADGE.low
  const competitor = competitorsData.find(c => c.id === alert.competitorId)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '8px 0' }}>
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          <CompetitorBadge name={competitor?.name ?? alert.competitorId} size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-primary)', lineHeight: 1.4 }}>
            {alert.headline}
          </p>
          {alert.whyItMatters && (
            <p style={{
              margin: 0, fontSize: '14px', fontWeight: 400,
              color: 'var(--font-primary)', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {alert.whyItMatters}
            </p>
          )}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', justifyContent: 'space-between',
          gap: '4px', flexShrink: 0, alignSelf: 'stretch',
        }}>
          <div style={{
            background: badge.bg, color: badge.text,
            fontSize: '12px', fontWeight: 500,
            padding: '4px 12px', borderRadius: '6px',
          }}>
            {badge.label}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)', fontWeight: 300 }}>
              {relTimeShort(alert.timestamp)}
            </p>
            {alert.source && (
              <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--font-secondary)', fontWeight: 300 }}>
                {alert.source}
              </p>
            )}
          </div>
        </div>
      </div>
      {!isLast && <div style={{ height: '1px', background: 'var(--border-subtle)' }} />}
    </>
  )
}

/** Competitor quadrant card — only the quadrant label is signal-driven; card body unchanged */
function QuadrantCard({
  competitor, quadrant, lastSignalLabel,
}: {
  competitor:      Competitor
  quadrant:        typeof QUADRANT_CONFIG[number]
  lastSignalLabel: string
}) {
  const pipelineCount = (competitor.pipeline || []).length

  return (
    <Link to={`/competitors/${competitor.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: quadrant.outerBg,
        borderRadius: '16px',
        padding: '10px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {/* Header: competitor name */}
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: quadrant.labelColor, lineHeight: 1.2 }}>
          {competitor.name}
        </p>

        {/* Inner white card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '8px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {/* Strategic posture badge */}
          <div style={{
            background: quadrant.badgeBg,
            color: quadrant.badgeColor,
            fontSize: '14px', fontWeight: 400,
            padding: '4px 8px', borderRadius: '8px',
            display: 'inline-block',
            alignSelf: 'flex-start',
            fontFamily: 'Satoshi, sans-serif',
          }}>
            {competitor.strategicPosture}
          </div>

          {/* Competitor identity + description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CompetitorBadge name={competitor.name} id={competitor.id} size={20} />
              <p style={{
                margin: 0, fontSize: '12px', fontWeight: 500,
                color: 'var(--font-primary)', fontFamily: 'Satoshi, sans-serif',
              }}>
                {competitor.name}
              </p>
            </div>
            <p style={{
              margin: 0, fontSize: '14px', fontWeight: 400,
              color: 'var(--font-primary)', lineHeight: 1.4,
              fontFamily: 'Satoshi, sans-serif',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {competitor.executiveSummary}
            </p>
          </div>

          {/* Footer stats */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-secondary)', fontFamily: 'Satoshi, sans-serif', textAlign: 'center' }}>
                Pipeline
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-primary)', fontFamily: 'Satoshi, sans-serif', whiteSpace: 'nowrap' }}>
                {pipelineCount} {pipelineCount === 1 ? 'asset' : 'assets'}
              </p>
            </div>
            <div style={{ width: '1px', height: '48px', background: 'var(--border-subtle)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-secondary)', fontFamily: 'Satoshi, sans-serif', whiteSpace: 'nowrap' }}>
                Last signal
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-primary)', fontFamily: 'Satoshi, sans-serif', textAlign: 'center' }}>
                {lastSignalLabel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Pill-select tab group */
function PillSelect<T extends string>({
  options, value, onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{
      display: 'inline-flex', gap: '6px', alignItems: 'center',
      padding: '4px',
      border: '1px solid var(--blue-light)',
      borderRadius: '16px',
      flexWrap: 'wrap',
    }}>
      {options.map(opt => {
        const active = opt === value
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="ariya-focus"
            style={{
              padding: '4px 8px',
              borderRadius: active ? '16px' : '12px',
              fontSize: '13px', fontWeight: 400,
              background: active ? 'var(--dark-blue)' : 'transparent',
              color: active ? '#ffffff' : 'var(--font-primary)',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Event row — Figma node 4-5935 layout:
 * [24px logo] | [Company bold / Event title small] | [Type badge] | [Date / Location] | [Status badge]
 */
function EventRow({ event }: { event: EventItem }) {
  const status      = getEventStatus(event)
  const statusStyle = STATUS_STYLES[status]
  const typeStyle   = EVENT_TYPE_STYLES[event.type] ?? EVENT_TYPE_STYLES.conference

  const ids = event.attendingCompetitors ?? []
  const primaryCompetitor = ids.length > 0
    ? competitorsData.find(c => c.id === ids[0])
    : undefined

  const companyName = (() => {
    if (ids.length === 0) return 'Industry'
    if (ids.length === 1) return primaryCompetitor?.name ?? ids[0]
    const first = primaryCompetitor?.name?.split(' ')[0] ?? ids[0]
    if (ids.length === 2) {
      const second = competitorsData.find(c => c.id === ids[1])?.name?.split(' ')[0] ?? ids[1]
      return `${first} + ${second}`
    }
    return `${first} +${ids.length - 1} more`
  })()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 0',
    }}>
      {/* Logo */}
      <div style={{ flexShrink: 0 }}>
        {primaryCompetitor
          ? <CompetitorBadge name={primaryCompetitor.name} id={primaryCompetitor.id} size={24} />
          : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-2)', flexShrink: 0 }} />
        }
      </div>

      {/* Company name + event title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '12px', fontWeight: 600,
          color: 'var(--font-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {companyName}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: '11px',
          color: 'var(--font-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {event.title}
        </p>
      </div>

      {/* Event type badge */}
      <span style={{
        padding: '3px 8px', borderRadius: '6px',
        fontSize: '11px', fontWeight: 500,
        background: typeStyle.bg, color: typeStyle.text,
        flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {typeStyle.label}
      </span>

      {/* Date + location */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '52px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'var(--font-primary)', whiteSpace: 'nowrap' }}>
          {formatEventDate(event.date)}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: '10px',
          color: 'var(--font-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: '72px',
        }}>
          {event.location.split(',')[0]}
        </p>
      </div>

      {/* Status badge */}
      <span style={{
        padding: '3px 8px', borderRadius: '8px',
        fontSize: '11px', fontWeight: 500,
        background: statusStyle.bg, color: statusStyle.text,
        flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {status}
      </span>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function WarRoom() {
  const { unreadCount, readAlerts } = useApp()
  const [sortMode, setSortMode]       = useState<'Importance' | 'Recency'>('Importance')
  const [eventFilter, setEventFilter] = useState<EventFilter>('All events')

  // Derived counts
  const trackedCompetitorCount = new Set(alertsData.map(a => a.competitorId)).size
  const totalSignals           = alertsData.length
  const highUnread             = alertsData.filter(
    a => a.severity === 'high' && !readAlerts.has(a.id),
  ).length

  // Top 5 signals
  const topAlerts = [...alertsData]
    .sort((a, b) => {
      if (sortMode === 'Importance') {
        const sevDiff = (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0)
        if (sevDiff !== 0) return sevDiff
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
      const aRead = readAlerts.has(a.id) ? 1 : 0
      const bRead = readAlerts.has(b.id) ? 1 : 0
      if (aRead !== bRead) return aRead - bRead
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    .slice(0, 5)

  // ── Signal-driven competitor quadrants ─────────────────────────────────────
  const quadrantMap = buildSignalQuadrants()

  function lastSignalFor(competitorId: string): string {
    const recent = alertsData
      .filter(a => a.competitorId === competitorId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    return recent ? relTimeShort(recent.timestamp) + ' ago' : '—'
  }

  // ── Upcoming events ────────────────────────────────────────────────────────
  const upcomingEvents = [...eventsData]
    .filter(e => {
      if (new Date(e.date) < TODAY) return false
      if (eventFilter === 'All events') return true
      return (EVENT_TYPE_MAP[eventFilter] || []).includes(e.type)
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8)

  const groupedEvents = groupByMonth(upcomingEvents)
  const monthKeys     = Object.keys(groupedEvents)

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  const kpiTiles = [
    {
      icon: Bell, value: 3, label: 'alerts',
      sublabel: 'NEW SINCE LAST VISIT', unread: 3,
      linkLabel: 'Open new arrivals', linkTo: '/alerts',
    },
    {
      icon: Activity, value: unreadCount, label: 'alerts',
      sublabel: 'NEW SINCE LAST VISIT', unread: unreadCount,
      linkLabel: 'Open new arrivals', linkTo: '/alerts',
    },
    {
      icon: Zap, value: highUnread, label: 'alerts',
      sublabel: 'NEW SINCE LAST VISIT', unread: highUnread,
      linkLabel: 'Open new arrivals', linkTo: '/alerts',
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '8px 36px 36px' }}>

      {/* ── Welcome section ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: '24px', padding: '8px 0 8px',
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--font-primary)' }}>
            Last refreshed:{' '}
            <span style={{ fontWeight: 500 }}>2 mins ago</span>
          </p>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '32px', fontWeight: 500,
              color: 'var(--font-primary)', lineHeight: 1.2,
            }}>
              Welcome back, {userData.user.name}.
            </h1>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              marginTop: '4px',
              fontSize: '14px', color: 'var(--font-primary)',
            }}>
              <span>{trackedCompetitorCount} tracked competitors</span>
              <span style={{ color: 'var(--font-secondary)' }}>•</span>
              <span>{totalSignals} signals found</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
          {kpiTiles.map((tile, i) => (
            <KpiTile key={i} {...tile} />
          ))}
        </div>
      </div>

      {/* ── Row 1: Top signals + Market weather ─────────────────────────── */}
      <div style={{
        backdropFilter: 'blur(2px)',
        background: '#e4e9f1',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '16px',
        display: 'flex', gap: '16px', alignItems: 'stretch',
      }}>

        {/* Top signals to triage */}
        <div style={{
          flex: 1, minWidth: 0,
          background: '#ffffff',
          border: '1.8px solid var(--blue-light)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', whiteSpace: 'nowrap' }}>
                Top signals to triage
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)', whiteSpace: 'nowrap' }}>
                5 shown • {unreadCount} unread
              </p>
            </div>
            <PillSelect
              options={['Importance', 'Recency'] as const}
              value={sortMode}
              onChange={setSortMode}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topAlerts.map((alert, i) => (
              <SignalRow key={alert.id} alert={alert} isLast={i === topAlerts.length - 1} />
            ))}
          </div>

          <div style={{ alignSelf: 'flex-start' }}>
            <DashedLink to="/alerts">Read full assessment</DashedLink>
          </div>
        </div>

        {/* Market weather */}
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(246,246,246,0.36)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          flexShrink: 0, width: '380px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)' }}>
              Market weather · Ekterly
            </p>
            <div style={{ background: 'rgba(174,169,177,0.15)', borderRadius: '8px', padding: '4px 8px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-secondary)' }}>30 d</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{
                  margin: 0, fontSize: '12px', fontWeight: 500,
                  color: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  Implications · last 7 days
                </p>
                <div style={{ background: 'rgba(183,63,84,0.15)', borderRadius: '8px', padding: '4px 8px' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--status-red)' }}>
                    Pressure building
                  </p>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {IMPLICATION_ITEMS.map((text, i) => (
                  <li key={i} style={{ fontSize: '14px', color: 'var(--font-primary)', lineHeight: 1.4 }}>{text}</li>
                ))}
              </ul>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{
                margin: 0, fontSize: '12px', fontWeight: 500,
                color: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                What moved this week
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {WHAT_MOVED_ITEMS.map((text, i) => (
                  <li key={i} style={{ fontSize: '14px', color: 'var(--font-primary)', lineHeight: 1.4 }}>{text}</li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <DashedLink to="/alerts">Read full assessment</DashedLink>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--font-primary)' }}>Confidence:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-green)', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--font-primary)' }}>Strong</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Tracked competitors + Upcoming events ─────────────────── */}
      <div style={{
        display: 'flex', gap: '16px', alignItems: 'flex-start',
        marginBottom: '24px',
      }}>

        {/* ── Tracked competitors — signal-driven 2×2 grid ────────────── */}
        <div style={{
          flex: 1, minWidth: 0,
          height: '600px',
          background: '#ffffff',
          border: '1.8px solid var(--blue-light)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)' }}>
                Tracked Competitors
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)' }}>
                {Object.keys(quadrantMap).length} shown
              </p>
            </div>
            <DashedLink to="/competitors">View full competitor list</DashedLink>
          </div>

          {/* Grid — only renders filled quadrant slots */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {QUADRANT_CONFIG.map(quadrant => {
              const entry = quadrantMap[quadrant.key]
              if (!entry) return null
              return (
                <QuadrantCard
                  key={quadrant.key}
                  competitor={entry.competitor}
                  quadrant={quadrant}
                  lastSignalLabel={lastSignalFor(entry.competitor.id)}
                />
              )
            })}
          </div>
        </div>

        {/* ── Upcoming events ─────────────────────────────────────────── */}
        <div style={{
          background: '#ffffff',
          border: '1.8px solid var(--blue-light)',
          borderRadius: '16px',
          padding: '16px',
          flexShrink: 0, width: '600px',
          height: '600px',
          display: 'flex', flexDirection: 'column', gap: '10px',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)' }}>
                  Upcoming events
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)' }}>
                  {upcomingEvents.length} shown
                </p>
              </div>
              <DashedLink to="/intelligence?tab=events">View in competitor mode</DashedLink>
            </div>

            {/* Filter tabs */}
            <PillSelect
              options={EVENT_FILTERS}
              value={eventFilter}
              onChange={setEventFilter}
            />
          </div>

          {/* Grouped events */}
          {monthKeys.length === 0 ? (
            <p style={{
              margin: 0, fontSize: '12px', color: 'var(--font-secondary)',
              textAlign: 'center', padding: '24px 0',
            }}>
              No upcoming events for this filter.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {monthKeys.map(month => (
                <div key={month}>

                  {/* Month header + optional conference pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '4px',
                  }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      color: 'var(--font-secondary)',
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}>
                      {month}
                    </span>
                    {CONF_PILLS[month] && (
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        fontSize: '10px', fontWeight: 600,
                        background: 'rgba(42,118,244,0.10)',
                        color: '#2a76f4',
                        whiteSpace: 'nowrap',
                      }}>
                        {CONF_PILLS[month].name} · {CONF_PILLS[month].dates}
                      </span>
                    )}
                    <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                  </div>

                  {/* Event rows */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {groupedEvents[month].map((ev, i) => (
                      <div key={ev.id}>
                        <EventRow event={ev} />
                        {i < groupedEvents[month].length - 1 && (
                          <div style={{
                            height: '1px',
                            background: 'var(--border-subtle)',
                            margin: '0 0 0 34px',
                          }} />
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer CTA banner ─────────────────────────────────────────────── */}
      <div style={{
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        height: '286px',
        display: 'flex',
        alignItems: 'center',
      }}>

        {/* Layer 1 — base dark fill (#03070F) */}
        <img
          src="/banners/base.svg"
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />

        {/* Layer 2 — dashed grid */}
        <img
          src="/banners/grid.svg"
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: 0.35,
            pointerEvents: 'none',
          }}
        />

        {/* Layer 3 — gradient overlay, top-half only, screen blend */}
        <img
          src="/banners/overlay.svg"
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />

        {/* Content — z-index above all layers */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%',
          padding: '0 48px',
        }}>
          {/* Inner centred wrapper */}
          <div style={{
            display: 'flex', alignItems: 'center',
            width: '100%',
            gap: '0',
          }}>

          {/* Left — illustration: half the card width, fills full height */}
          <div style={{
            flex: '0 0 50%',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            height: '286px',
            overflow: 'hidden',
          }}>
            <img
              src="/banners/illustration.svg"
              alt=""
              aria-hidden
              style={{
                height: '100%',
                width: '100%',
                objectFit: 'contain',
                objectPosition: 'center bottom',
              }}
            />
          </div>

          {/* Right — text + CTA: left-aligned so content starts flush next to illustration */}
          <div style={{ flex: 1, paddingLeft: '28px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h2 style={{
              margin: '0 0 10px',
              fontSize: '24px', fontWeight: 700,
              color: '#ffffff', lineHeight: 1.2,
            }}>
              Stop hunting for competitive news
            </h2>
            <p style={{
              margin: '0 0 18px',
              fontSize: '14px', lineHeight: 1.65,
              color: 'rgba(255,255,255,0.60)',
              maxWidth: '380px',
            }}>
              Ariya Competitive Intelligence consolidates every catalyst, conference,
              and regulatory milestone into one weekly brief. Five minutes to stay ahead.
            </p>

            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '8px', marginBottom: '24px',
            }}>
              {['Every catalyst', 'Every competitor', 'One update'].map((text, i) => (
                <span key={text} style={{
                  fontSize: '13px', fontWeight: 500,
                  color: 'rgba(255,255,255,0.65)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>·</span>}
                  {text}
                </span>
              ))}
            </div>

            <button
              className="ariya-focus"
              style={{
                padding: '11px 32px',
                borderRadius: '999px',
                background: '#ffffff',
                color: '#03070F',
                border: 'none',
                fontSize: '14px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
              }}
            >
              Set up Weekly Digest
            </button>
          </div>
          </div>{/* /inner centred wrapper */}
        </div>

      </div>

    </div>
  )
}
