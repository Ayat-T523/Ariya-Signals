import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, Sparkles, Calendar, Search,
  TrendingDown, TrendingUp, Pencil, Check, GripVertical, X, Plus,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import ConfidenceIndicator from '../components/ui/ConfidenceIndicator'
import alertsData from '../data/alerts.json'
import competitorsData from '../data/competitors.json'
import eventsData from '../data/events.json'
import userData from '../data/user.json'

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date('2026-04-21')
const WEEK_AGO = new Date('2026-04-14')

const SEVERITY_BORDER = {
  high:   '#E11D48',
  medium: '#F59E0B',
  low:    'rgba(5,10,68,0.18)',
}

const SEVERITY_LABEL = {
  high:   { bg: 'rgba(225,29,72,0.10)',  text: '#C01041',           label: 'HIGH' },
  medium: { bg: 'rgba(245,158,11,0.10)', text: '#92500A',           label: 'MED'  },
  low:    { bg: 'rgba(5,10,68,0.06)',    text: 'rgba(5,10,68,0.55)', label: 'LOW'  },
}

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 }

const TYPE_LABEL_BY_KEY = {
  'trial-update':    'Trial Update',
  'exec-move':       'Exec Move',
  'label-change':    'Label Change',
  'label-update':    'Label Update',
  'field-signal':    'Field Signal',
  'strategic-shift': 'Strategic Shift',
  'publication':     'Publication',
  'regulatory':      'Regulatory',
  'earnings':        'Earnings',
  'deal':            'Deal',
  'conference':      'Conference',
}
function typeLabel(t) {
  return TYPE_LABEL_BY_KEY[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '')
}

