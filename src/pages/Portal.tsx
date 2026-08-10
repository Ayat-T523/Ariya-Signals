import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText, TrendingUp,
  MapPin, Users, ChevronRight, ChevronDown,
  Mic, DollarSign, FlaskConical, Landmark, Star, AlertCircle, Crosshair,
  FileSearch, ArrowRight, Link2, ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import ProvenanceChip from '../components/ui/ProvenanceChip'
import { usePageLoad } from '../hooks/usePageLoad'
import { SkeletonPortalList } from '../components/ui/Skeleton'
import FilterDropdown from '../components/ui/FilterDropdown'
import TimelineStrip from '../components/ui/TimelineStrip'
import { CAL_COMPS, type CalCell } from '../components/ui/KeyCatalystsCalendar'
import { competitorsData, eventsData, marketDevelopments as marketData } from '../data/kalvista'
import { buildSourceLabel } from '../lib/transformers'
import { tierOf, sourceNameOf, resolveCuratedSourceName, type AttributionTier } from '../lib/deterministic/provenance'
import { THEMES, themeOf, type Theme } from '../lib/deterministic/facets'
import { importanceBreakdown, compareByImportance, bandToLegacyTier } from '../lib/deterministic/importance'
import { SEVERITY_LABEL } from './WarRoom'
import { formatDateAbs } from '../utils/formatDate'
import { DEMO } from '../config/demo-config'
import { useApp, useConfig } from '../context/AppContext'
import { getRegulatoryCalendar, getRecentSignals, getTrialsForCalendarYear, type DbRegulatoryCalendarEvent, type DbRecentSignal } from '../lib/db'
import { trialsToCalendarCells } from '../lib/trialsToGantt'

// ── Reference date ────────────────────────────────────────────────────────────
const TODAY = new Date()

// ── Theme mapping (shape brief, confirmed) ────────────────────────────────────
//
// Every item on this feed is assigned a canonical signal_type so themeOf/arcOf/
// importanceBreakdown score it exactly as a live company_signals row would. Only
// company_signals rows carry a real signal_type; the other three sources this
// page draws from (static conference/earnings events, the live EMA regulatory
// calendar, live trial records) don't, so each is mapped to the signal_type it
// is closest to in kind, confirmed with the product owner. 'advocacy' below was
// the one genuinely uncertain call in that confirmation, not a confident read.
const EVENT_TYPE_TO_SIGNAL_TYPE: Record<string, string> = {
  conference: 'congress_abstract',
  earnings:   'press_release',
  investor:   'press_release',
  regulatory: 'regulatory_catalyst',
  milestone:  'trial_update',
}

const MARKET_TYPE_TO_SIGNAL_TYPE: Record<string, string> = {
  guideline:            'hta_decision',
  epidemiology:         'publication',
  advocacy:             'publication', // least-bad fit; flag if this reads wrong live
  payer:                'hta_decision',
  deal:                 'deal',
  hta:                  'hta_decision',
  'launch-performance':  'press_release',
}

/** One item on the unified feed, tagged for theme grouping and importance sort. */
interface FeedEntry {
  id: string
  date: string
  signalType: string
  theme: Theme | null
  kind: 'event' | 'market'
  raw: any
}

/** A minimal ScorableSignal for compareByImportance/importanceBreakdown. */
function scorable(entry: Pick<FeedEntry, 'signalType' | 'date'>): { signal_type: string; date: string; date_precision: null } {
  return { signal_type: entry.signalType, date: entry.date, date_precision: null }
}

/**
 * Group feed entries by Theme (canonical THEMES order, empty sections omitted),
 * sorted within each theme by the deterministic importance score. This is the
 * same arc-then-recency ordering WarRoom and MyAlerts already use — Theme
 * groups, importance orders within the group, matching the arc/theme split
 * PRODUCT.md already defines.
 */
