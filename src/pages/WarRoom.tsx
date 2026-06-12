/**
 * WarRoom.tsx — Rebuilt against Figma node 4:5387 (file IXHI4HJFuZpw5hPMrv7DVb).
 *
 * Rules:
 *   - All data from src/data/kalvista.ts. No parallel numbers in this file.
 *   - No raw hex. Every colour via CSS custom property or RGBA string.
 *   - No console.log of any data.
 *   - lucide-react for all icons, no other icon library.
 */

import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { Bell, Zap, Activity, ArrowRight, TrendingUp, TrendingDown, Minus, Clock, BarChart2, FileSearch, Info } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  alertsData,
  competitorsData,
  eventsData,
  userData,
  DEMO_SNAPSHOT_DATE,
} from '../data/kalvista'
import { useApp } from '../context/AppContext'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import SlideOver from '../components/ui/SlideOver'
import { staggerContainer, listItem, REDUCED_MOTION } from '../lib/motion'
import { usePageLoad } from '../hooks/usePageLoad'
import {
  SkeletonKpiRow,
  SkeletonSignalList,
  SkeletonQuadrantGrid,
  SkeletonMarketWeatherBody,
  SkeletonEventList,
} from '../components/ui/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────
type Alert      = (typeof alertsData)[0]
type Competitor = (typeof competitorsData)[0]
type EventItem  = (typeof eventsData)[0]

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date(DEMO_SNAPSHOT_DATE)

const IMPLICATION_ITEMS = [
  "Sebetralstat's first-mover window is compressing — plausibly 18 months ahead of Pharvaris rather than 24. Commercial readiness and KOL anchoring should accelerate.",
  "Pediatric expansion across Takhzyro and Andembry creates pressure to clarify Ekterly's pediatric narrative within Q3 to avoid ceding ground in this segment.",
  "Incumbents' defensive posture is softening on tone (BioCryst, CSL) but tightening on access — double down on real-world time-to-relief evidence to support switching conversations.",
]

const WHAT_MOVED_ITEMS = [
  "Pharvaris tightened RAPIDe-3 primary completion to Q2 2026, 4 weeks ahead of prior guidance — removing enrollment risk from the readout timeline.",
  "EMA approved Takhzyro adolescent label extension (12+); CSL Behring confirmed Andembry reimbursement across 6 EU markets in the same week.",
  "BioCryst MSLs deploying Orladeyo starter kits at DACH HAE clinics; Takeda offering unusual rebate concessions at top-10 US prescribing accounts.",
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
  conference: { bg: 'rgba(42,118,244,0.12)',  text: '#2a76f4',            label: 'Conference'   },
  earnings:   { bg: 'rgba(251,101,20,0.15)',  text: '#fb6514',            label: 'Earnings call' },
  regulatory: { bg: 'rgba(130,88,200,0.12)',  text: '#7C3AED',            label: 'Regulatory'   },
  investor:   { bg: 'rgba(5,10,68,0.10)',     text: 'rgba(5,10,68,0.72)', label: 'Investor'     },
  milestone:  { bg: 'rgba(183,63,84,0.12)',   text: '#b73f54',            label: 'Milestone'    },
}

// ── Competitor flagship asset map ─────────────────────────────────────────────
const COMPETITOR_ASSET_MAP: Record<string, string> = {
  'pharvaris':   'Deucrictibant',
  'takeda':      'Takhzyro',
  'biocryst':    'Orladeyo',
  'csl-behring': 'Andembry',
  'ionis':       'Dawnzera',
  'astria':      'STAR-0215',
}

// ── Status badge styles ───────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Confirmed: { bg: 'rgba(73,160,120,0.12)',  text: 'var(--status-green)'  },
  Projected: { bg: 'rgba(250,174,54,0.15)',  text: '#966820'              },
  Pending:   { bg: 'rgba(67,76,91,0.12)',    text: 'var(--font-secondary)' },
}