const POSTURE_STYLE = {
  'Incumbent to displace':           { bg: 'rgba(5,10,68,0.08)',    text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor':        { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Adjacent injectable prophylaxis': { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Emerging direct threat':          { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging gene therapy':           { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging oral competitor':        { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
}

// ── Market weather: competitive-pressure trend ──────────────────────────────
const WINDOW_STATUS_CONFIG = {
  'Pressure building': { bg: 'rgba(225,29,72,0.12)',  text: '#C01041', icon: TrendingDown },
  'Pressure stable':   { bg: 'rgba(245,158,11,0.12)', text: '#92500A', icon: ArrowRight    },
  'Pressure easing':   { bg: 'rgba(16,185,129,0.10)', text: '#065F46', icon: TrendingUp    },
}
const CURRENT_WINDOW_STATUS = 'Pressure building'

const NEEDLE_ITEMS = [
  { competitorId: 'pharvaris',   text: 'RAPIDe-3 primary completion moved Q3 → Q2 2026',           alertId: 'alert-001' },
  { competitorId: 'pharvaris',   text: 'Head of Commercial, US hired',                              alertId: 'alert-002' },
  { competitorId: 'takeda',      text: 'Takhzyro label extended to adolescents 12+ in EU',          alertId: 'alert-026' },
  { competitorId: 'biocryst',    text: 'Q1 HAE net revenue $89M, up 12% YoY',                       alertId: null },
  { competitorId: 'csl-behring', text: 'Andembry formulary access (DE) ahead of schedule',          alertId: null },
]

const IMPLICATION_ITEMS = [
  "Sebetralstat's first-mover window is compressing — plausibly 18 months ahead of Pharvaris rather than 24. Commercial readiness and KOL anchoring should accelerate.",
  "Pediatric expansion across Takhzyro and Andembry creates pressure to clarify Ekterly's pediatric narrative within Q3 to avoid ceding ground in this segment.",
  "Incumbents' defensive posture is softening on tone (BioCryst, CSL) but tightening on access — double down on real-world time-to-relief evidence to support switching conversations.",
]

const ASK_PROMPTS = [
  'Compare Pharvaris vs Ekterly timeline',
  "Summarise Takeda's pediatric narrative",
  'Draft IR talking points',
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function headerTimestamp() {
  const dow = TODAY.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()
  const month = TODAY.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  const day = TODAY.getUTCDate()
  return `${dow} · ${month} ${day} · 18:42 · LAST REFRESH 2 MIN AGO`
}

function relTimeShort(ts) {
  const diffMs = TODAY.getTime() - new Date(ts).getTime()
  const diffH = Math.round(diffMs / (1000 * 60 * 60))
  if (diffH < 24) return `${Math.max(0, diffH)}h`
  return `${Math.round(diffH / 24)}d`
}

function daysUntilLabel(date) {
  const diff = Math.round((new Date(date).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `${Math.abs(diff)}d ago`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}

function dayMonthParts(date) {
  const d = new Date(date)
  return {
    day:   String(d.getUTCDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
  }
}

function competitorById(id) {
  return competitorsData.find((c) => c.id === id)
}

// ── Section card wrapper ─────────────────────────────────────────────────────
function Card({ children, padding = '20px 22px', style }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(5,10,68,0.08)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
      padding,
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: '12px', marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          {title}
        </h2>
        {subtitle && (
          <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>
            {subtitle}
          </span>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

function HeaderLink({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: '12px', fontWeight: 600, color: 'rgba(5,10,68,0.55)',
        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px',
      }}
    >
      {children} <ArrowRight size={11} />
    </Link>
  )
}

// ── KPI tile (compact, 3-up row) ─────────────────────────────────────────────
function KpiTile({ label, value, delta, deltaTone = 'positive', caption, linkTo, linkLabel }) {
  const deltaColor = deltaTone === 'positive' ? '#0E7B5F' : deltaTone === 'negative' ? '#C01041' : 'rgba(5,10,68,0.50)'
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '14px',
      border: '1px solid rgba(5,10,68,0.08)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
      padding: '14px 18px',
      display: 'flex', flexDirection: 'column',
      gap: '4px',
    }}>
      <p style={{
        margin: 0, fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.45)',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{
          fontSize: '26px', fontWeight: 700, color: 'rgba(5,10,68,0.92)',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        }}>
          {value}
        </span>
        {delta && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '2px',
            fontSize: '12px', fontWeight: 600, color: deltaColor,
          }}>
            <ArrowUpRight size={12} />
            {delta}
          </span>
        )}
      </div>
      {caption && (
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
          {caption}
        </p>
      )}
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          style={{
            marginTop: '6px', fontSize: '12px', fontWeight: 600,
            color: '#0055BB', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '3px',
          }}
        >
          {linkLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

// ── Compact alert card ───────────────────────────────────────────────────────
function CompactAlertCard({ alert }) {
  const sevBorder = SEVERITY_BORDER[alert.severity] || SEVERITY_BORDER.low
  const sevLabel  = SEVERITY_LABEL[alert.severity]  || SEVERITY_LABEL.low
  const competitor = competitorById(alert.competitorId)

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '10px',
      border: '1px solid rgba(5,10,68,0.06)',
      borderLeft: `3px solid ${sevBorder}`,
      padding: '12px 14px',
    }}>
      {/* Top row: chips left, age right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '9999px', background: 'rgba(5,10,68,0.06)',
          color: 'rgba(5,10,68,0.60)',
        }}>
          {competitor?.name ?? alert.competitorId}
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '9999px', background: 'rgba(0,85,187,0.08)',
          color: '#0055BB',
        }}>
          {typeLabel(alert.type)}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 7px',
          borderRadius: '9999px', background: sevLabel.bg, color: sevLabel.text,
          letterSpacing: '0.04em',
        }}>
          {sevLabel.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(5,10,68,0.45)', whiteSpace: 'nowrap' }}>
          {relTimeShort(alert.timestamp)}
        </span>
      </div>

      {/* Headline + source */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
        <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'rgba(5,10,68,0.92)', lineHeight: 1.35, flex: 1 }}>
          {alert.headline}
        </p>
        {alert.source && (
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
            {alert.source}
          </span>
        )}
      </div>

      {/* WHY */}
      {alert.whyItMatters && (
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.62)', lineHeight: 1.5 }}>
          <strong style={{
            fontSize: '10px', fontWeight: 700, color: 'rgba(5,10,68,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            WHY —{' '}
          </strong>
          {alert.whyItMatters}
        </p>
      )}
    </div>
  )
}

// ── Compact competitor card ──────────────────────────────────────────────────
function CompactCompetitorCard({ competitor }) {
  const posture = POSTURE_STYLE[competitor.strategicPosture] || { bg: 'rgba(5,10,68,0.06)', text: 'rgba(5,10,68,0.60)' }
  const recent = alertsData
    .filter((a) => a.competitorId === competitor.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
  const lastSignal = recent ? relTimeShort(recent.timestamp) + ' ago' : '—'
  const pipelineCount = (competitor.pipeline || []).length

  return (
    <Link
      to={`/competitors/${competitor.id}`}
      className="hover-lift"
      style={{
        textDecoration: 'none',
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
        padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <CompetitorBadge name={competitor.name} size={32} />
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          {competitor.name}
        </p>
      </div>

      {/* Posture chip */}
      <span style={{
        display: 'inline-block', alignSelf: 'flex-start',
        padding: '2px 10px', borderRadius: '9999px',
        fontSize: '11px', fontWeight: 600,
        background: posture.bg, color: posture.text,
      }}>
        {competitor.strategicPosture}
      </span>

      {/* Description */}
      <p style={{
        margin: 0, fontSize: '12.5px', color: 'rgba(5,10,68,0.60)',
        lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {competitor.executiveSummary}
      </p>

      {/* Footer stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginTop: '4px', paddingTop: '10px',
        borderTop: '1px solid rgba(5,10,68,0.06)',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
            Pipeline
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.85)' }}>
            {pipelineCount} {pipelineCount === 1 ? 'asset' : 'assets'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
            Last signal
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 500, color: 'rgba(5,10,68,0.65)' }}>
            {lastSignal}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ── Upcoming event row ───────────────────────────────────────────────────────
function EventRow({ event, last }) {
  const { day, month } = dayMonthParts(event.date)
  const subtitle = event.expectedTopics?.[0] || event.note || ''
  return (
    <Link
      to={`/intelligence?tab=events&event=${event.id}`}
      style={{
        textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '10px 4px',
        borderBottom: last ? 'none' : '1px solid rgba(5,10,68,0.06)',
      }}
    >
      {/* Date block */}
      <div style={{ textAlign: 'center', minWidth: '36px' }}>
        <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.85)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {day}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)' }}>
          {month}
        </p>
      </div>

      {/* Title + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '13px', fontWeight: 700, color: 'rgba(5,10,68,0.88)',
          lineHeight: 1.35,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {event.title}
        </p>
        {subtitle && (
          <p style={{
            margin: '2px 0 0', fontSize: '11.5px', color: 'rgba(5,10,68,0.50)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Countdown */}
      <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.45)', whiteSpace: 'nowrap' }}>
        {daysUntilLabel(event.date)}
      </span>
    </Link>
  )
}

// ── Customise edit mode — module wrapper ─────────────────────────────────────
const DEFAULT_LAYOUT = { ekterly: true, signals: true, digest: true, competitors: true }
const LAYOUT_STORAGE_KEY = 'ariya-warroom-layout'

function CustomisableModule({ editMode, visible, onRemove, children, style }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'relative',
      outline: editMode ? '2px dashed rgba(0,85,187,0.30)' : 'none',
      outlineOffset: '6px',
      borderRadius: '16px',
      opacity: editMode ? 0.85 : 1,
      transition: 'opacity 150ms ease',
      ...style,
    }}>
      {editMode && (
        <>
          <div
            title="Drag to reorder (preview only)"
            style={{
              position: 'absolute', top: '-14px', left: '-14px',
              width: '26px', height: '26px', borderRadius: '7px',
              background: '#FFFFFF', border: '1px solid rgba(5,10,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(5,10,68,0.40)', cursor: 'grab',
              boxShadow: '0 2px 6px rgba(5,10,68,0.08)', zIndex: 5,
            }}
          >
            <GripVertical size={14} />
          </div>
          <button
            onClick={onRemove}
            style={{
              position: 'absolute', top: '-14px', right: '-14px',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '9999px',
              background: '#FFFFFF', border: '1px solid rgba(5,10,68,0.12)',
              color: 'rgba(5,10,68,0.55)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(5,10,68,0.08)', zIndex: 5,
              fontFamily: 'inherit',
            }}
          >
            <X size={11} /> Remove
          </button>
        </>
      )}
      {children}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function WarRoom() {
  const { unreadCount, readAlerts, openAskModal } = useApp()
  const navigate = useNavigate()

  const [sortMode, setSortMode] = useState('importance')
  const [editMode, setEditMode] = useState(false)
  const [layout, setLayout]     = useState(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (stored) return { ...DEFAULT_LAYOUT, ...JSON.parse(stored) }
    } catch { /* noop */ }
    return DEFAULT_LAYOUT
  })

  const setModuleVisible = (id, visible) => {
    const next = { ...layout, [id]: visible }
    setLayout(next)
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }
  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT)
    try { localStorage.removeItem(LAYOUT_STORAGE_KEY) } catch { /* noop */ }
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  // Top 5 alerts — Importance default, Recency alternative
  const topAlerts = [...alertsData]
    .sort((a, b) => {
      if (sortMode === 'importance') {
        const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
        if (sevDiff !== 0) return sevDiff
        return new Date(b.timestamp) - new Date(a.timestamp)
      }
      const aRead = readAlerts.has(a.id) ? 1 : 0
      const bRead = readAlerts.has(b.id) ? 1 : 0
      if (aRead !== bRead) return aRead - bRead
      return new Date(b.timestamp) - new Date(a.timestamp)
    })
    .slice(0, 5)

  // KPI metrics
  const highUnread = alertsData.filter((a) => a.severity === 'high' && !readAlerts.has(a.id)).length
  const newSinceLastVisit = 3 // illustrative — sessions not actually tracked
  const pharvarisUnread = alertsData.filter((a) => a.competitorId === 'pharvaris' && !readAlerts.has(a.id)).length
  const trackedCompetitorCount = new Set(alertsData.map((a) => a.competitorId)).size
  const trialAlerts      = alertsData.filter((a) => a.type === 'trial-update').length
  const commercialAlerts = alertsData.filter((a) => ['exec-move', 'deal', 'earnings'].includes(a.type)).length

  // Tracked competitors — first 4 (active by recent signals)
  const trackedCompetitorsFour = competitorsData.slice(0, 4)

  // Upcoming events — next 4 (any type)
  const upcomingEvents = [...eventsData]
    .filter((e) => new Date(e.date) >= TODAY)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4)

  // Market weather status config
  const statusCfg = WINDOW_STATUS_CONFIG[CURRENT_WINDOW_STATUS] ?? WINDOW_STATUS_CONFIG['Pressure stable']
  const StatusIcon = statusCfg.icon

  return (
    <div style={{ padding: '20px 32px', maxWidth: '1400px' }}>

      {/* ── Top header: timestamp + greeting + actions ──────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '16px', marginBottom: '20px',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            margin: '0 0 4px', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)',
          }}>
            {headerTimestamp()}
          </p>
          <h1 style={{
            margin: 0, fontSize: '24px', fontWeight: 700,
            color: 'rgba(5,10,68,0.92)', lineHeight: 1.25,
          }}>
            {greeting()}, {userData.user.name}.{' '}
            <span style={{ color: 'rgba(5,10,68,0.55)', fontWeight: 600 }}>
              Here's the state of HAE.
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.50)' }}>
            Ekterly · HAE · {trackedCompetitorCount} tracked competitors · {alertsData.length} signals on file
          </p>
        </div>

        {/* Ask Ariya + Customise buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, paddingTop: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => openAskModal('war-room-header-ask')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '9999px',
                fontSize: '13px', fontWeight: 600,
                background: '#0055BB', color: '#FFFFFF',
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
              Ask Ariya
            </button>
            <button
              onClick={() => setEditMode((v) => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '9999px',
                fontSize: '13px', fontWeight: 600,
                background: editMode ? '#050A44' : 'transparent',
                color: editMode ? '#FFFFFF' : 'rgba(5,10,68,0.65)',
                border: editMode ? '1.5px solid #050A44' : '1.5px solid rgba(5,10,68,0.20)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {editMode ? <><Check size={13} /> Done</> : <><Pencil size={13} /> Customise</>}
            </button>
          </div>
          {editMode && (
            <button
              onClick={resetLayout}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 4px', fontSize: '12px',
                color: 'rgba(5,10,68,0.45)', textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              Reset to default
            </button>
          )}
        </div>
      </div>

      {/* ── 3 KPI tiles ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '14px', marginBottom: '20px',
      }}>
        <KpiTile
          label="New since last visit"
          value={newSinceLastVisit}
          delta="vs yesterday"
          deltaTone="positive"
          caption="Last visit yesterday, 09:14 · 3 unread arrivals"
          linkTo="/alerts"
          linkLabel="Open new arrivals"
        />
        <KpiTile
          label="Unread signals"
          value={unreadCount}
          delta={`${pharvarisUnread} from Pharvaris`}
          deltaTone="neutral"
          caption={`Across ${trackedCompetitorCount} competitors · ${trialAlerts} trial · ${commercialAlerts} commercial`}
          linkTo="/alerts"
          linkLabel="Open inbox"
        />
        <KpiTile
          label="High importance"
          value={highUnread}
          delta="+2 vs last week"
          deltaTone="positive"
          caption="3 demand response · IR follow-up, KOL prep"
          linkTo="/alerts"
          linkLabel="Triage now"
        />
      </div>

      {/* ── 2-column main grid ──────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px',
        gap: '20px', alignItems: 'flex-start',
      }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          {/* Top signals to triage */}
          <CustomisableModule
            editMode={editMode}
            visible={layout.signals}
            onRemove={() => setModuleVisible('signals', false)}
          >
            <Card>
              <CardHeader
                title="Top signals to triage"
                subtitle={`5 shown · ${unreadCount} unread`}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {[
                      { value: 'importance', label: 'Importance' },
                      { value: 'recency',    label: 'Recency' },
                    ].map((opt) => {
                      const on = sortMode === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setSortMode(opt.value)}
                          style={{
                            padding: '4px 10px', borderRadius: '9999px',
                            fontSize: '11px', fontWeight: on ? 700 : 500,
                            background: on ? '#050A44' : 'transparent',
                            color: on ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
                            border: `1.5px solid ${on ? '#050A44' : 'rgba(5,10,68,0.15)'}`,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                    <HeaderLink to="/alerts">Open feed</HeaderLink>
                  </div>
                }
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topAlerts.map((alert) => (
                  <CompactAlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </Card>
          </CustomisableModule>

          {/* Tracked competitors */}
          <CustomisableModule
            editMode={editMode}
            visible={layout.competitors}
            onRemove={() => setModuleVisible('competitors', false)}
          >
            <Card>
              <CardHeader
                title="Tracked competitors"
                subtitle="last 7 days · signal volume"
                right={<HeaderLink to="/competitors">All competitors</HeaderLink>}
              />
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
              }}>
                {trackedCompetitorsFour.map((c) => (
                  <CompactCompetitorCard key={c.id} competitor={c} />
                ))}
              </div>
            </Card>
          </CustomisableModule>

          {/* Ask Ariya panel */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={14} color="#0055BB" />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
                Ask Ariya
              </h2>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '10px',
              background: '#FAFBFE',
              border: '1px solid rgba(5,10,68,0.10)',
              cursor: 'pointer', marginBottom: '12px',
            }}
              onClick={() => openAskModal('war-room-ask-panel')}
            >
              <Search size={14} color="rgba(5,10,68,0.40)" />
              <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
                What changed for Ekterly this week?
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ASK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => openAskModal(`war-room-prompt-${prompt}`)}
                  style={{
                    padding: '6px 12px', borderRadius: '9999px',
                    background: 'rgba(0,85,187,0.06)',
                    color: '#0055BB',
                    border: '1px solid rgba(0,85,187,0.18)',
                    fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          {/* Market weather */}
          <CustomisableModule
            editMode={editMode}
            visible={layout.ekterly}
            onRemove={() => setModuleVisible('ekterly', false)}
          >
            <Card>
              <CardHeader
                title="Market weather · Ekterly"
                right={
                  <span style={{
                    padding: '2px 9px', borderRadius: '9999px',
                    background: 'rgba(5,10,68,0.06)',
                    fontSize: '10px', fontWeight: 700,
                    color: 'rgba(5,10,68,0.55)', letterSpacing: '0.05em',
                  }}>
                    30D
                  </span>
                }
              />

              {/* Pressure status */}
              <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px', borderRadius: '9999px',
                  background: statusCfg.bg, color: statusCfg.text,
                  fontSize: '13px', fontWeight: 700,
                }}>
                  <StatusIcon size={14} strokeWidth={2.5} />
                  {CURRENT_WINDOW_STATUS}
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
                  over the last 30 days
                </span>
              </div>

              {/* What moved this week */}
              <div style={{ marginBottom: '14px' }}>
                <p style={{
                  margin: '0 0 8px', fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.10em',
                  color: 'rgba(5,10,68,0.45)',
                }}>
                  What moved this week
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {NEEDLE_ITEMS.map((item, i) => {
                    const cName = competitorById(item.competitorId)?.name ?? item.competitorId
                    return (
                      <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <span style={{ marginTop: '7px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(5,10,68,0.40)', flexShrink: 0 }} />
                        <span style={{ fontSize: '12.5px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.5 }}>
                          <strong style={{ fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>{cName}</strong>
                          {' — '}{item.text}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Implications */}
              <div>
                <p style={{
                  margin: '0 0 8px', fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.10em',
                  color: 'rgba(5,10,68,0.45)',
                }}>
                  Implications · last 7 days
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {IMPLICATION_ITEMS.map((text, i) => (
                    <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ marginTop: '7px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(5,10,68,0.40)', flexShrink: 0 }} />
                      <span style={{ fontSize: '12.5px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.5 }}>
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer */}
              <div style={{
                marginTop: '14px', paddingTop: '12px',
                borderTop: '1px solid rgba(5,10,68,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '10px',
              }}>
                <Link
                  to="/alerts"
                  style={{
                    fontSize: '12px', fontWeight: 600, color: '#0055BB',
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px',
                  }}
                >
                  Read full assessment <ArrowRight size={11} />
                </Link>
                <ConfidenceIndicator sourceCoverage="high" dataFreshness="high" inferenceDepth="high" />
              </div>
            </Card>
          </CustomisableModule>

          {/* Upcoming events */}
          <Card padding="20px 22px 12px">
            <CardHeader
              title="Upcoming events"
              right={<HeaderLink to="/intelligence?tab=events">All</HeaderLink>}
            />
            <div>
              {upcomingEvents.map((e, i) => (
                <EventRow key={e.id} event={e} last={i === upcomingEvents.length - 1} />
              ))}
            </div>
          </Card>

          {/* Weekly digest */}
          <CustomisableModule
            editMode={editMode}
            visible={layout.digest}
            onRemove={() => setModuleVisible('digest', false)}
          >
            <Card>
              <CardHeader
                title="Your weekly digest"
                right={<HeaderLink to="/myspace/alerts">Configure</HeaderLink>}
              />
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 12px', borderRadius: '8px',
                background: '#FAFBFE',
                border: '1px solid rgba(5,10,68,0.06)',
                marginBottom: '12px',
              }}>
                <Calendar size={12} color="#0055BB" />
                <span style={{ fontSize: '11.5px', color: 'rgba(5,10,68,0.65)' }}>
                  Next delivery <strong style={{ color: 'rgba(5,10,68,0.85)' }}>Monday 07:00</strong> via email
                </span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  'Pharvaris RAPIDe-3 completion date tightened by 6 weeks — oral on-demand window narrows.',
                  'BioCryst Q1 earnings: HAE net revenue $89M, up 12% YoY. Management tone on prophylaxis switching remains cautious.',
                  'CSL Behring confirms Andembry formulary access in Germany ahead of schedule.',
                ].map((text, i) => (
                  <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <span style={{ marginTop: '7px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(5,10,68,0.40)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12.5px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.5 }}>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </CustomisableModule>

        </div>
      </div>

      {/* "+ Add module" placeholder — edit mode only */}
      {editMode && (
        <div style={{
          marginTop: '20px',
          border: '2px dashed rgba(5,10,68,0.18)',
          borderRadius: '16px',
          padding: '24px 20px',
          textAlign: 'center',
          color: 'rgba(5,10,68,0.40)',
          cursor: 'not-allowed',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <Plus size={14} />
            Add module
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(5,10,68,0.32)', fontStyle: 'italic' }}>
            Available in the full version
          </p>
        </div>
      )}

    </div>
  )
}