function groupByTheme(entries: FeedEntry[]): Array<{ theme: Theme; entries: FeedEntry[] }> {
  const byTheme = new Map<Theme, FeedEntry[]>()
  for (const entry of entries) {
    if (!entry.theme) continue // unresolvable theme: honestly omitted, never guessed
    if (!byTheme.has(entry.theme)) byTheme.set(entry.theme, [])
    byTheme.get(entry.theme)!.push(entry)
  }
  return THEMES
    .filter((theme) => byTheme.has(theme))
    .map((theme) => ({
      theme,
      entries: byTheme.get(theme)!.sort((a, b) =>
        compareByImportance(scorable(a), scorable(b), { today: TODAY })
      ),
    }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function competitorName(id) {
  return competitorsData.find((c) => c.id === id)?.name ?? id
}

function isQualityHeadline(h: string | null): boolean {
  if (!h || h.length <= 20) return false
  if (/^[a-z]{2,6}-\d{8}/i.test(h)) return false
  return /[A-Z].*[a-z]{4,}/.test(h)
}

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
}


function isPast(dateStr) {
  const d = new Date(dateStr)
  return d < TODAY
}

// Find a post-event digest: report.competitorId in event.attendingCompetitors AND
// report.date within 7 days AFTER event.date. Returns the earliest match (or null).
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// findDigestForEvent removed with the Earnings Filings tab: the digests it
// attached to past events came from reports.json, every record of which is
// isIllustrative. Illustrative content does not ship in the live product, and an
// absent digest is an honest absence.

// §4-1: auto-generated "CI significance" removed. Templated interpretation
// ("Monitor for positioning shifts", "reshapes the competitive landscape") is a
// paid-tier function. The free tier shows events factually (title, date,
// attendees); a hand-authored note (event.note) is still surfaced as-is.
function buildCISignificance(_event: any, _indication: string): string | null {
  return null
}

/**
 * Regulatory why-relevant/actionable-follow-up context. Chips are the default
 * display (§ card-content consistency pass); the full sentence each chip set
 * was drawn from survives as a hover tooltip, so compressing to chips loses no
 * information. Chips only exist for content that is either a fixed, small
 * template enum (the 3 live EMA committee-subtype cases below) or authored
 * per-record by a human curator (ciContext.whyChips/actionableChips on a
 * curated events.json entry) — never derived from free ingested text, which
 * would mean extracting keywords from prose no one wrote as tags.
 */
interface RegulatoryContext {
  whyRelevant: string
  actionableFollowUp: string
  whyChips: string[]
  actionableChips: string[]
}

function buildRegulatoryContext(event: any): RegulatoryContext | null {
  if (event.type !== 'regulatory') return null
  // Authored ciContext takes priority — fail-safe: only use when both fields present
  const ctx = (event as any).ciContext
  if (ctx?.whyRelevant && ctx?.actionableFollowUp) {
    return {
      whyRelevant: ctx.whyRelevant,
      actionableFollowUp: ctx.actionableFollowUp,
      // Curated records authored before this pass may not carry chip tags yet;
      // fall back to the sentence itself as a single chip rather than hiding it.
      whyChips: ctx.whyChips ?? [ctx.whyRelevant],
      actionableChips: ctx.actionableChips ?? [ctx.actionableFollowUp],
    }
  }
  // Live EMA calendar events: template from committee subtype
  if ((event as any)._isLive) {
    const sub: string = (event as any)._emaSubtype ?? ''
    if (sub === 'CHMP') return {
      whyRelevant: 'CHMP plenaries set the EU regulatory calendar. Decisions here affect HAE competitor approvals, label changes, and opinion renewals.',
      actionableFollowUp: 'Check EMA post-meeting outcomes for any HAE or angioedema INN mentions. Update competitor regulatory timelines if a new opinion is adopted.',
      whyChips: ['Sets EU regulatory calendar', 'Affects competitor approvals & labels'],
      actionableChips: ['Check post-meeting outcomes', 'Update timelines on new opinions'],
    }
    if (sub === 'PRAC') return {
      whyRelevant: 'PRAC meetings review post-market safety signals. A safety concern for an HAE competitor could shift prescribing behaviour or trigger label changes.',
      actionableFollowUp: 'Review PRAC meeting highlights for any HAE-class safety referrals. Flag to medical affairs if a competitor product is under review.',
      whyChips: ['Reviews post-market safety signals', 'Could shift prescribing or labels'],
      actionableChips: ['Review safety referrals', 'Flag to medical affairs'],
    }
    return {
      whyRelevant: 'This EMA agenda item references an HAE-relevant term, indicating it may affect competitor products or the treatment landscape.',
      actionableFollowUp: 'Review the published EMA meeting agenda for full context. Escalate to medical affairs if this relates to a direct competitor product.',
      whyChips: ['HAE-relevant EMA agenda item'],
      actionableChips: ['Review agenda', 'Escalate if competitor-relevant'],
    }
  }
  return null
}

// ── Event type config ─────────────────────────────────────────────────────────
// Display-config lookups. Typed as Record<string, …> rather than as literals
// because every read indexes them with a value that came from data and pairs the
// lookup with a fallback, so a string key is the honest signature.
type ChipCfg   = { label: string; bg: string; text: string; icon?: LucideIcon }
type SwatchCfg = { bg: string; text: string }
type CardCfg   = { label: string; labelColor: string; outerBg: string }
type Annotation = { expect: string; surprise: string }

const EVENT_TYPE: Record<string, ChipCfg> = {
  conference: { label: 'Conference', icon: Users,       bg: 'rgba(42,118,244,0.09)',   text: '#2A76F4'            },
  earnings:   { label: 'Earnings',   icon: DollarSign,  bg: 'rgba(16,34,74,0.07)',    text: 'rgba(16,34,74,0.55)' },
  regulatory: { label: 'Regulatory', icon: Landmark,    bg: 'rgba(16,185,129,0.10)', text: '#065F46'            },
  investor:   { label: 'Investor',   icon: TrendingUp,  bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
  milestone:  { label: 'Milestone',  icon: Star,        bg: 'rgba(225,29,72,0.10)',  text: '#C01041'            },
}

// ── Report type config ────────────────────────────────────────────────────────
const REPORT_TYPE: Record<string, ChipCfg> = {
  'earnings-call':    { label: 'Earnings call',    bg: 'rgba(16,34,74,0.07)',    text: 'rgba(16,34,74,0.55)', icon: Mic },
  'investor-day':     { label: 'Investor day',     bg: 'rgba(139,92,246,0.10)', text: '#5B21B6',            icon: TrendingUp },
  'analyst-report':   { label: 'Analyst report',   bg: 'rgba(245,158,11,0.10)', text: '#92500A',            icon: FileText },
  'earnings-digest':  { label: 'Earnings digest',  bg: 'rgba(42,118,244,0.10)',   text: '#2A76F4',            icon: FileText },
}

// ── Market type config ─────────────────────────────────────────────────────────
const MARKET_TYPE: Record<string, ChipCfg> = {
  guideline:            { label: 'Guideline',         bg: 'rgba(16,185,129,0.10)', text: '#065F46'            },
  epidemiology:         { label: 'Epidemiology',       bg: 'rgba(42,118,244,0.09)',   text: '#2A76F4'            },
  advocacy:             { label: 'Advocacy',           bg: 'rgba(245,158,11,0.10)', text: '#92500A'            },
  payer:                { label: 'Payer',              bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
  deal:                 { label: 'Deal',               bg: 'rgba(42,118,244,0.09)',   text: '#2A76F4'            },
  hta:                  { label: 'HTA decision',       bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
  'launch-performance': { label: 'Launch Performance', bg: 'rgba(210,226,255,0.50)', text: '#2A76F4'           },
}

// ── Deal type config ──────────────────────────────────────────────────────────
const DEAL_TYPE_CFG: Record<string, SwatchCfg> = {
  'Manufacturing': { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
  'Distribution':  { bg: 'rgba(42,118,244,0.09)',   text: '#2A76F4' },
  'M&A':           { bg: 'rgba(245,158,11,0.10)', text: '#92500A' },
  'Co-promote':    { bg: 'rgba(139,92,246,0.10)', text: '#5B21B6' },
  'Licensing':     { bg: 'rgba(42,118,244,0.09)',   text: '#2A76F4' },
}

// ── HTA status badge config ───────────────────────────────────────────────────
const HTA_STATUS_CFG: Record<string, SwatchCfg> = {
  'Under review':           { bg: 'rgba(250,174,54,0.15)',  text: '#FAAE36' },
  'Horizon scan':           { bg: 'rgba(250,174,54,0.15)',  text: '#FAAE36' },
  'Approved':               { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
  'Restricted':             { bg: 'rgba(245,158,11,0.10)', text: '#92500A' },
  'Framework update':       { bg: 'rgba(16,34,74,0.07)',    text: 'rgba(16,34,74,0.55)' },
  'Approved with discount': { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
}

// ── Signal card config ────────────────────────────────────────────────────────
const SIGNAL_CARD_CFG: Record<string, CardCfg> = {
  guideline:            { label: 'Guideline',          labelColor: '#10224A',  outerBg: 'rgba(16,34,74,0.15)'    },
  epidemiology:         { label: 'Epidemiology',        labelColor: '#2A76F4',  outerBg: 'rgba(42,118,244,0.09)'    },
  advocacy:             { label: 'Advocacy',            labelColor: '#B99CFC',  outerBg: 'rgba(185,156,252,0.30)' },
  'launch-performance': { label: 'Launch Performance',  labelColor: '#2A76F4',  outerBg: 'rgba(42,118,244,0.15)'  },
  payer:                { label: 'Payer',               labelColor: '#7C3AED',  outerBg: 'rgba(139,92,246,0.10)'  },
}

const SIGNAL_FILTER_TABS = [
  { value: 'all',                label: 'All'               },
  { value: 'guideline',          label: 'Guidelines'        },
  { value: 'epidemiology',       label: 'Epidemiology'      },
  { value: 'advocacy',           label: 'Advocacy'          },
  { value: 'launch-performance', label: 'Launch performance' },
]

const SIGNAL_ITEM_TYPES = new Set(['guideline', 'epidemiology', 'advocacy', 'launch-performance'])

// ── Leadership-priority annotations ──────────────────────────────────────────
const LEADERSHIP_TYPES = new Set(['conference', 'earnings', 'regulatory', 'investor', 'milestone'])

const LEADERSHIP_ANNOTATIONS: Record<string, Annotation> = {
  conference: {
    expect:   'Headline presentations centered on real-world evidence and dosing convenience narratives.',
    surprise: 'Unanticipated head-to-head efficacy data, new MoA claims, or unexpected competitor-led positioning.',
  },
  earnings: {
    expect:   'Franchise revenue commentary consistent with prior guidance; routine pipeline updates.',
    surprise: 'Material guidance changes, pipeline reprioritization, or deal announcements.',
  },
  regulatory: {
    expect:   'Decision aligned with prior CHMP/FDA signals; standard label scope.',
    surprise: 'Broader-than-expected indication, accelerated pathway, or restrictive label conditions.',
  },
  investor: {
    expect:   'Pipeline prioritisation updates, revised trial timelines, and pre-launch commercial strategy framing.',
    surprise: 'Unannounced partnership, licensing deal, M&A signal, or indication expansion beyond current programme.',
  },
  milestone: {
    expect:   'Data readout or regulatory filing consistent with prior signal; analyst reaction expected within 24 hours.',
    surprise: 'Statistically unexpected result, safety signal, or strategic redirect on the development path.',
  },
}

// Key Catalysts Calendar (month × competitor heatmap) moved to its own shared
// component, src/components/ui/KeyCatalystsCalendar.tsx, so both this page and
// WarRoom.tsx can render it — it's landscape-scoped (all watched competitors),
// so per the IA reference doc it belongs under War Room's "what is coming"
// zone, not here.

// ── Shared components ─────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      margin: '0 0 10px', fontSize: '12px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color: 'rgba(16,34,74,0.60)',
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
      fontSize: '12px', fontWeight: 700,
      background: cfg.bg, color: cfg.text,
    }}>
      {Icon && <Icon size={10} />}
      {cfg.label}
    </span>
  )
}

// ── KPI countdown helpers ─────────────────────────────────────────────────────
function daysUntil(dateStr) {
  const diff = new Date(dateStr).getTime() - TODAY.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function KpiCountdownCard({ event }) {
  const days = daysUntil(event.date)
  const typeCfg = EVENT_TYPE[event.type] || { label: event.type, bg: 'rgba(16,34,74,0.07)', text: 'rgba(16,34,74,0.55)', icon: null }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Crosshair size={14} color='var(--font-secondary)' />
        <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--font-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {days}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--font-secondary)', fontWeight: 400, alignSelf: 'flex-end', paddingBottom: '5px' }}>days</span>
      </div>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', lineHeight: '1.3' }}>
        {event.title}
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)' }}>
        {typeCfg.label}
      </p>
    </div>
  )
}

function KpiDealCard({ deal }) {
  if (!deal) return null
  const displayValue = deal.dealKpiDisplay ?? deal.dealValue ?? '—'
  const unit = deal.dealKpiUnit ?? null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Crosshair size={14} color='var(--font-secondary)' />
        <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--font-primary)', lineHeight: 1 }}>
          {displayValue}
        </span>
        {unit && (
          <span style={{ fontSize: '14px', color: 'var(--font-secondary)', fontWeight: 400, alignSelf: 'flex-end', paddingBottom: '5px' }}>
            {unit}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', lineHeight: '1.3' }}>
        {(deal.parties || []).join(' × ')}
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)' }}>
        Deal
      </p>
    </div>
  )
}

// TabBar removed: Events and Market Developments merged into one theme-grouped
// feed (shape brief), so there is no second view left to switch between.

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: EVENTS
// ──────────────────────────────────────────────────────────────────────────────

// ── Week calendar strip ───────────────────────────────────────────────────────
function WeekStrip({ selectedDate, onDateSelect, allEvents }: {
  selectedDate: string | null
  onDateSelect: (d: string | null) => void
  allEvents: Array<{ date: string; type: string }>
}) {
  const MS       = 86400000
  const start    = new Date(TODAY.getTime() - 3 * MS)
  const DAY_LTRS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const todayStr = TODAY.toISOString().substring(0, 10)
  const stripRef = useRef<HTMLDivElement>(null)

  // date → first event type on that day (includes live calendar events)
  const eventMap = new Map<string, string>()
  allEvents.forEach((e) => {
    const key = e.date.substring(0, 10)
    if (!eventMap.has(key)) eventMap.set(key, e.type)
  })

  const days = Array.from({ length: 90 }, (_, i) => {
    const d   = new Date(start.getTime() + i * MS)
    const str = d.toISOString().substring(0, 10)
    return { date: d, str }
  })

  const groups: { name: string; days: typeof days }[] = []
  days.forEach(day => {
    const name = day.date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
    const last = groups[groups.length - 1]
    if (!last || last.name !== name) groups.push({ name, days: [day] })
    else last.days.push(day)
  })

  // Vibrant badge backgrounds for the 20×20 date-strip dot
  // (EVENT_TYPE.bg uses rgba at 7–10% — too transparent to read at small size)
  const STRIP_BADGE_BG: Record<string, string> = {
    conference: '#DBEAFE',  // blue-100
    earnings:   '#E2E8F0',  // slate-200
    regulatory: '#D1FAE5',  // green-100
    investor:   '#EDE9FE',  // violet-100
    milestone:  '#FFE4E6',  // rose-100
  }

  // Centre today in the strip on mount
  useEffect(() => {
    const container = stripRef.current
    if (!container) return
    const todayEl = container.querySelector('[data-today="true"]') as HTMLElement | null
    if (todayEl) {
      const offset = todayEl.offsetLeft - container.clientWidth / 2 + todayEl.offsetWidth / 2
      container.scrollLeft = Math.max(0, offset)
    }
  }, [])

  return (
    <div
      ref={stripRef}
      className="hide-scrollbar"
      style={{ overflowX: 'auto', overflowY: 'hidden', padding: '6px 4px 10px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
        {groups.map((group, gi) => (
          <div key={group.name} style={{ display: 'flex', alignItems: 'flex-start' }}>
            {gi > 0 && (
              <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(16,34,74,0.12)', margin: '0 8px', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Month label — left-aligned, sticky on horizontal scroll */}
              <span style={{
                position: 'sticky', left: '4px', zIndex: 1,
                display: 'block',
                fontSize: '14px', fontWeight: 700,
                fontFamily: 'Satoshi, sans-serif',
                color: '#434c5b', lineHeight: '20px',
                whiteSpace: 'nowrap', paddingRight: '8px',
              }}>
                {group.name}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {group.days.map(({ date, str }) => {
                  const isToday    = str === todayStr
                  const isSelected = str === selectedDate
                  const isPast     = str < todayStr
                  const evtType    = eventMap.get(str)
                  const typeCfg    = evtType ? EVENT_TYPE[evtType] : null
                  const EventIcon  = typeCfg?.icon ?? null
                  const letter     = DAY_LTRS[date.getUTCDay()]
                  const num        = String(date.getUTCDate()).padStart(2, '0')
                  const fullDateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
                  return (
                    <div
                      key={str}
                      data-today={isToday ? 'true' : undefined}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={isToday ? `${fullDateLabel} (today)` : fullDateLabel}
                      onClick={() => onDateSelect(isSelected ? null : str)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDateSelect(isSelected ? null : str) }
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        padding: isToday ? '8px 4px' : '6px 4px',
                        borderRadius: '12px',
                        height: isToday ? '100px' : '91px',
                        width: isToday ? '52px' : '42px',
                        border: isSelected ? '1.5px solid #2A76F4' : isToday ? '1.5px solid rgba(16,34,74,0.22)' : '1px solid rgba(210,226,255,1)',
                        background: isSelected ? 'rgba(42,118,244,0.08)' : isToday ? '#f0f5ff' : '#ffffff',
                        opacity: isPast && !isToday && !isSelected ? 0.3 : 1,
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        boxShadow: isToday ? '0 4px 14px rgba(16,34,74,0.14), 0 2px 4px rgba(16,34,74,0.08)' : 'none',
                        transition: 'border 120ms ease, background 120ms ease',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: isSelected ? '#2A76F4' : '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>
                        {letter}
                      </span>
                      <div style={{
                        width: isToday ? '36px' : '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '4px', borderRadius: '8px',
                        background: isSelected ? '#2A76F4' : isToday ? '#10224a' : 'rgba(112,128,144,0.15)',
                      }}>
                        <span style={{
                          display: 'block', width: '100%',
                          fontSize: isToday ? '14px' : '13px',
                          fontFamily: 'Satoshi, sans-serif',
                          fontWeight: isToday || isSelected ? 700 : 500,
                          color: isSelected || isToday ? '#ffffff' : '#434c5b',
                          lineHeight: isToday ? '21px' : '19px',
                          textAlign: 'center',
                        }}>
                          {num}
                        </span>
                      </div>
                      {typeCfg && EventIcon && evtType && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: STRIP_BADGE_BG[evtType] ?? typeCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <EventIcon size={10} color={typeCfg.text} strokeWidth={2} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EventCard({ event, pastVariant, cardRef, flashing, showAnnotations, signalType }: {
  event: any; pastVariant?: boolean; cardRef?: (node: HTMLDivElement | null) => void
  flashing?: boolean; showAnnotations?: boolean
  /** Canonical signal_type for importance scoring (theme mapping, §layout step). */
  signalType?: string
}) {
  const { indication } = useConfig()
  const past = Boolean(pastVariant)
  // Importance badge: same score WarRoom/MyAlerts already compute, reusing their
  // exact SEVERITY_LABEL colors rather than inventing a second visual language
  // for "this matters" on this page.
  const band = signalType
    ? bandToLegacyTier(importanceBreakdown({ signal_type: signalType, date: event.date, date_precision: null }, { today: TODAY }).band)
    : null
  const sevCfg = band ? SEVERITY_LABEL[band] : null
  const isMultiDay = Boolean(event.endDate)
  const dateLabel = isMultiDay
    ? `${formatDateAbs(event.date)} – ${formatDateAbs(event.endDate)}`
    : formatDateAbs(event.date)
  const locationStr = event.location && event.location !== 'Virtual'
    ? ` · ${event.location}`
    : event.location === 'Virtual' ? ' · Virtual' : ''
  const typeCfg = EVENT_TYPE[event.type] || { label: event.type, bg: 'rgba(16,34,74,0.07)', text: 'rgba(16,34,74,0.55)', icon: null }
  const TypeIcon = typeCfg.icon
  const noteText = (event as any).note ?? null
  const annotations = showAnnotations ? (LEADERSHIP_ANNOTATIONS[event.type] ?? null) : null
  const ciSignificance = buildCISignificance(event, indication)
  const regulatoryCtx = buildRegulatoryContext(event)
  const durationDays = isMultiDay
    ? Math.round((new Date(event.endDate).getTime() - new Date(event.date).getTime()) / 86400000) + 1
    : null
  const isVirtualLoc = /^(Virtual|Online|Broadcast)$/i.test(((event as any).location ?? '').trim())
  const sourceUrl    = (event as any).sourceUrl ?? null
  const showSource   = Boolean(sourceUrl && (event as any).sourceType !== 'illustrative')
  // §4.7: name the publisher (EAACI, Company IR, NICE) rather than linking to a
  // generic "Source", which tells the reader nothing about who said it.
  const sourceName   = resolveCuratedSourceName((event as any).sourceType, sourceUrl)

  return (
    <div
      ref={cardRef}
      style={{
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        opacity: past ? 0.65 : 1,
        background: flashing ? 'rgba(42,118,244,0.04)' : 'transparent',
        transition: 'background 350ms ease',
        scrollMarginTop: '80px',
      }}
    >
      {/* Row 1: type pill (left) + live/illustrative badge + date/location (right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 9px', borderRadius: '9999px',
            fontSize: '12px', fontWeight: 700,
            background: typeCfg.bg, color: typeCfg.text,
            whiteSpace: 'nowrap',
          }}>
            {TypeIcon && <TypeIcon size={10} />}
            {typeCfg.label}
          </span>
          {sevCfg && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 700,
              background: sevCfg.bg, color: sevCfg.text,
              whiteSpace: 'nowrap',
            }}>
              {sevCfg.label}
            </span>
          )}
          {(event as any)._isLive && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 700,
              background: 'rgba(16,185,129,0.12)', color: '#065F46',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }} />
              EMA
            </span>
          )}
          {(event as any).sourceType === 'illustrative' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 700,
              background: 'rgba(245,158,11,0.12)', color: '#92400E',
              whiteSpace: 'nowrap',
            }}>
              Illustrative
            </span>
          )}
          {durationDays && durationDays > 1 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 600,
              background: 'rgba(16,34,74,0.07)', color: 'rgba(16,34,74,0.60)',
              whiteSpace: 'nowrap',
            }}>
              {durationDays}-day event
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: 'var(--font-secondary)', whiteSpace: 'nowrap' }}>
            {dateLabel}{isVirtualLoc ? '' : locationStr}
          </span>
          {showSource && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontSize: '12px', fontWeight: 500, color: 'rgba(16,34,74,0.60)',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#2A76F4')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(16,34,74,0.45)')}
            >
              {sourceName ?? 'View source'} <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Row 2: title */}
      <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--font-primary)', lineHeight: '1.4' }}>
        {event.title}
        {past && <span style={{ marginLeft: '6px', fontSize: '12px', fontWeight: 400, color: 'rgba(16,34,74,0.60)' }}>(past)</span>}
      </p>

      {/* Row 2b: CI significance — only when no note is present */}
      {ciSignificance && (
        <p style={{ margin: 0, fontSize: '14px', color: 'rgba(16,34,74,0.60)', lineHeight: '1.55' }}>
          {ciSignificance}
        </p>
      )}

      {/* Row 3: Attending badges */}
      {event.attendingCompetitors?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--font-secondary)', fontWeight: 500 }}>Attending</span>
          {event.attendingCompetitors.map((id) => (
            <CompetitorBadge key={id} name={competitorName(id)} size={18} />
          ))}
        </div>
      )}

      {/* Row 4: Expected topics */}
      {event.expectedTopics?.length > 0 && (
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(16,34,74,0.60)' }}>
            Expected topics
          </p>
          <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
            {event.expectedTopics.map((topic, i) => (
              <li key={i} style={{ fontSize: '14px', lineHeight: '1.55', color: 'var(--font-primary)' }}>{topic}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Row 4b: Regulatory context — why relevant + actionable follow up, as
          chips (§ card-content consistency pass). Each chip group carries the
          full original sentence as a title tooltip, so nothing is lost versus
          the prior two-paragraph layout — only the default, scannable view
          changes. */}
      {regulatoryCtx && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <div style={{ flex: 1, minWidth: 0 }} title={regulatoryCtx.whyRelevant}>
            <p style={{ margin: '0 0 3px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(16,34,74,0.60)' }}>
              Why this is relevant
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {regulatoryCtx.whyChips.map((chip, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 9px', borderRadius: '9999px',
                  fontSize: '12px', fontWeight: 500, lineHeight: '1.4',
                  background: 'rgba(42,118,244,0.08)', color: '#2A76F4',
                }}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }} title={regulatoryCtx.actionableFollowUp}>
            <p style={{ margin: '0 0 3px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(16,34,74,0.60)' }}>
              Actionable follow up
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {regulatoryCtx.actionableChips.map((chip, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 9px', borderRadius: '9999px',
                  fontSize: '12px', fontWeight: 500, lineHeight: '1.4',
                  background: 'rgba(16,34,74,0.08)', color: '#10224A',
                }}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Row 5: Note (event.note only) */}
      {noteText && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '6px',
          padding: '6px 10px', borderRadius: '6px',
          background: 'rgba(42,118,244,0.08)',
        }}>
          <AlertCircle size={12} color='#2A76F4' style={{ marginTop: '3px', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: '#2A76F4', lineHeight: '1.5' }}>
            {noteText}
          </span>
        </div>
      )}

      {/* Row 6: Leadership annotations — only in leadership priority view */}
      {annotations && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: '8px', background: 'rgba(42,118,244,0.10)' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, lineHeight: '18px', color: 'var(--font-primary)' }}>What we expect:</p>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 400, lineHeight: '18px', color: 'var(--font-primary)' }}>{annotations.expect}</p>
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: '8px', background: 'rgba(16,34,74,0.08)' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, lineHeight: '18px', color: 'var(--font-primary)' }}>What would surprise us:</p>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 400, lineHeight: '18px', color: 'var(--font-primary)' }}>{annotations.surprise}</p>
          </div>
        </div>
      )}

      {/* Post-event digest link */}

    </div>
  )
}

// Event type is carried by the labeled type chip inside EventCard (colour, icon,
// and word together) — it does not need a second encoding on the card edge.

// ── Compact "Feed row" density ────────────────────────────────────────────────
//
// §5 card DNA for this page calls for a distinct, denser row: left importance
// accent, headline, full provenance, no interpretive paragraph — never the
// full Thread-card fidelity EventCard/MarketDevCard render. Band is carried by
// the HIGH/MED/LOW pill rather than a literal colored left border: a solid
// side accent is a named AI-generated-UI tell (design hook, side-tab rule),
// and it would only be repeating what the pill already says legibly. No Theme
// chip per row either: the section header already carries theme, so repeating
// it per card would just be redundant weight at this density. No Relation
// badge (direct/indirect): the only candidate data, competitors.json's
// 8-value strategicPosture field, is an editorial category ("Emerging oral
// competitor", "Adjacent injectable prophylaxis"), not a real binary —
// building one would mean inventing a judgment call this product does not
// make.
//
// Metadata that only deals/HTA-payer items and attendee/topic-bearing events
// carry (parties, deal value, agency/outcome, attending badges, expected
// topics) has no other home in the product yet (the Entity view that's meant
// to own per-asset detail isn't built), so nothing is dropped: rows that carry
// it get a click-to-expand affordance that reveals the existing full
// EventCard/MarketDevCard beneath the compact line, reusing their rendering
// as-is rather than duplicating that logic a second time.

/** Index of the first entry worth auto-expanding as a hint, or -1 if none. */
function firstExpandableIndex(entries: FeedEntry[], showAnnotations: boolean): number {
  return entries.findIndex((e) => feedRowHasMore(e, showAnnotations))
}

/** Whether this entry has content beyond the compact line worth expanding for. */
function feedRowHasMore(entry: FeedEntry, showAnnotations: boolean): boolean {
  if (entry.kind === 'event') {
    const raw = entry.raw as any
    if ((raw.attendingCompetitors?.length ?? 0) > 0) return true
    if ((raw.expectedTopics?.length ?? 0) > 0) return true
    if (raw.note) return true
    if (buildRegulatoryContext(raw)) return true
    if (showAnnotations && LEADERSHIP_ANNOTATIONS[raw.type]) return true
    return false
  }
  const item = entry.raw as any
  if (item.summary) return true
  if (item.type === 'deal' || item.type === 'hta' || item.type === 'payer') return true
  return false
}

/** Fields shared by every visual density (row, tile, …) rendered from a FeedEntry. */
function feedEntryFields(entry: FeedEntry) {
  const isEvent = entry.kind === 'event'
  const raw = entry.raw as any
  const headline: string = isEvent ? raw.title : raw.headline
  const isIllustrative = raw.sourceType === 'illustrative'
  const isLive = Boolean(raw._isLive)
  const rawSourceUrl: string | null = isEvent ? (raw.sourceUrl ?? null) : (raw._sourceUrl ?? raw.sourceUrl ?? null)
  const sourceUrl = isIllustrative ? null : rawSourceUrl
  const sourceLabel: string | null = isEvent
    ? (isLive ? 'EMA' : resolveCuratedSourceName(raw.sourceType, sourceUrl))
    : (raw._sourceLabel ?? resolveCuratedSourceName(raw.sourceType, sourceUrl))
  const lastRefreshed: string | null = isEvent ? null : (raw._lastRefreshed ?? null)
  const tier = tierOf(entry.signalType)
  const band = bandToLegacyTier(
    importanceBreakdown({ signal_type: entry.signalType, date: entry.date, date_precision: null }, { today: TODAY }).band
  )
  return { isEvent, raw, headline, isIllustrative, isLive, sourceUrl, sourceLabel, lastRefreshed, tier, sevCfg: SEVERITY_LABEL[band] }
}

function FeedRow({ entry, cardRef, flashing, showAnnotations, defaultExpanded }: {
  entry: FeedEntry
  cardRef: (node: HTMLDivElement | null) => void
  flashing: boolean
  showAnnotations: boolean
  /** Opened on first render as a discoverability hint — the row still collapses on click. */
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)

  useEffect(() => {
    if (flashing) setExpanded(true)
  }, [flashing])

  const hasMore = feedRowHasMore(entry, showAnnotations)
  const past = new Date(entry.date) < TODAY
  const { isEvent, raw, headline, isIllustrative, isLive, sourceUrl, sourceLabel, lastRefreshed, tier, sevCfg } = feedEntryFields(entry)

  function toggle() {
    if (hasMore) setExpanded((v) => !v)
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '8px',
        overflow: 'hidden',
        opacity: past && !expanded ? 0.75 : 1,
        scrollMarginTop: '80px',
      }}
    >
      <div
        role={hasMore ? 'button' : undefined}
        tabIndex={hasMore ? 0 : undefined}
        aria-expanded={hasMore ? expanded : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (hasMore && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle() }
        }}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '10px 14px',
          cursor: hasMore ? 'pointer' : 'default',
          background: flashing ? 'rgba(42,118,244,0.06)' : 'transparent',
          transition: 'background 350ms ease',
        }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginTop: '2px',
          padding: '2px 8px', borderRadius: '9999px',
          fontSize: '12px', fontWeight: 700,
          background: sevCfg.bg, color: sevCfg.text,
          whiteSpace: 'nowrap',
        }}>
          {sevCfg.label}
        </span>

        {/* No truncation: the full headline always renders, wrapping to as
            many lines as it needs, rather than clipping with an ellipsis. */}
        <p style={{
          flex: 1, minWidth: 0, margin: 0,
          fontSize: '14px', fontWeight: 600, color: 'var(--font-primary)',
          fontFamily: 'Satoshi, sans-serif', lineHeight: '1.4',
        }}>
          {headline}
        </p>

        {isIllustrative && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginTop: '2px',
            padding: '2px 8px', borderRadius: '9999px',
            fontSize: '12px', fontWeight: 700,
            background: 'rgba(245,158,11,0.12)', color: '#92400E',
            whiteSpace: 'nowrap',
          }}>
            Illustrative
          </span>
        )}

        <div style={{ flexShrink: 0, marginTop: '2px' }} onClick={(e) => e.stopPropagation()}>
          {(sourceUrl || sourceLabel) ? (
            <ProvenanceChip
              sourceLabel={sourceLabel ?? (sourceUrl ? 'View source' : '')}
              sourceUrl={sourceUrl}
              date={entry.date}
              tier={tier}
              lastRefreshed={lastRefreshed}
              isLive={isLive}
            />
          ) : (
            <span style={{ fontSize: '12px', color: 'rgba(16,34,74,0.60)', whiteSpace: 'nowrap', fontFamily: 'Satoshi, sans-serif' }}>
              {formatDateAbs(entry.date)}
            </span>
          )}
        </div>

        {hasMore && (
          <ChevronDown
            size={14}
            style={{
              flexShrink: 0, marginTop: '4px', color: 'rgba(16,34,74,0.60)',
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
          />
        )}
      </div>

      {expanded && hasMore && (
        <div style={{ borderTop: '1px solid rgba(16,34,74,0.08)' }}>
          {isEvent ? (
            <EventCard
              event={raw}
              pastVariant={past}
              showAnnotations={showAnnotations}
              signalType={entry.signalType}
            />
          ) : (
            <MarketDevCard item={raw} signalType={entry.signalType} />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Grid-density comparison tile (§ nested-grid discussion). Same data adapter
 * as FeedRow (feedEntryFields, feedRowHasMore) — only the shell differs: a
 * fixed-height tile with a 3-line clamped headline instead of a single
 * truncated line. An expanded tile spans the full grid width (gridColumn:
 * '1 / -1') rather than rendering the full EventCard/MarketDevCard squeezed
 * into a ~220px column.
 */
function FeedTile({ entry, cardRef, flashing, showAnnotations, defaultExpanded }: {
  entry: FeedEntry
  cardRef: (node: HTMLDivElement | null) => void
  flashing: boolean
  showAnnotations: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)

  useEffect(() => {
    if (flashing) setExpanded(true)
  }, [flashing])

  const hasMore = feedRowHasMore(entry, showAnnotations)
  const past = new Date(entry.date) < TODAY
  const { isEvent, raw, headline, isIllustrative, isLive, sourceUrl, sourceLabel, lastRefreshed, tier, sevCfg } = feedEntryFields(entry)

  function toggle() {
    if (hasMore) setExpanded((v) => !v)
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '8px',
        overflow: 'hidden',
        opacity: past && !expanded ? 0.75 : 1,
        scrollMarginTop: '80px',
        gridColumn: expanded ? '1 / -1' : undefined,
      }}
    >
      <div
        role={hasMore ? 'button' : undefined}
        tabIndex={hasMore ? 0 : undefined}
        aria-expanded={hasMore ? expanded : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (hasMore && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle() }
        }}
        style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          padding: '12px 14px',
          // No fixed height: the tile grows to fit the full headline rather
          // than clamping it, so nothing is ever hidden by default.
          cursor: hasMore ? 'pointer' : 'default',
          background: flashing ? 'rgba(42,118,244,0.06)' : 'transparent',
          transition: 'background 350ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', flexShrink: 0,
            padding: '2px 8px', borderRadius: '9999px',
            fontSize: '12px', fontWeight: 700,
            background: sevCfg.bg, color: sevCfg.text,
            whiteSpace: 'nowrap',
          }}>
            {sevCfg.label}
          </span>
          {isIllustrative && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 700,
              background: 'rgba(245,158,11,0.12)', color: '#92400E',
              whiteSpace: 'nowrap',
            }}>
              Illustrative
            </span>
          )}
          {hasMore && (
            <ChevronDown
              size={14}
              style={{
                flexShrink: 0, marginLeft: 'auto', color: 'rgba(16,34,74,0.60)',
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 150ms ease',
              }}
            />
          )}
        </div>

        {/* No truncation: full headline always renders, tile grows to fit. */}
        <p style={{
          margin: 0,
          fontSize: '14px', fontWeight: 600, color: 'var(--font-primary)',
          fontFamily: 'Satoshi, sans-serif', lineHeight: '1.4',
        }}>
          {headline}
        </p>

        <div onClick={(e) => e.stopPropagation()}>
          {(sourceUrl || sourceLabel) ? (
            <ProvenanceChip
              sourceLabel={sourceLabel ?? (sourceUrl ? 'View source' : '')}
              sourceUrl={sourceUrl}
              date={entry.date}
              tier={tier}
              lastRefreshed={lastRefreshed}
              isLive={isLive}
            />
          ) : (
            <span style={{ fontSize: '12px', color: 'rgba(16,34,74,0.60)', whiteSpace: 'nowrap', fontFamily: 'Satoshi, sans-serif' }}>
              {formatDateAbs(entry.date)}
            </span>
          )}
        </div>
      </div>

      {expanded && hasMore && (
        <div style={{ borderTop: '1px solid rgba(16,34,74,0.08)' }}>
          {isEvent ? (
            <EventCard
              event={raw}
              pastVariant={past}
              showAnnotations={showAnnotations}
              signalType={entry.signalType}
            />
          ) : (
            <MarketDevCard item={raw} signalType={entry.signalType} />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The unified, theme-grouped Intelligence Feed body.
 *
 * Replaces the old EventsTab/MarketTab split. Every item from all four
 * sources (static events.json, the live EMA regulatory calendar, static
 * market-developments.json, and now the FULL live company_signals set — see
 * the fix in Portal()'s fetch below) is tagged with a canonical signal_type,
 * grouped into THEMES-ordered sections, and sorted within each section by the
 * same deterministic importance score WarRoom/MyAlerts already use.
 *
 * WeekStrip (date filter) and the optional catalyst-calendar heatmap remain
 * page-level widgets over the whole unified list, not tied to either former
 * tab. The "leadership priority" annotation toggle survives unchanged; it is
 * an orthogonal display option, not a competing organizing facet, so it was
 * never one of the ad hoc filters Theme grouping supersedes.
 */
function IntelligenceFeedBody({ liveCalendarEvents, liveTrialCells, liveSignals }: {
  liveCalendarEvents: DbRegulatoryCalendarEvent[]
  liveTrialCells: Record<string, Record<number, CalCell>>
  liveSignals: DbRecentSignal[]
}) {
  const { watchedCompetitors } = useApp()
  const [searchParams]  = useSearchParams()
  const eventFromUrl    = searchParams.get('event')
  const [viewFilter, setViewFilter]       = useState('all')
  // Grid prototype (§ nested-grid discussion) — a comparison toggle, not a
  // shipped decision. List stays the default per the reading-measure trade-off
  // flagged against the grid; this exists so it can be judged live, side by
  // side, against real data rather than a mockup.
  const [density, setDensity]             = useState<'list' | 'grid'>('list')
  const [flashedId, setFlashedId]         = useState<string | null>(null)
  // Past signals default to collapsed behind a "Recent" fold in any section
  // that also has upcoming ones — the whole point is that what's still ahead
  // shouldn't compete for attention with what's already happened. Themes in
  // this set have had their Recent fold explicitly opened by the reader.
  const [expandedRecent, setExpandedRecent] = useState<Set<Theme>>(new Set())
  const [selectedDate, setSelectedDate]   = useState<string | null>(null)
  const cardRefs = useRef(new Map())

  // ── Source 1: static conference/earnings/investor/regulatory/milestone events ──
  const staticEventEntries: FeedEntry[] = (eventsData as any[])
    .filter((e) => e.date)
    .map((e) => ({
      id: e.id, date: e.date,
      signalType: EVENT_TYPE_TO_SIGNAL_TYPE[e.type] ?? e.type,
      theme: themeOf(EVENT_TYPE_TO_SIGNAL_TYPE[e.type] ?? null),
      kind: 'event' as const, raw: e,
    }))

  // ── Source 2: live EMA regulatory calendar ──────────────────────────────────
  const calendarEntries: FeedEntry[] = liveCalendarEvents
    .filter((row) => row.start_date)
    .map((row) => {
      const raw = {
        id: `reg-${row.id}`,
        date: row.start_date ?? '',
        endDate: row.end_date ?? undefined,
        type: 'regulatory',
        title: row.title ?? 'EMA Committee Meeting',
        location: 'Amsterdam, Netherlands (EMA)',
        attendingCompetitors: [] as string[],
        expectedTopics: [] as string[],
        _isLive: true as const,
        _emaSubtype: row.event_type,
      }
      return { id: raw.id, date: raw.date, signalType: 'regulatory_catalyst', theme: themeOf('regulatory_catalyst'), kind: 'event' as const, raw }
    })

  // ── Source 3: static market-developments.json (guideline/epi/advocacy/payer/deal/hta/launch) ──
  const staticMarketEntries: FeedEntry[] = (marketData as any[])
    .filter((m) => m.date)
    .map((m) => {
      const signalType = MARKET_TYPE_TO_SIGNAL_TYPE[m.type] ?? m.type
      return { id: m.id, date: m.date, signalType, theme: themeOf(signalType), kind: 'market' as const, raw: m }
    })

  // ── Source 4: live company_signals, ALL signal types, watched competitors only ──
  // This used to be filtered to signal_type === 'deal' before storage (Portal()'s
  // fetch effect), which is the reason this page never had a Theme facet: most of
  // the data Theme needs to slice was thrown away before it reached this
  // component. Portal() now keeps every type; this only scopes to the watchlist.
  const liveSignalEntries: FeedEntry[] = liveSignals
    .filter((row) => watchedCompetitors.has(row.competitor_id ?? ''))
    .map((row) => {
      const raw = {
        id: `sig-${row.id}`,
        date: row.date ?? '',
        type: row.signal_type,
        headline: row.headline ?? '(no headline)',
        summary: row.body_excerpt ? decodeEntities(row.body_excerpt) : '',
        parties: [competitorName(row.competitor_id)],
        _isLive: true as const,
        _sourceLabel: sourceNameOf(row.data_source) ?? undefined,
        _sourceUrl: row.source_url ?? null,
        _lastRefreshed: row.created_at ?? null,
      }
      return { id: raw.id, date: raw.date, signalType: row.signal_type, theme: themeOf(row.signal_type), kind: 'market' as const, raw }
    })

  const allEntries = [...staticEventEntries, ...calendarEntries, ...staticMarketEntries, ...liveSignalEntries]
    .filter((e) => e.date)

  // ── Filters that apply across the whole unified list (page-level, not per-theme) ──
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const oldestAllowedTs = TODAY.getTime() - NINETY_DAYS_MS

  const filteredEntries = allEntries.filter((e) => {
    if (viewFilter === 'leadership' && e.kind === 'event' && !LEADERSHIP_TYPES.has((e.raw as any).type)) return false
    if (selectedDate && e.date.substring(0, 10) !== selectedDate) return false
    // Watchlist scoping for event-kind items with named attendees (congress/
    // conference). EMA calendar rows and market-kind items are already scoped
    // above (EMA has no attendees; live signals are pre-filtered to watched).
    if (e.kind === 'event') {
      const comps = ((e.raw as any).attendingCompetitors as string[] | undefined) ?? []
      if (comps.length > 0 && !comps.some((id: string) => watchedCompetitors.has(id))) return false
    }
    const ts = new Date(e.date).getTime()
    return ts >= oldestAllowedTs || ts >= TODAY.getTime() // keep all upcoming + last 90 days past
  })

  const sections = groupByTheme(filteredEntries)
  // Grid's whole point is spending horizontal space list deliberately doesn't
  // (list is pinned to the 800px reading measure prose rows were tuned for).
  const contentMaxWidth = density === 'grid' ? '1200px' : '800px'

  // WeekStrip needs a flat {date, type} list across everything, including future
  // items, so its 90-day dot markers are unaffected by the theme/date filters above.
  const weekStripEvents = allEntries.map((e) => ({
    date: e.date,
    type: e.kind === 'event' ? (e.raw as any).type : e.signalType,
  }))

  function jumpToEntry(entryId: string) {
    const node = cardRefs.current.get(entryId)
    if (node?.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashedId(entryId)
    setTimeout(() => setFlashedId(null), 1000)
  }

  function setCardRef(id: string, node: HTMLDivElement | null) {
    if (node) cardRefs.current.set(id, node)
    else cardRefs.current.delete(id)
  }

  useEffect(() => {
    if (!eventFromUrl) return
    // A deep link into a past-dated entry needs its theme's Recent fold opened
    // first — otherwise the row isn't in the DOM yet to scroll to or flash.
    const target = filteredEntries.find((e) => e.id === eventFromUrl)
    if (target?.theme && new Date(target.date).getTime() < TODAY.getTime()) {
      setExpandedRecent((prev) => new Set(prev).add(target.theme as Theme))
    }
    const handle = setTimeout(() => jumpToEntry(eventFromUrl), 120)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFromUrl])

  const VIEW_OPTS = [
    { value: 'all',        label: 'All events'          },
    { value: 'leadership', label: 'Leadership priority' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── VIEW filter bar ──────────────────────────────────────────────────── */}
      {/* The "View key catalyst events" toggle and KeyCatalystsCalendar heatmap
          that sat here are removed: per the frontend doc, "upcoming catalysts" is
          named for War Room (§6.1, compact rail — already built as EventRow) and
          the Entity view (§6.3, per-asset), never for Intelligence Feed (§6.2).
          KeyCatalystsCalendar itself is left defined, unused, for now — where it
          belongs (War Room, Entity view, both, or neither) is still open. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'rgba(16,34,74,0.60)', whiteSpace: 'nowrap',
          fontFamily: 'Satoshi, sans-serif',
        }}>
          View:
        </span>
        <div style={{ display: 'inline-flex', gap: '4px', border: '1px solid rgba(210,226,255,1)', borderRadius: '16px', padding: '3px' }}>
          {VIEW_OPTS.map(opt => {
            const isAct = viewFilter === opt.value
            return (
              <button key={opt.value} onClick={() => setViewFilter(opt.value)} style={{
                padding: '4px 12px', borderRadius: '16px',
                background: isAct ? '#10224a' : 'transparent',
                color: isAct ? '#ffffff' : '#434c5b',
                border: 'none', cursor: 'pointer',
                fontSize: '14px', fontFamily: 'Satoshi, sans-serif',
                whiteSpace: 'nowrap', transition: 'all 120ms ease',
              }}>
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Grid-density comparison toggle (§ nested-grid discussion) — a
            prototype to judge against the list live, not a shipped choice.
            Deliberately quieter styling than the View control above it. */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'rgba(16,34,74,0.60)', fontFamily: 'Satoshi, sans-serif', whiteSpace: 'nowrap' }}>
            Layout (prototype):
          </span>
          <div style={{ display: 'inline-flex', gap: '2px', border: '1px solid rgba(16,34,74,0.12)', borderRadius: '12px', padding: '2px' }}>
            {(['list', 'grid'] as const).map((opt) => {
              const isAct = density === opt
              return (
                <button key={opt} onClick={() => setDensity(opt)} style={{
                  padding: '3px 10px', borderRadius: '12px',
                  background: isAct ? 'rgba(16,34,74,0.08)' : 'transparent',
                  color: isAct ? '#10224a' : 'rgba(16,34,74,0.45)',
                  border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: isAct ? 600 : 400, fontFamily: 'Satoshi, sans-serif',
                  whiteSpace: 'nowrap', textTransform: 'capitalize',
                }}>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Calendar strip ──────────────────────────────────────────────────── */}
      <WeekStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} allEvents={weekStripEvents} />

      {/* ── "Showing 90 days" text (right-aligned, below strip) ────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(16,34,74,0.60)', fontFamily: 'Satoshi, sans-serif' }}>
          Showing 90 days · scroll to navigate
        </span>
      </div>

      {/* ── Date filter indicator ─────────────────────────────────────────── */}
      {selectedDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontFamily: 'Satoshi, sans-serif', color: '#434c5b' }}>
            Showing signals on{' '}
            <strong>{new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}</strong>
          </span>
          <button
            onClick={() => setSelectedDate(null)}
            style={{
              padding: '2px 10px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 600,
              background: 'transparent',
              color: 'rgba(16,34,74,0.60)',
              border: '1px solid rgba(16,34,74,0.15)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Theme sections ───────────────────────────────────────────────────── */}
      {/* Constrained to a reading measure (~800px, centered) so card body text
          stays near the 65-75ch floor rather than the 130-150ch it ran at full
          column width (1080px measured). WeekStrip above keeps the full column
          width it needs; only the card content is constrained. Grid mode gets
          a wider measure (1200px) since its whole point is spending horizontal
          space list mode deliberately doesn't — list keeps the 800px reading
          measure the single-column prose rows were tuned for. */}
      {sections.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '14px', color: 'rgba(16,34,74,0.60)', fontFamily: 'Satoshi, sans-serif', maxWidth: contentMaxWidth, margin: '0 auto' }}>
          {watchedCompetitors.size === 0
            ? "You're not tracking any competitors yet — add some to see signals here."
            : 'Nothing to show for your watched competitors right now.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: contentMaxWidth, margin: '0 auto', width: '100%' }}>
          {sections.map(({ theme, entries }) => {
            const showAnnotations = viewFilter === 'leadership'
            const nowTs = TODAY.getTime()
            // Upcoming/Recent split so a daily-triage read isn't spent scrolling
            // past signals already lived through to reach what's still ahead.
            // Each half stays importance-sorted internally (groupByTheme already
            // sorted `entries`; filtering here preserves that relative order).
            const upcoming = entries.filter((e) => new Date(e.date).getTime() >= nowTs)
            const past = entries.filter((e) => new Date(e.date).getTime() < nowTs)
            const isMixed = upcoming.length > 0 && past.length > 0
            const upcomingHintIdx = firstExpandableIndex(upcoming, showAnnotations)
            const pastHintIdx = firstExpandableIndex(past, showAnnotations)

            // Grid mode uses FeedTile in a CSS grid; list mode keeps FeedRow in a
            // single flex column. Both read the same rows/hint index — only the
            // shell differs (§ nested-grid comparison).
            function renderGroup(rows: FeedEntry[], hintIdx: number) {
              const common = (entry: FeedEntry, i: number) => ({
                entry,
                cardRef: (node: HTMLDivElement | null) => setCardRef(entry.id, node),
                flashing: flashedId === entry.id,
                showAnnotations,
                defaultExpanded: i === hintIdx,
              })
              if (density === 'grid') {
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '8px' }}>
                    {rows.map((entry, i) => <FeedTile key={entry.id} {...common(entry, i)} />)}
                  </div>
                )
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rows.map((entry, i) => <FeedRow key={entry.id} {...common(entry, i)} />)}
                </div>
              )
            }

            return (
              <div key={theme} style={{ display: 'flex', flexDirection: 'column' }}>

                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(16,34,74,0.60)', whiteSpace: 'nowrap', fontFamily: 'Satoshi, sans-serif' }}>
                    {theme} · {entries.length}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(16,34,74,0.07)' }} />
                </div>

                {/* Rows — split into Upcoming/Recent only when a section actually
                    mixes both; a section that's all one or the other (most
                    Evidence/Regulatory sections) stays a flat list. */}
                {isMixed ? (
                  <>
                    <div style={{ marginBottom: '14px' }}>
                      <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(16,34,74,0.60)', fontFamily: 'Satoshi, sans-serif' }}>
                        Upcoming · {upcoming.length}
                      </span>
                      {renderGroup(upcoming, upcomingHintIdx)}
                    </div>
                    <div>
                      {/* Past defaults to collapsed behind this fold — a real
                          hide, not just a lower scroll position, so a past
                          signal never competes with what's still ahead unless
                          the reader deliberately asks for it. */}
                      <button
                        onClick={() => setExpandedRecent((prev) => {
                          const next = new Set(prev)
                          if (next.has(theme)) next.delete(theme); else next.add(theme)
                          return next
                        })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                          background: 'transparent', border: 'none', padding: 0, marginBottom: '6px',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                        aria-expanded={expandedRecent.has(theme)}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(16,34,74,0.60)', fontFamily: 'Satoshi, sans-serif' }}>
                          Recent · {past.length}
                        </span>
                        {!expandedRecent.has(theme) && (
                          <span style={{ fontSize: '12px', color: 'rgba(16,34,74,0.60)', fontFamily: 'Satoshi, sans-serif' }}>
                            — click to show
                          </span>
                        )}
                        <ChevronDown
                          size={13}
                          style={{
                            color: 'rgba(16,34,74,0.60)',
                            transform: expandedRecent.has(theme) ? 'rotate(180deg)' : 'none',
                            transition: 'transform 150ms ease',
                          }}
                        />
                      </button>
                      {expandedRecent.has(theme) && renderGroup(past, pastHintIdx)}
                    </div>
                  </>
                ) : (
                  renderGroup(entries, upcoming.length > 0 ? upcomingHintIdx : pastHintIdx)
                )}

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: MARKET DEVELOPMENTS
// ──────────────────────────────────────────────────────────────────────────────

function formatMonthYear(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  // isNaN(d) worked only because JS coerces a Date to a number; compare the
  // timestamp explicitly.
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ── Deals & Partnership panel ─────────────────────────────────────────────────
function DealsPanel({ deals }) {
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc') }
  }

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function sortValue(deal, key) {
    if (key === 'date')    return new Date(deal.date).getTime() || 0
    if (key === 'value')   return deal.dealValue ?? ''
    if (key === 'type')    return deal.dealType ?? ''
    if (key === 'parties') return (deal.parties || []).join(' ')
    return ''
  }

  const sorted = [...deals].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const TYPE_W = 144
  const VAL_W  = 144
  const DATE_W = 76

  function SortIcon({ k }: { k: string }) {
    const active = sortKey === k
    return (
      <span style={{ fontSize: '12px', color: active ? 'var(--font-primary)' : 'rgba(16,34,74,0.35)', marginLeft: '4px' }}>
        {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    )
  }

  const colBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px',
  }

  return (
    <div style={{
      flex: '0 0 58%', minWidth: 0,
      background: '#FFFFFF',
      border: '1.8px solid rgba(210,226,255,1)',
      borderRadius: '16px',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '16px',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', fontFamily: 'Satoshi, sans-serif' }}>
          Deals &amp; Partnership
        </span>
        <span style={{ fontSize: '12px', color: 'rgba(174,169,177,1)' }}>{deals.length} deals</span>
      </div>

      {/* Table area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{
          display: 'flex', alignItems: 'center', flexShrink: 0,
          background: '#FFFFFF', borderBottom: '1px solid rgba(191,214,254,1)', borderRadius: '4px',
        }}>
          <button onClick={() => toggleSort('parties')} style={{ ...colBtn, flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)' }}>Parties</span>
            <SortIcon k="parties" />
          </button>
          <button onClick={() => toggleSort('type')} style={{ ...colBtn, width: TYPE_W, flexShrink: 0 }}>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)' }}>Type</span>
            <SortIcon k="type" />
          </button>
          <button onClick={() => toggleSort('value')} style={{ ...colBtn, width: VAL_W, flexShrink: 0 }}>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)' }}>Value</span>
            <SortIcon k="value" />
          </button>
          <button onClick={() => toggleSort('date')} style={{ ...colBtn, width: DATE_W, flexShrink: 0 }}>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)' }}>Date</span>
            <SortIcon k="date" />
          </button>
        </div>

        {/* Scrollable rows */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {sorted.map((deal) => {
            const isExpanded = expandedIds.has(deal.id)
            const typeCfg = DEAL_TYPE_CFG[deal.dealType] || { bg: 'rgba(42,118,244,0.15)', text: '#2A76F4' }
            const partiesLabel = (deal.parties || []).join(' & ')
            const dateLabel = formatMonthYear(deal.date)
            const valueLabel = (() => {
              const v = deal.dealValue ?? ''
              const m = v.match(/\$[\d,.]+[KMBkm]?/)
              return m ? m[0] : (v.slice(0, 8) || '—')
            })()
            return (
              <div key={deal.id} style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '1px solid rgba(191,214,254,1)', padding: '8px 0' }}>
                {/* Parties + content */}
                <div style={{ flex: 1, minWidth: 0, padding: '4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <CompetitorBadge name={(deal.parties ?? [''])[0]} size={20} />
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {partiesLabel}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#2B2A2A', lineHeight: '21px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deal.headline}
                      </p>
                    </div>
                    <p style={{
                      margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif',
                      color: 'var(--font-primary)', lineHeight: '21px',
                      display: isExpanded ? 'block' : '-webkit-box',
                      WebkitLineClamp: isExpanded ? undefined : 3,
                      WebkitBoxOrient: isExpanded ? undefined : 'vertical',
                      overflow: isExpanded ? 'visible' : 'hidden',
                    }}>
                      {deal.summary}
                    </p>
                    <div style={{ padding: '4px 0' }}>
                      <button
                        onClick={() => toggleExpand(deal.id)}
                        style={{
                          background: 'none', border: 'none', padding: '0 0 1px', cursor: 'pointer',
                          fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif',
                          color: '#10224A', lineHeight: '21px',
                          borderBottom: '1px dashed #10224A',
                        }}
                      >
                        {isExpanded ? 'Collapse relevance note' : 'Expand relevance note'}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Type */}
                <div style={{ width: TYPE_W, flexShrink: 0, padding: '4px 8px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '4px 8px', borderRadius: '8px',
                    fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif',
                    background: typeCfg.bg, color: typeCfg.text, whiteSpace: 'nowrap',
                  }}>
                    {deal.dealType ?? 'Deal'}
                  </span>
                </div>
                {/* Value */}
                <div style={{ width: VAL_W, flexShrink: 0, padding: '4px 8px', fontSize: '14px', fontWeight: 700, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: '21px', fontVariantNumeric: 'tabular-nums' }}>
                  {valueLabel}
                </div>
                {/* Date */}
                <div style={{ width: DATE_W, flexShrink: 0, padding: '4px 12px 4px 8px', fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#03070F', lineHeight: '21px' }}>
                  {dateLabel}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Flag emoji → ISO 3166-1 alpha-2 code (e.g. "🇬🇧" → "gb") ─────────────────
function flagEmojiToIso(emoji: string): string {
  if (!emoji) return ''
  const codePoints = [...emoji].map(c => c.codePointAt(0) ?? 0)
  const letters = codePoints
    .filter(cp => cp >= 127462 && cp <= 127487)
    .map(cp => String.fromCharCode(cp - 127397))
  return letters.join('').toLowerCase()
}

// ── HTA & Payer access panel ──────────────────────────────────────────────────
function HtaStatusBadge({ status }) {
  if (!status) return null
  const cfg = HTA_STATUS_CFG[status] || { bg: 'rgba(16,34,74,0.07)', text: 'rgba(16,34,74,0.55)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 8px', borderRadius: '8px',
      fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif',
      background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {status}
    </span>
  )
}

function HtaPayerPanel({ items }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: '#FFFFFF',
      border: '1.086px solid rgba(210,226,255,1)',
      borderRadius: '16px',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '16px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', fontFamily: 'Satoshi, sans-serif' }}>HTA &amp; Payer access</span>
        <span style={{ fontSize: '12px', color: 'rgba(174,169,177,1)' }}>by market</span>
      </div>
      {/* Scrollable cards */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <div key={item.id} style={{
            background: '#FFFFFF',
            border: '1.8px solid rgba(210,226,255,1)',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {/* Top row: flag + country/product + badge */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
                {flagEmojiToIso(item.flagEmoji ?? '')
                  ? <img src={`https://flagcdn.com/20x15/${flagEmojiToIso(item.flagEmoji ?? '')}.png`} alt={item.country ?? ''} style={{ width: 20, height: 15, flexShrink: 0, marginTop: 3, borderRadius: 2 }} />
                  : <span style={{ fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>🌍</span>}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.country}: {item.agencyShort ?? item.agency}
                  </span>
                  {item.productLabel && (
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: '21px', whiteSpace: 'nowrap' }}>
                      {item.productLabel}
                    </span>
                  )}
                </div>
              </div>
              <HtaStatusBadge status={item.htaStatusBadge} />
            </div>
            {/* Description box */}
            {item.summary && (
              <div style={{ background: 'rgba(42,118,244,0.15)', borderRadius: '8px', padding: '4px 8px' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: '21px' }}>
                  {item.summary}
                </p>
              </div>
            )}
            {/* Footer */}
            {item.initiatedDate && (
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: 'normal' }}>
                Assessment initiated {item.initiatedDate}
              </p>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p style={{ textAlign: 'center', padding: '32px 0', fontSize: '14px', color: 'rgba(16,34,74,0.60)' }}>
            No HTA or payer items available.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Market Signals panel ──────────────────────────────────────────────────────
function SignalCard({ item }) {
  const cfg = SIGNAL_CARD_CFG[item.type] || { label: item.type, labelColor: 'rgba(16,34,74,0.65)', outerBg: 'rgba(16,34,74,0.05)' }
  return (
    <div style={{
      background: cfg.outerBg,
      borderRadius: '16px',
      padding: '10px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      height: '100%', boxSizing: 'border-box',
    }}>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: cfg.labelColor, lineHeight: 'normal', whiteSpace: 'nowrap' }}>
        {cfg.label}
      </p>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '8px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: '21px' }}>
            {item.headline}
          </p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-primary)', lineHeight: '21px' }}>
            {item.summary}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: 'var(--font-secondary)', lineHeight: '18px', textAlign: 'right' }}>
          {formatMonthYear(item.date)}
        </p>
      </div>
    </div>
  )
}

function MarketSignalsPanel({ items }) {
  const [activeFilter, setActiveFilter] = useState('all')

  const filtered = activeFilter === 'all'
    ? items
    : items.filter(i => i.type === activeFilter)

  return (
    <div style={{
      marginTop: '24px',
      background: '#FFFFFF',
      border: '1.8px solid rgba(210,226,255,1)',
      borderRadius: '16px',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', fontFamily: 'Satoshi, sans-serif' }}>Market Signals</span>
        <button style={{
          background: 'none', border: 'none', padding: '0 0 4px', cursor: 'pointer',
          fontSize: '12px', color: '#434343', borderBottom: '1px dashed #434343',
          fontFamily: 'inherit', lineHeight: 'normal',
        }}>
          View full competitor list
        </button>
      </div>
      {/* Filter pill tabs */}
      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', padding: '4px', border: '1px solid rgba(210,226,255,1)', borderRadius: '16px', flexWrap: 'wrap', flexShrink: 0, alignSelf: 'flex-start' }}>
        {SIGNAL_FILTER_TABS.map(tab => {
          const isActive = activeFilter === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              style={{
                padding: '4px 8px', borderRadius: isActive ? '16px' : '12px',
                fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif',
                background: isActive ? '#10224A' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--font-primary)',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 120ms ease',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {/* 3-column flex grid */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '14px', color: 'rgba(16,34,74,0.60)' }}>
          No signals match the current filter.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {filtered.map(item => (
            <SignalCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Market Development card type config ──────────────────────────────────────
const MARKET_DEV_TYPE_CFG: Record<string, ChipCfg> = {
  deal:                 { label: 'Deal',             bg: 'rgba(42,118,244,0.15)',  text: '#2A76F4' },
  guideline:            { label: 'Guideline',         bg: 'rgba(73,160,120,0.15)', text: '#49A078' },
  hta:                  { label: 'HTA decision',      bg: 'rgba(185,156,252,0.15)',text: '#B99CFC' },
  epidemiology:         { label: 'Epidemiology',       bg: 'rgba(16,34,74,0.15)',   text: '#10224A' },
  advocacy:             { label: 'Advocacy',           bg: 'rgba(245,158,11,0.10)', text: '#92500A' },
  payer:                { label: 'Payer',              bg: 'rgba(139,92,246,0.10)', text: '#5B21B6' },
  'launch-performance': { label: 'Launch Performance', bg: 'rgba(42,118,244,0.15)', text: '#2A76F4' },
  // Live company_signals types now reach this page too (the theme-facet fix,
  // §layout step): these carry the raw signal_type as item.type, so they need
  // labels here or they'd render as literal strings like "regulatory_catalyst".
  publication:          { label: 'Publication',       bg: 'rgba(16,34,74,0.15)',   text: '#10224A' },
  congress_abstract:    { label: 'Congress',           bg: 'rgba(42,118,244,0.09)',   text: '#2A76F4' },
  regulatory_catalyst:  { label: 'Regulatory',         bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
  trial_update:         { label: 'Trial update',       bg: 'rgba(225,29,72,0.10)',  text: '#C01041' },
  exec_change:          { label: 'Leadership',         bg: 'rgba(139,92,246,0.10)', text: '#5B21B6' },
  press_release:        { label: 'Press release',      bg: 'rgba(16,34,74,0.07)',    text: 'rgba(16,34,74,0.55)' },
}


function MarketDevCard({ item, signalType }: { item: any; signalType?: string }) {
  const typeCfg = MARKET_DEV_TYPE_CFG[item.type] || { label: item.type, bg: 'rgba(16,34,74,0.07)', text: '#10224A' }
  // Same importance badge as EventCard, same SEVERITY_LABEL colors as WarRoom.
  const band = signalType
    ? bandToLegacyTier(importanceBreakdown({ signal_type: signalType, date: item.date, date_precision: null }, { today: TODAY }).band)
    : null
  const sevCfg = band ? SEVERITY_LABEL[band] : null

  const badgeName: string = (() => {
    if (item.type === 'deal')  return item.parties?.[0] ?? ''
    if (item.type === 'hta')   return (item.productLabel ?? '').split(/[\s(•]/)[0] || item.agencyShort || ''
    if (item.type === 'payer') return item.agencyShort ?? ''
    return ''
  })()

  const hasMetadata = item.type === 'deal' || item.type === 'hta' || item.type === 'payer'

  // Unified provenance: live entries carry _sourceLabel/_sourceUrl; JSON entries derive label from URL
  const isLive:   boolean       = (item as any)._isLive === true
  const srcLabel: string | null = (item as any)._sourceLabel ?? null
  const srcUrl:   string | null = (item as any)._sourceUrl ?? (item as any).sourceUrl ?? null
  // §4.7: name the real publisher. Live rows carry _sourceLabel; curated rows are
  // resolved from their domain or sourceType. When nothing names the source we
  // label the link as an action rather than asserting a publisher called
  // "Source", which traced nothing.
  const resolvedName: string | null =
    srcLabel ?? resolveCuratedSourceName((item as any).sourceType, srcUrl)
  const resolvedLabel: string   = resolvedName ?? (srcUrl ? 'View source' : '')
  // §4.7 attribution tier is defined over the §4.1 SIGNAL inventory, so it only
  // applies to entries that came from a signal. Calendar entries (a CHMP meeting,
  // an investor day) are not signals and carry no drug attribution, so they get
  // no tier rather than an invented one.
  const provenanceTier: AttributionTier | null =
    item.type === 'deal' ? tierOf('deal')
    : item.type === 'hta' ? tierOf('hta_decision')
    : null

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(210,226,255,1)',
      borderRadius: '12px',
      padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>

      {/* Row 1: type pill + provenance chip + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px 8px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', lineHeight: '18px',
            background: typeCfg.bg, color: typeCfg.text, whiteSpace: 'nowrap',
          }}>
            {typeCfg.label}
          </span>
          {sevCfg && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 700,
              background: sevCfg.bg, color: sevCfg.text,
              whiteSpace: 'nowrap',
            }}>
              {sevCfg.label}
            </span>
          )}
          {(srcUrl || srcLabel) && (
            <ProvenanceChip
              sourceLabel={resolvedLabel}
              sourceUrl={srcUrl}
              date={item.date}
              tier={provenanceTier}
              lastRefreshed={(item as any)._lastRefreshed ?? null}
              isLive={isLive}
            />
          )}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px', whiteSpace: 'nowrap' }}>
          {formatDateAbs(item.date)}
        </span>
      </div>

      {/* Row 2: competitor badge + title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexShrink: 0 }}>
        {badgeName && <div style={{ flexShrink: 0 }}><CompetitorBadge name={badgeName} size={24} /></div>}
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '1.4' }}>
          {item.headline}
        </p>
      </div>

      {/* Row 3: blue extract box */}
      {item.summary && (
        <div style={{ background: 'rgba(42,118,244,0.15)', borderRadius: '8px', padding: '4px 8px', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
            {item.summary}
          </p>
        </div>
      )}

      {/* Divider + metadata (deals and HTA / payer only) */}
      {hasMetadata && (
        <>
          <div style={{ height: '1px', background: 'rgba(16,34,74,0.08)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>

            {item.type === 'deal' && (
              <>
                {item.parties && item.parties.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>Parties:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
                      {item.parties.join(' • ')}
                    </span>
                  </div>
                )}
                {item.dealValue && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>Deal value:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
                      {item.dealValue}
                    </span>
                  </div>
                )}
              </>
            )}

            {(item.type === 'hta' || item.type === 'payer') && (
              <>
                {(item.agency || item.agencyShort) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>Agency:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
                      {item.agency ?? item.agencyShort}
                    </span>
                  </div>
                )}
                {item.outcome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>Outcome:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
                      {item.outcome}
                    </span>
                  </div>
                )}
                {item.timeToReimbursement && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>Time to reimbursement:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
                      {item.timeToReimbursement}
                    </span>
                  </div>
                )}
                {!item.outcome && item.htaStatusBadge && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>Status:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
                      {item.htaStatusBadge}
                    </span>
                  </div>
                )}
                {!item.outcome && item.initiatedDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px', whiteSpace: 'nowrap' }}>Assessment initiated:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
                      {item.initiatedDate}
                    </span>
                  </div>
                )}
              </>
            )}

          </div>
        </>
      )}
    </div>
  )
}

// MarketTab removed: folded into IntelligenceFeedBody above. Its "Deals / HTA
// decisions" filter is superseded by Theme grouping (Deals and BD vs Market
// access are now separate sections, not a manual toggle over one list). The
// feed/landscape 2-col grid toggle is dropped rather than threaded through 8
// theme sections of mixed card kinds, where a 2-col grid would read uneven; it
// was a page-internal convenience, not a named requirement anywhere in scope.

// ── Page ──────────────────────────────────────────────────────────────────────
// The old ?tab=events/?tab=market split is gone (theme sections replaced the
// two-tab structure); a stale bookmark with either param is simply ignored
// rather than erroring, the same graceful-degrade already used for ?tab=reports.

export default function Portal() {
  const loaded = usePageLoad('portal')
  const [liveCalendarEvents, setLiveCalendarEvents] = useState<DbRegulatoryCalendarEvent[]>([])
  const [liveSignals, setLiveSignals] = useState<DbRecentSignal[]>([])
  const [liveTrialCells, setLiveTrialCells] = useState<Record<string, Record<number, CalCell>>>({})

  useEffect(() => {
    Promise.all([getRegulatoryCalendar(), getRecentSignals(365), getTrialsForCalendarYear(CAL_COMPS, 2026)])
      .then(([calendar, signals, calTrials]) => {
        setLiveCalendarEvents(calendar)
        // Used to keep only signal_type === 'deal' before storage — the reason
        // this page never had a working Theme facet, since most of what Theme
        // needs to slice was discarded here before it ever reached the UI.
        // Every type now reaches the unified feed; isQualityHeadline still
        // gates on headline quality regardless of type.
        setLiveSignals(signals.filter((s) => isQualityHeadline(s.headline)))
        setLiveTrialCells(trialsToCalendarCells(calTrials, 2026) as Record<string, Record<number, CalCell>>)
      })
      .catch(() => {})
  }, [])

  return (
    <div data-tour="intelligence-feed" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 36px 36px' }}>
        {!loaded ? (
          <SkeletonPortalList />
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <IntelligenceFeedBody
              liveCalendarEvents={liveCalendarEvents}
              liveTrialCells={liveTrialCells}
              liveSignals={liveSignals}
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}