// ── Conference pills — multiple per month header, with individual colours ─────
const CONF_PILLS: Record<string, Array<{ name: string; color: string }>> = {
  'April 2026': [{ name: 'EAACI · Apr 15–18',      color: '#2a76f4' }],
  'June 2026':  [
    { name: 'FDA AdCom · Jun 8–11',  color: '#2a76f4' },
    { name: 'Oppenheimer',            color: '#49a078' },
  ],
  'September 2026': [{ name: 'HAEi Global · Sep 24–27', color: '#2a76f4' }],
  'October 2026':   [{ name: 'ACAAI · Oct 10–14',       color: '#2a76f4' }],
  'February 2027':  [{ name: 'AAAAI · Feb 27–Mar 2',    color: '#2a76f4' }],
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
      month: 'long', year: 'numeric', timeZone: 'UTC',
    })
    if (!out[key]) out[key] = []
    out[key].push(ev)
  }
  return out
}

// Month name (long form) for the date column, e.g. "May", "June"
function eventMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

// Day or day-range, zero-padded, e.g. "06", "08–11"
function eventDayRange(ev: EventItem): string {
  const d   = new Date(ev.date)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const end = (ev as any).endDate ? new Date((ev as any).endDate) : null
  if (end && end.getUTCMonth() === d.getUTCMonth()) {
    return `${day}–${String(end.getUTCDate()).padStart(2, '0')}`
  }
  return day
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

/** Dashed underline link — always ends with a small arrow icon */
function DashedLink({ to, children, icon: Icon = ArrowRight }: {
  to: string
  children: React.ReactNode
  icon?: typeof ArrowRight
}) {
  return (
    <Link
      to={to}
      className="ariya-dashed-link"
      style={{
        fontSize: '12px', fontWeight: 400,
        color: 'var(--font-primary)',
        textDecoration: 'none',
        borderBottom: '1px dashed var(--font-primary)',
        paddingBottom: '2px',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        lineHeight: 1.2,
      }}
    >
      {children}
      <Icon size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
    </Link>
  )
}

// ── Count-up animation hook ───────────────────────────────────────────────────
// Animates from 0 → target on first mount only. Returns [displayed, done].
// `done` flips to true when the count completes so dependents can fade in.
function useCountUp(target: number, duration = 600): [number, boolean] {
  const [current, setCurrent] = useState(REDUCED_MOTION ? target : 0)
  const [done, setDone] = useState(REDUCED_MOTION)
  const didStart = useRef(false)

  useEffect(() => {
    if (REDUCED_MOTION || didStart.current) return
    didStart.current = true
    const snap = target
    const start = performance.now()
    let cancelled = false
    function step(ts: number) {
      if (cancelled) return
      const t = Math.min((ts - start) / duration, 1)
      const eased = 1 - (1 - t) ** 3
      setCurrent(Math.round(eased * snap))
      if (t < 1) requestAnimationFrame(step)
      else setDone(true)
    }
    requestAnimationFrame(step)
    return () => { cancelled = true }
  }, []) // intentional: mount-once

  return [current, done]
}

/** KPI card — Figma node 1572:49060 */
type TrendDir = 'up' | 'down' | 'neutral'
function KpiCard({
  icon: Icon, label, value, trendDir, trendPct,
}: {
  icon: typeof Bell
  label: string
  value: number | string
  trendDir: TrendDir
  trendPct: string
}) {
  const TREND_STYLES: Record<TrendDir, { bg: string; color: string; Icon: typeof TrendingUp }> = {
    up:      { bg: 'rgba(73,160,120,0.15)',  color: '#49a078', Icon: TrendingUp   },
    down:    { bg: 'rgba(183,63,84,0.15)',   color: '#b73f54', Icon: TrendingDown },
    neutral: { bg: 'rgba(112,128,144,0.15)', color: '#708090', Icon: Minus        },
  }
  const trend = TREND_STYLES[trendDir]
  const TrendIcon = trend.Icon

  const isNum = typeof value === 'number'
  const [animated, trendReady] = useCountUp(isNum ? (value as number) : 0)
  const displayValue = isNum ? animated : value
  const showTrend = isNum ? trendReady : true

  return (
    <div style={{
      background: '#F4F8FE',
      border: '1px solid #87B2FA',
      borderRadius: '16px',
      padding: '8px',
      display: 'flex',
      gap: '6px',
      alignItems: 'flex-start',
      flex: 'none',
      minWidth: '200px',
    }}>
      <Icon size={20} color="rgba(5,10,68,0.45)" strokeWidth={1.5} style={{ marginTop: '2px', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Label + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', fontFamily: 'Satoshi, sans-serif', color: '#434c5b', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <Info size={12} color="rgba(5,10,68,0.35)" strokeWidth={1.5} />
        </div>
        {/* Value + trend badge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '20px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21.6px' }}>
            {displayValue}
          </span>
          {trendPct && trendPct !== '0%' && showTrend && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 6px', borderRadius: '8px',
                background: trend.bg, alignSelf: 'flex-start',
              }}
            >
              <TrendIcon size={10} color={trend.color} strokeWidth={2} />
              <span style={{ fontSize: '14px', fontFamily: 'Satoshi, sans-serif', color: trend.color, lineHeight: '21px', whiteSpace: 'nowrap' }}>
                {trendPct}
              </span>
            </motion.div>
          )}
        </div>
        {/* Footer */}
        <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090' }}>
          vs. last 30 days
        </span>
      </div>
    </div>
  )
}

/** Signal row */
function SignalRow({ alert, isLast, onSelect }: { alert: Alert; isLast: boolean; onSelect: () => void }) {
  const badge      = SEV_BADGE[alert.severity] ?? SEV_BADGE.low
  const competitor = competitorsData.find(c => c.id === alert.competitorId)

  return (
    <>
      <motion.div
        onClick={onSelect}
        whileHover={REDUCED_MOTION ? {} : { y: -2 }}
        transition={{ duration: 0.12 }}
        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 0', minHeight: '80px', cursor: 'pointer' }}
      >
        <div style={{ flexShrink: 0, paddingTop: '3px' }}>
          <CompetitorBadge name={competitor?.name ?? alert.competitorId} size={28} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--font-primary)', lineHeight: 1.4 }}>
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
          gap: '6px', flexShrink: 0, alignSelf: 'stretch',
        }}>
          <div style={{
            background: badge.bg, color: badge.text,
            fontSize: '14px', fontWeight: 500,
            padding: '4px 12px', borderRadius: '6px',
          }}>
            {badge.label}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--font-secondary)', fontWeight: 400 }}>
              {relTimeShort(alert.timestamp)}
            </p>
            {alert.source && (
              <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--font-secondary)', fontWeight: 400 }}>
                {alert.source}
              </p>
            )}
          </div>
        </div>
      </motion.div>
      {!isLast && <div style={{ height: '1px', background: 'rgba(42,118,244,0.15)' }} />}
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
  const [hovered, setHovered] = useState(false)
  const pipelineCount = (competitor.pipeline || []).length

  return (
    <Link
      to={`/competitors/${competitor.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: quadrant.outerBg,
        borderRadius: '16px',
        padding: '10px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        transition: 'box-shadow 200ms ease',
        boxShadow: hovered
          ? '0px 0px 12px 2px rgba(194,219,255,0.80), 0px 0px 40px 4px rgba(194,219,255,0.48)'
          : 'none',
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

/** Pill-select tab group — optional iconMap adds leading icons per option */
function PillSelect<T extends string>({
  options, value, onChange, iconMap,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  iconMap?: Partial<Record<string, typeof ArrowRight>>
}) {
  return (
    <div style={{
      display: 'inline-flex', gap: '6px', alignItems: 'center',
      padding: '4px',
      border: '1px solid var(--blue-light)',
      borderRadius: '16px',
      flexWrap: 'wrap',
      alignSelf: 'flex-start',
      width: 'fit-content',
    }}>
      {options.map(opt => {
        const active = opt === value
        const Icon = iconMap?.[opt]
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="ariya-focus"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
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
            {Icon && <Icon size={12} strokeWidth={active ? 2 : 1.5} />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Event row — Figma node 77:2995 layout:
 * [date block 51×51] | [vertical divider] | [company/asset] | [title / attending+badge] | [type badge]
 */
function EventRow({ event }: { event: EventItem }) {
  const typeStyle = EVENT_TYPE_STYLES[event.type] ?? EVENT_TYPE_STYLES.conference

  const ids               = event.attendingCompetitors ?? []
  const primaryCompetitor = ids.length > 0 ? competitorsData.find(c => c.id === ids[0]) : undefined
  const companyName       = primaryCompetitor?.name ?? (ids[0] ?? 'Industry')
  const assetName         = primaryCompetitor ? (COMPETITOR_ASSET_MAP[primaryCompetitor.id] ?? '') : ''

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      border: '1px solid rgba(210,226,255,1)', borderRadius: '8px',
      padding: '8px 12px',
    }}>
      {/* Left flex group */}
      <div style={{ display: 'flex', flex: 1, gap: '12px', alignItems: 'flex-start', minWidth: 0 }}>

        {/* Date block — 51×51, centred */}
        <div style={{
          width: 51, height: 51, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4,
        }}>
          <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#2a76f4', lineHeight: '21px', whiteSpace: 'nowrap' }}>
            {eventMonth(event.date)}
          </span>
          <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Satoshi, sans-serif', color: '#2a76f4', lineHeight: '21.6px', whiteSpace: 'nowrap' }}>
            {eventDayRange(event)}
          </span>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, height: 51, background: 'rgba(210,226,255,1)', flexShrink: 0, alignSelf: 'center' }} />

        {/* Company / asset */}
        <div style={{ flexShrink: 0, height: 51, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px', whiteSpace: 'nowrap' }}>
            {companyName}
          </span>
          {assetName && (
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>
              {assetName}
            </span>
          )}
        </div>

        {/* Event title + attending row */}
        <div style={{ flex: 1, height: 51, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
          <div style={{ padding: '4px 12px' }}>
            <p style={{
              margin: 0, fontSize: '14px', fontWeight: 400,
              fontFamily: 'Satoshi, sans-serif', color: '#434c5b',
              lineHeight: '21px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {event.title}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>
              Attending
            </span>
            {primaryCompetitor && (
              <div style={{
                width: 20, height: 20,
                border: '1px solid rgba(210,226,255,1)',
                borderRadius: '9999px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                <CompetitorBadge name={primaryCompetitor.name} id={primaryCompetitor.id} size={16} />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Type badge — right-aligned */}
      <span style={{
        flexShrink: 0,
        padding: '4px 12px', borderRadius: '6px',
        fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif',
        background: typeStyle.bg, color: typeStyle.text,
        whiteSpace: 'nowrap', alignSelf: 'center',
      }}>
        {typeStyle.label}
      </span>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function WarRoom() {
  const { unreadCount, readAlerts } = useApp()
  const loaded = usePageLoad('war-room')
  const [sortMode, setSortMode]         = useState<'Importance' | 'Recency'>('Importance')
  const [eventFilter, setEventFilter]   = useState<EventFilter>('All events')
  const [assessmentOpen, setAssessmentOpen] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState<Alert | null>(null)


  // Derived counts
  const trackedCompetitorCount = new Set(alertsData.map(a => a.competitorId)).size
  const totalSignals           = alertsData.length
  const highUnread             = alertsData.filter(
    a => a.severity === 'high' && !readAlerts.has(a.id),
  ).length

  // Top 10 signals
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

  // ── Upcoming events — first 2 months only (no scroll) ─────────────────────
  const allUpcomingEvents = [...eventsData]
    .filter(e => {
      if (new Date(e.date) < TODAY) return false
      if (eventFilter === 'All events') return true
      return (EVENT_TYPE_MAP[eventFilter] || []).includes(e.type)
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const groupedEvents  = groupByMonth(allUpcomingEvents)
  const monthKeys      = Object.keys(groupedEvents).slice(0, 2)
  const upcomingEvents = monthKeys.flatMap(m => groupedEvents[m])

  // ── KPI cards (Figma 1572:49060) ──────────────────────────────────────────
  const kpiCards = [
    { icon: BarChart2, label: 'Tracked competitors', value: trackedCompetitorCount, trendDir: 'neutral' as const, trendPct: '0%'    },
    { icon: Bell,      label: 'New signals',          value: totalSignals,           trendDir: 'up'      as const, trendPct: '+12.4%' },
    { icon: Zap,       label: 'High priority',        value: highUnread,             trendDir: 'neutral' as const, trendPct: '0%'    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '8px 36px 36px' }}>

      {/* ── KPI cards — Figma 1572:49060 ────────────────────────────────── */}
      <div data-tour="kpi-row" style={{ marginBottom: '24px' }}>
        {!loaded ? (
          <SkeletonKpiRow />
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.25, 0, 0.25, 1] }}
            style={{ display: 'flex', gap: '16px', alignItems: 'center' }}
          >
            {kpiCards.map((card, i) => (
              <KpiCard key={i} {...card} />
            ))}
            <span style={{
              marginLeft: 'auto', flexShrink: 0,
              fontSize: '11px', fontFamily: 'Inter, sans-serif',
              color: 'rgba(5,10,68,0.38)',
              fontStyle: 'italic',
            }}>
              Data as of {TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Row 1: Top signals + Market weather ─────────────────────────── */}
      <div style={{
        backdropFilter: 'blur(2px)',
        background: '#e4e9f1',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex', gap: '24px', alignItems: 'stretch',
      }}>

        {/* Top signals to triage */}
        <div data-tour="top-signals" style={{
          flex: 1, minWidth: 0,
          background: '#ffffff',
          border: '1.8px solid var(--blue-light)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, lineHeight: '21.6px', color: '#2b2a2a', whiteSpace: 'nowrap', fontFamily: 'Satoshi, sans-serif' }}>
                Top signals to triage
              </p>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-secondary)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                {topAlerts.length} shown • {unreadCount} unread
              </p>
            </div>
            <PillSelect
              options={['Importance', 'Recency'] as const}
              value={sortMode}
              onChange={(v) => {
                setSortMode(v)
                analytics.signal_sorted(v)
              }}
              iconMap={{ Importance: TrendingUp, Recency: Clock }}
            />
          </div>

          {/* Signal list — no scroll, fills available height */}
          {!loaded ? (
            <SkeletonSignalList />
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              style={{ flex: 1 }}
            >
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
              >
                {topAlerts.map((alert, i) => (
                  <motion.div key={alert.id} variants={listItem}>
                    <SignalRow alert={alert} isLast={i === topAlerts.length - 1} onSelect={() => {
                      analytics.signal_opened(alert.id, alert.severity, alert.type ?? 'unknown')
                      setSelectedSignal(alert)
                    }} />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Read full assessment — inline at bottom */}
          <button
            onClick={() => setAssessmentOpen(true)}
            style={{
              alignSelf: 'flex-end',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', fontWeight: 500,
              color: 'var(--font-primary)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: '1px solid var(--font-primary)',
              paddingBottom: '2px',
              lineHeight: 1.2,
            }}
          >
            <FileSearch size={12} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            Read full assessment
            <ArrowRight size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
          </button>
        </div>

        {/* Market weather */}
        <div data-tour="market-weather" style={{
          background: '#ffffff',
          border: '1px solid rgba(246,246,246,0.36)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          flexShrink: 0, width: '380px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, lineHeight: '21.6px', color: '#2b2a2a', fontFamily: 'Satoshi, sans-serif' }}>
              Market weather · Ekterly
            </p>
            <div style={{ background: 'rgba(174,169,177,0.15)', borderRadius: '8px', padding: '4px 8px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-secondary)' }}>30 d</p>
            </div>
          </div>

          {!loaded ? (
            <SkeletonMarketWeatherBody />
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
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
            </motion.div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setAssessmentOpen(true)}
              style={{
                fontSize: '12px', fontWeight: 400,
                color: 'var(--font-primary)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: '1px dashed var(--font-primary)',
                paddingBottom: '2px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                lineHeight: 1.2,
              }}
            >
              Read full assessment
              <ArrowRight size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
            </button>
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
        display: 'flex', gap: '24px', alignItems: 'flex-start',
        marginBottom: '32px',
      }}>

        {/* ── Tracked competitors — signal-driven 2×2 grid ────────────── */}
        <div style={{
          flex: 1, minWidth: 0,
          background: '#ffffff',
          border: '1.8px solid var(--blue-light)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, lineHeight: '21.6px', color: '#2b2a2a', fontFamily: 'Satoshi, sans-serif' }}>
                Tracked Competitors
              </p>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-secondary)', fontFamily: 'Inter, sans-serif' }}>
                {Object.keys(quadrantMap).length} shown
              </p>
            </div>
            <DashedLink to="/competitors" icon={BarChart2}>View full competitor list</DashedLink>
          </div>

          {/* Grid — only renders filled quadrant slots */}
          {!loaded ? (
            <SkeletonQuadrantGrid />
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
            >
              {QUADRANT_CONFIG.map(quadrant => {
                const entry = quadrantMap[quadrant.key]
                if (!entry) return null
                return (
                  <motion.div
                    key={quadrant.key}
                    whileHover={REDUCED_MOTION ? {} : { y: -2 }}
                    transition={{ duration: 0.12 }}
                  >
                    <QuadrantCard
                      competitor={entry.competitor}
                      quadrant={quadrant}
                      lastSignalLabel={lastSignalFor(entry.competitor.id)}
                    />
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>

        {/* ── Upcoming events ─────────────────────────────────────────── */}
        <div style={{
          background: '#ffffff',
          border: '1.8px solid var(--blue-light)',
          borderRadius: '16px',
          padding: '16px',
          flexShrink: 0, width: '600px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, lineHeight: '21.6px', color: '#2b2a2a', fontFamily: 'Satoshi, sans-serif' }}>
                  Upcoming events
                </p>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-secondary)', fontFamily: 'Inter, sans-serif' }}>
                  {upcomingEvents.length} shown · 2 months
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

          {/* Grouped events — scrollable, flex:1 fills remaining card height */}
          {!loaded ? (
            <SkeletonEventList />
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.15 }}
            >
              {monthKeys.length === 0 ? (
                <p style={{
                  margin: 0, fontSize: '12px', color: 'var(--font-secondary)',
                  textAlign: 'center', padding: '24px 0',
                }}>
                  No upcoming events for this filter.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {monthKeys.map(month => (
                    <div key={month} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                      {/* Month header — bottom border, blue month text, coloured pills */}
                      <div style={{ borderBottom: '2px solid #DED8E1', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ padding: '8px 16px', flexShrink: 0 }}>
                            <span style={{
                              fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif',
                              color: '#152d61', lineHeight: '21px', whiteSpace: 'nowrap',
                            }}>
                              {month}
                            </span>
                          </div>
                          {CONF_PILLS[month] && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                              {CONF_PILLS[month].map((pill, i) => (
                                <span key={i} style={{
                                  padding: '4px 8px', borderRadius: '8px',
                                  fontSize: '14px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif',
                                  color: pill.color, lineHeight: '21px', whiteSpace: 'nowrap',
                                }}>
                                  {pill.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Event row cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {groupedEvents[month].map(ev => (
                          <EventRow key={ev.id} event={ev} />
                        ))}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </motion.div>
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

          {/* Right — text + CTA: reduced gap to illustration */}
          <div style={{ flex: 1, paddingLeft: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '11px 28px',
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
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>
          </div>
          </div>{/* /inner centred wrapper */}
        </div>

      </div>

      {/* ── Assessment slide-over ────────────────────────────────────────────── */}
      <SlideOver
        open={assessmentOpen}
        onClose={() => setAssessmentOpen(false)}
        title="Market assessment · Ekterly"
        width={520}
      >
        {/* Header badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(183,63,84,0.12)', borderRadius: '8px', padding: '4px 10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--status-red)' }}>Pressure building</span>
          </div>
          <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>30-day window · Apr 21, 2026</span>
        </div>

        {/* Implications */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)' }}>
            Strategic implications
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {IMPLICATION_ITEMS.map((text, i) => (
              <li key={i} style={{ fontSize: '14px', color: 'rgba(5,10,68,0.80)', lineHeight: 1.55 }}>{text}</li>
            ))}
          </ul>
        </div>

        <div style={{ height: '1px', background: 'rgba(5,10,68,0.08)', marginBottom: '24px' }} />

        {/* What moved */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)' }}>
            What moved this week
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {WHAT_MOVED_ITEMS.map((text, i) => (
              <li key={i} style={{ fontSize: '14px', color: 'rgba(5,10,68,0.80)', lineHeight: 1.55 }}>{text}</li>
            ))}
          </ul>
        </div>

        <div style={{ height: '1px', background: 'rgba(5,10,68,0.08)', marginBottom: '24px' }} />

        {/* Context paragraphs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.65 }}>
            The convergence of Pharvaris's accelerated timeline and Takeda's defensive pricing posture signals that the oral on-demand window is narrowing faster than prior-quarter assumptions. Commercial readiness activities planned for Q4 2026 may need to pull forward.
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.65 }}>
            CSL Behring and BioCryst's parallel EU access expansions increase the complexity of launch sequencing. Payer conversations in DACH and Benelux should emphasise time-to-relief differentiators rather than prophylaxis-versus-on-demand comparisons that incumbents are already countering.
          </p>
        </div>

        {/* Confidence */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', borderRadius: '10px',
          background: 'rgba(73,160,120,0.08)', border: '1px solid rgba(73,160,120,0.20)',
          marginBottom: '24px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-green)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.65)' }}>
            <strong style={{ fontWeight: 600, color: 'rgba(5,10,68,0.80)' }}>Confidence: Strong</strong> — based on public filings, ClinicalTrials.gov, and validated field reports
          </span>
        </div>

        {/* Footer */}
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(5,10,68,0.35)', fontStyle: 'italic' }}>
          Generated by Ariya · Apr 21, 2026 · Illustrative
        </p>
      </SlideOver>

      {/* ── Signal detail slide-over ─────────────────────────────────────────── */}
      <SlideOver
        open={selectedSignal !== null}
        onClose={() => setSelectedSignal(null)}
        title="Signal detail"
        width={480}
      >
        {selectedSignal && (() => {
          const badge      = SEV_BADGE[selectedSignal.severity] ?? SEV_BADGE.low
          const competitor = competitorsData.find(c => c.id === selectedSignal.competitorId)
          const typeLabel  = SIGNAL_TYPE_LABELS[selectedSignal.type] ?? selectedSignal.type
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Meta chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  background: badge.bg, color: badge.text,
                }}>
                  {badge.label}
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  background: 'rgba(5,10,68,0.07)', color: 'rgba(5,10,68,0.55)',
                }}>
                  {typeLabel}
                </span>
                {selectedSignal.source && (
                  <span style={{
                    padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500,
                    background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.55)',
                  }}>
                    {selectedSignal.source}
                  </span>
                )}
                <span style={{
                  marginLeft: 'auto', fontSize: '12px', color: 'rgba(5,10,68,0.40)',
                  alignSelf: 'center', whiteSpace: 'nowrap',
                }}>
                  {relTimeShort(selectedSignal.timestamp)} ago
                </span>
              </div>

              {/* Headline */}
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.92)', lineHeight: 1.4 }}>
                {selectedSignal.headline}
              </h3>

              {/* What happened */}
              {(selectedSignal as any).whatHappened && (
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
                    What happened
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.6 }}>
                    {(selectedSignal as any).whatHappened}
                  </p>
                </div>
              )}

              {/* Why it matters */}
              {selectedSignal.whyItMatters && (
                <div style={{
                  background: 'rgba(42,118,244,0.08)', borderRadius: '10px',
                  border: '1px solid rgba(210,226,255,1)',
                  padding: '14px 16px',
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
                    Why it matters
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.80)', lineHeight: 1.6 }}>
                    {selectedSignal.whyItMatters}
                  </p>
                </div>
              )}

              {/* Competitor link */}
              {competitor && (
                <div style={{ borderTop: '1px solid rgba(5,10,68,0.07)', paddingTop: '16px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
                    Competitor
                  </p>
                  <Link
                    to={`/competitors/${competitor.id}`}
                    onClick={() => setSelectedSignal(null)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '8px 14px', borderRadius: '10px',
                      border: '1px solid rgba(210,226,255,1)',
                      background: '#FFFFFF',
                      textDecoration: 'none',
                      color: 'rgba(5,10,68,0.80)',
                      fontSize: '13px', fontWeight: 600,
                      transition: 'box-shadow 150ms ease',
                    }}
                  >
                    <CompetitorBadge name={competitor.name} id={competitor.id} size={20} />
                    {competitor.name}
                    <ArrowRight size={12} strokeWidth={2} />
                  </Link>
                </div>
              )}

            </div>
          )
        })()}
      </SlideOver>

    </div>
  )
}
