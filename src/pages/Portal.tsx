import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { REDUCED_MOTION } from '../lib/motion'
import {
  CalendarDays, TrendingUp,
  Users, ChevronDown,
  DollarSign, Landmark, Star, AlertCircle,
  ExternalLink, Clock,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../components/animate-ui/components/radix/tabs'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import ProvenanceChip from '../components/ui/ProvenanceChip'
import { usePageLoad } from '../hooks/usePageLoad'
import { SkeletonPortalList } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { NEU_PLATE_STYLE } from '../components/inform/primitives'
import { competitorsData, eventsData, marketDevelopments as marketData } from '../data/kalvista'
import { buildSourceLabel } from '../lib/transformers'
import { formatDateAbs } from '../utils/formatDate'
import { useApp, useConfig } from '../context/AppContext'
import { getRegulatoryCalendar, getRecentSignals, getTrialsForCalendarYear, type DbRegulatoryCalendarEvent, type DbRecentSignal } from '../lib/db'
import { trialsToCalendarCells } from '../lib/trialsToGantt'

// ── Reference date ────────────────────────────────────────────────────────────
const TODAY = new Date()

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


// Generates a CI-focused one-liner for events that have no manually authored note.
// Derived purely from existing fields — no invented facts.
// `indication` comes from the user's onboarding preference (e.g. "HAE"); falls back to "your indication".
function buildCISignificance(event: any, indication: string): string | null {
  if (event.note) return null  // note already provides specific context
  const comp = event.attendingCompetitors?.[0]
  const name = comp ? competitorName(comp) : null
  const n: number = event.attendingCompetitors?.length ?? 0
  const ind = indication || 'your indication'
  switch (event.type) {
    case 'conference':
      return n > 0
        ? `${n} tracked competitor${n > 1 ? 's' : ''} presenting. Monitor for ${ind} positioning shifts, new efficacy data, and messaging changes.`
        : `Monitor for ${ind} competitive landscape updates and positioning signals across the field.`
    case 'earnings':
      return name
        ? `${name} reports quarterly results. Watch for ${ind} franchise revenue trends, guidance changes, and pipeline updates.`
        : `Multiple competitors report quarterly results. Watch for ${ind} franchise revenue trends and pipeline updates.`
    case 'regulatory':
      // No generic placeholder — regulatory events with known competitors carry an annotation instead
      return null
    case 'investor':
      return name
        ? `${name} R&D day — typically the highest-value event for forward-looking pipeline and commercial strategy signals.`
        : 'Investor R&D day — monitor for pipeline prioritisation and commercial strategy signals.'
    case 'milestone': {
      const isAcq   = /acqui/i.test(event.title)
      const isPhase = /phase [23]|phase iii/i.test(event.title)
      const isNDA   = /nda|submission/i.test(event.title)
      if (isAcq)   return `${name ?? 'This competitor'} corporate transaction — monitor follow-up messaging for portfolio and commercial implications.`
      if (isPhase) return `Phase 3 data readout for ${name ?? 'this competitor'}. A positive result reshapes the competitive landscape for ${ind}.`
      if (isNDA)   return `Regulatory filing milestone for ${name ?? 'this competitor'}. Marks the start of the formal approval clock.`
      return `${name ?? 'This competitor'} milestone — monitor for commercial or pipeline implications in ${ind}.`
    }
    default:
      return null
  }
}

// Per-event synthesized annotation (docs/intelligence-feed-spec.md §2.2). Cached at
// ingestion, read as-is here — never templated or derived client-side. Absent for most
// events until the AI synthesis pipeline (Phase 2.2, deferred) populates it; that's an
// honest empty state, not a bug — no defensible per-event line beats a generic one.
interface EventAnnotation {
  whyRelevant: string
  actionableFollowUp: string | null
  expect?: string
  surprise?: string
}

function getEventAnnotation(event: any): EventAnnotation | null {
  return (event as any).annotation ?? null
}

// ── Event type config ─────────────────────────────────────────────────────────
// DESIGN.md doesn't define a categorical event-type palette (only functional-state
// meanings: sage/amber/terra/crimson/indigo). Mapped by nearest fit: conference is
// purely informational (indigo); earnings is neutral reporting (ink-muted);
// regulatory reads as official/approval-adjacent (sage); investor days are
// forward-looking/worth-watching (amber); milestones (readouts, filings) are the
// highest-attention event type (terra).
const EVENT_TYPE = {
  conference: { label: 'Conference', icon: Users,      bg: 'var(--indigo-050)', text: 'var(--indigo-600)' },
  earnings:   { label: 'Earnings',   icon: DollarSign, bg: 'var(--cream-200)',  text: 'var(--ink-700)'    },
  regulatory: { label: 'Regulatory', icon: Landmark,   bg: 'var(--sage-050)',   text: 'var(--sage-600)'   },
  investor:   { label: 'Investor',   icon: TrendingUp, bg: 'var(--amber-050)',  text: 'var(--amber-800)'  },
  milestone:  { label: 'Milestone',  icon: Star,       bg: 'var(--terra-050)', text: 'var(--terra-600)'  },
}

// ── Leadership-priority filter ───────────────────────────────────────────────
// "Leadership priority" stays a view filter over these event types — the expect/surprise
// annotation content itself now comes from the per-event `annotation` field (see
// EventAnnotation above), not a type-keyed template.
const LEADERSHIP_TYPES = new Set(['conference', 'earnings', 'regulatory', 'investor', 'milestone'])

// ─── Key Catalysts Calendar — data ───────────────────────────────────────────

const MONTHS_LABELS = [
  'Jan 26','Feb 26','Mar 26','Apr 26','May 26','Jun 26',
  'Jul 26','Aug 26','Sep 26','Oct 26','Nov 26','Dec 26',
]

// ── Calendar helpers — derived from events.json; no hardcoded dates ──────────

const _MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const _mi = (iso: string) => new Date(iso).getMonth()

function _dateRange(s: string, e?: string | null): string {
  const d = new Date(s); const mo = d.getMonth(); const sd = d.getDate()
  return e ? `${_MO[mo]} ${sd}–${new Date(e).getDate()}` : `${_MO[mo]} ${sd}`
}

function _confShortName(title: string): string {
  const parts = title.split(' ')
  return (parts[1] === 'Global' || parts[1] === 'Americas') ? `${parts[0]} ${parts[1]}` : parts[0]
}

function _earningsLabels(title: string): string[] {
  if (/all three/i.test(title)) return ['Q3 Earnings', '(All 3 cos.)']
  const m = title.match(/^(\w+)\s+(Q\d)\s+(FY)?(\d{4})?/)
  if (!m) return [title.split(' ').slice(0, 2).join(' ')]
  const fy = (m[3] && m[4]) ? ` FY${String(m[4]).slice(2)}` : ''
  return [`${m[1]} ${m[2]}${fy}`]
}

const CONF_DATA: Record<number, string[]> = {}
;(eventsData as any[])
  .filter(e => e.type === 'conference' && String(e.date).startsWith('2026') && e.sourceType !== 'illustrative')
  .forEach(e => {
    const mi = _mi(e.date)
    CONF_DATA[mi] = [_confShortName(e.title), _dateRange(e.date, e.endDate), (e.location as string)?.split(',')[0] ?? '']
  })

const IR_DATA: Record<number, string[]> = {}
;(eventsData as any[])
  .filter(e => (e.type === 'earnings' || e.type === 'investor') && String(e.date).startsWith('2026') && e.sourceType !== 'illustrative')
  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
  .forEach(e => {
    const mi = _mi(e.date)
    const labels = e.type === 'investor' ? ['Pharvaris', 'Inv. R&D Day'] : _earningsLabels(e.title)
    IR_DATA[mi] = [...(IR_DATA[mi] ?? []), ...labels]
  })

type CalCellVariant = 'default' | 'yellow' | 'blue' | 'purple'
interface CalCell { lines: string[]; v: CalCellVariant }

const _CELL_PRI: Record<CalCellVariant, number> = { purple: 4, blue: 3, yellow: 2, default: 1 }

function _calCell(e: any): CalCell | null {
  if (e.type === 'conference')
    return { lines: [_confShortName(e.title), _dateRange(e.date, e.endDate)], v: 'default' }
  if (e.type === 'earnings')
    return { lines: _earningsLabels(e.title), v: 'default' }
  if (e.type === 'investor')
    return { lines: ['Investor', 'R&D Day'], v: 'default' }
  return null
}

const CAL_CELLS: Record<string, Record<number, CalCell>> = {}
;(eventsData as any[])
  .filter(e => String(e.date).startsWith('2026') && e.sourceType !== 'illustrative')
  .forEach(e => {
    const mi = _mi(e.date)
    const cell = _calCell(e)
    if (!cell) return
    for (const id of (e.attendingCompetitors as string[]) ?? []) {
      if (!CAL_CELLS[id]) CAL_CELLS[id] = {}
      const cur = CAL_CELLS[id][mi]
      if (!cur || _CELL_PRI[cell.v] > _CELL_PRI[cur.v]) CAL_CELLS[id][mi] = cell
    }
  })

const CAL_ASSET: Record<string, string> = Object.fromEntries(
  (competitorsData as any[]).map(c => [
    c.id,
    (c.marketedProducts?.[0]?.name ?? c.pipeline?.[0]?.name ?? '').split(' (')[0],
  ])
)

// Same "no purple in DESIGN.md" constraint as EVENT_TYPE above — terra stands in
// as the fourth distinct hue for the live-trial-cell variant.
const CELL_STYLE: Record<CalCellVariant, { bg: string; color: string }> = {
  default: { bg: 'var(--cream-200)',  color: 'var(--ink-800)'   },
  yellow:  { bg: 'var(--amber-050)',  color: 'var(--amber-800)' },
  blue:    { bg: 'var(--indigo-050)', color: 'var(--indigo-600)' },
  purple:  { bg: 'var(--terra-050)',  color: 'var(--terra-600)' },
}

const CAL_COMPS = ['takeda','biocryst','pharvaris','csl-behring','ionis']

const COL_W   = 86
const FIRST_W = 92
const MO_H    = 32
const CONF_H  = 66
const IR_H    = 66

function CCell({ cell }: { cell: CalCell | undefined }) {
  if (!cell) return null
  const s = CELL_STYLE[cell.v]
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', gap: '2px',
      padding: '5px 7px', borderRadius: 'var(--r-xs)',
      background: s.bg, maxWidth: `${COL_W - 8}px`,
    }}>
      {cell.lines.map((ln, i) => (
        <span key={i} style={{
          display: 'block',
          fontSize: i === 0 ? '11px' : '10px',
          fontWeight: i === 0 ? 600 : 400,
          color: s.color, lineHeight: '1.3',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{ln}</span>
      ))}
    </div>
  )
}

function KeyCatalystsCalendar({ count, liveTrialCells }: { count: number; liveTrialCells: Record<string, Record<number, CalCell>> }) {
  const BG       = 'var(--cream-100)'
  const DIV_H    = '1px solid var(--cream-300)'
  const DIV_V    = '1px solid var(--cream-200)'
  const DIV_FC   = '1px solid var(--cream-400)'
  const THICK    = '2px solid var(--cream-400)'
  const N        = MONTHS_LABELS.length

  return (
    <div style={{ background: BG, boxShadow: 'var(--neu-raised)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink-900)' }}>Key catalysts</span>
          <span className="num" style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{count} events</span>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--ink-600)' }}>
          Conference dates: official congress sites · Earnings dates: company IR · Milestones: ClinicalTrials.gov (live)
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: `${FIRST_W + COL_W * N}px` }}>
          <colgroup>
            <col style={{ width: FIRST_W }} />
            {MONTHS_LABELS.map((_, i) => <col key={i} style={{ width: COL_W }} />)}
          </colgroup>
          <thead>
            {/* Month headers */}
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 5, background: BG, height: MO_H, padding: 0, borderBottom: DIV_H, borderRight: DIV_FC }} />
              {MONTHS_LABELS.map((mo, i) => (
                <th key={mo} style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: 'var(--cream-200)',
                  height: MO_H, padding: '0 8px', textAlign: 'center',
                  fontSize: '11px', fontWeight: 600, color: 'var(--ink-600)',
                  borderBottom: DIV_H, borderRight: i < N - 1 ? DIV_V : 'none',
                  whiteSpace: 'nowrap',
                }}>{mo}</th>
              ))}
            </tr>
            {/* Conferences */}
            <tr>
              <th style={{ position: 'sticky', top: MO_H, left: 0, zIndex: 5, background: BG, height: CONF_H, padding: '0 8px', textAlign: 'left', borderBottom: DIV_H, borderRight: DIV_FC, verticalAlign: 'middle' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--ink-600)' }}>Conferences</span>
              </th>
              {MONTHS_LABELS.map((_, i) => {
                const d = CONF_DATA[i]
                return (
                  <td key={i} style={{ position: 'sticky', top: MO_H, zIndex: 1, background: BG, height: CONF_H, padding: '6px 8px', verticalAlign: 'middle', borderBottom: DIV_H, borderRight: i < N - 1 ? DIV_V : 'none' }}>
                    {d && d.map((ln, li) => (
                      <div key={li} style={{ fontSize: li === 0 ? '11px' : '10px', fontWeight: li === 0 ? 600 : 400, color: li === 0 ? 'var(--ink-900)' : 'var(--ink-600)', lineHeight: '1.5' }}>{ln}</div>
                    ))}
                  </td>
                )
              })}
            </tr>
            {/* IR Events */}
            <tr>
              <th style={{ position: 'sticky', top: MO_H + CONF_H, left: 0, zIndex: 5, background: BG, height: IR_H, padding: '0 8px', textAlign: 'left', borderBottom: THICK, borderRight: DIV_FC, verticalAlign: 'middle' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--ink-600)' }}>IR Events</span>
              </th>
              {MONTHS_LABELS.map((_, i) => {
                const d = IR_DATA[i]
                return (
                  <td key={i} style={{ position: 'sticky', top: MO_H + CONF_H, zIndex: 1, background: BG, height: IR_H, padding: '6px 8px', verticalAlign: 'middle', borderBottom: THICK, borderRight: i < N - 1 ? DIV_V : 'none' }}>
                    {d && d.map((ln, li) => (
                      <div key={li} style={{ fontSize: li === 0 ? '11px' : '10px', fontWeight: li === 0 ? 600 : 400, color: li === 0 ? 'var(--ink-900)' : 'var(--ink-600)', lineHeight: '1.5' }}>{ln}</div>
                    ))}
                  </td>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {CAL_COMPS.map((id, ri) => {
              const comp = competitorsData.find((c) => c.id === id)
              if (!comp) return null
              const cells: Record<number, CalCell> = { ...(CAL_CELLS[id] || {}), ...(liveTrialCells[id] || {}) }
              const isLast = ri === CAL_COMPS.length - 1
              return (
                <tr key={id}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: BG, padding: '8px', verticalAlign: 'middle', borderBottom: isLast ? 'none' : DIV_H, borderRight: DIV_FC }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.name}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--ink-600)', fontStyle: 'italic' }}>{CAL_ASSET[id]}</p>
                  </td>
                  {MONTHS_LABELS.map((_, mi) => (
                    <td key={mi} style={{ padding: '4px 5px', verticalAlign: 'middle', borderBottom: isLast ? 'none' : DIV_H, borderRight: mi < N - 1 ? DIV_V : 'none' }}>
                      <CCell cell={cells[mi]} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab bar (underline style) ─────────────────────────────────────────────────
const TABS: Array<{ label: string; icon: (p: { size?: number; strokeWidth?: number }) => JSX.Element; disabled?: boolean; disabledLabel?: string }> = [
  { label: 'Events',              icon: CalendarDays },
  { label: 'Market Developments', icon: TrendingUp   },
]

const TAB_COUNTS = [eventsData.length, marketData.length]

function TabBar({ active, onChange }: { active: number; onChange: (i: number) => void }) {
  return (
    <div style={{ padding: '10px 36px' }}>
      <Tabs value={String(active)} onValueChange={(v) => onChange(Number(v))}>
        <TabsList aria-label="Intelligence feed section" style={{ height: '34px' }}>
          {TABS.map(({ label, icon: TabIcon, disabled, disabledLabel }, i) => {
            const isActive = active === i
            return (
              <TabsTrigger key={label} value={String(i)} disabled={disabled} style={{ gap: '6px', padding: '0 14px', fontSize: '13px' }}>
                {TabIcon && <TabIcon size={14} strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />}
                {label}
                {disabledLabel ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    padding: '1px 7px', borderRadius: 'var(--r-pill)',
                    background: 'var(--neutral-100)', color: 'var(--neutral-600)',
                    fontSize: '10px', fontWeight: 600, fontFamily: 'var(--font-ui)', lineHeight: 1,
                  }}>
                    <Clock size={9} aria-hidden="true" />
                    {disabledLabel}
                  </span>
                ) : (
                  <span className="num" style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: '22px', height: '18px', padding: '0 4px',
                    borderRadius: 'var(--r-xs)',
                    background: isActive ? 'var(--indigo-050)' : 'var(--neutral-100)',
                    color: isActive ? 'var(--indigo-600)' : 'var(--neutral-600)',
                    fontSize: '12px', fontWeight: 500, lineHeight: 1,
                  }}>
                    {String(TAB_COUNTS[i]).padStart(2, '0')}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </div>
  )
}

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

  // More saturated than EVENT_TYPE.bg (its 050-tints read too faint at 20×20px) —
  // one step up the same tonal ramp per type, still within DESIGN.md's palette.
  const STRIP_BADGE_BG: Record<string, string> = {
    conference: 'var(--indigo-100)',
    earnings:   'var(--cream-300)',
    regulatory: 'var(--sage-100)',
    investor:   'var(--amber-100)',
    milestone:  'var(--terra-100)',
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
              <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--cream-400)', margin: '0 8px', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Month label — left-aligned, sticky on horizontal scroll */}
              <span style={{
                position: 'sticky', left: '4px', zIndex: 1,
                display: 'block',
                fontSize: '14px', fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-800)', lineHeight: '20px',
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
                  return (
                    <div
                      key={str}
                      data-today={isToday ? 'true' : undefined}
                      onClick={() => onDateSelect(isSelected ? null : str)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        padding: isToday ? '8px 4px' : '6px 4px',
                        borderRadius: 'var(--r-md)',
                        height: isToday ? '100px' : '91px',
                        width: isToday ? '52px' : '42px',
                        background: isSelected ? 'var(--indigo-050)' : 'var(--cream-100)',
                        boxShadow: isSelected
                          ? 'var(--neu-raised), 0 0 0 1.5px var(--indigo-500)'
                          : isToday ? 'var(--neu-raised-strong)' : 'var(--neu-raised)',
                        opacity: isPast && !isToday && !isSelected ? 0.4 : 1,
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'box-shadow var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard)',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: isSelected ? 'var(--indigo-600)' : 'var(--ink-700)', lineHeight: '18px', whiteSpace: 'nowrap' }}>
                        {letter}
                      </span>
                      <div style={{
                        width: isToday ? '36px' : '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '4px', borderRadius: 'var(--r-sm)',
                        background: isSelected ? 'var(--indigo-500)' : isToday ? 'var(--navy-700)' : 'var(--cream-300)',
                      }}>
                        <span className="num" style={{
                          display: 'block', width: '100%',
                          fontSize: isToday ? '14px' : '13px',
                          fontWeight: isToday || isSelected ? 700 : 500,
                          color: isSelected || isToday ? '#ffffff' : 'var(--ink-700)',
                          lineHeight: isToday ? '21px' : '19px',
                          textAlign: 'center',
                        }}>
                          {num}
                        </span>
                      </div>
                      {typeCfg && EventIcon && evtType && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: STRIP_BADGE_BG[evtType] ?? typeCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <EventIcon size={10} color={typeCfg.text} strokeWidth={2} aria-hidden="true" />
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

// ── Grouped daily digest (critique 2026-07-28) ───────────────────────────────
// Replaces the old one-full-card-per-event list: a plate of hairline rows,
// grouped under a bold day heading, same shell as DigestFeed's competitor-
// grouped variant (.digest-plate/.digest-group/.digest-row in inform-theme.css)
// — reusing that visual pattern rather than inventing a second "grouped list"
// language. A row shows only what's needed to scan and decide whether to open
// it; everything EventCard used to always render (CI significance, attending
// badges, expected topics, annotations, notes) moves into the expand-in-place
// body below it.
//
// The expand mechanic is framer-motion (AnimatePresence + animate to
// height:'auto'), NOT DigestRow's `.digest-expand-wrap` CSS grid-template-rows
// 0fr/1fr trick. Direct measurement (disabling the transition and forcing
// reflow, then testing the same CSS classes in complete isolation outside
// React) showed that trick does not reliably collapse to 0 in this app's
// current environment even with min-height:0 present on the grid item — it
// settles at a content-dependent floor instead (e.g. ~32px for this
// component's content, ~24px for DigestRow's). That may be worth revisiting
// for DigestRow/SignalCard too, but wasn't re-litigated here; framer-motion's
// height:'auto' animation is a proven, already-used-elsewhere (SlideOver)
// dependency that measures real content height itself instead of depending on
// this CSS-only technique.

function dayLabel(dateStr: string, todayStr: string): string {
  const diffDays = Math.round((new Date(`${dateStr}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function groupByDay(events: any[]): { dateStr: string; label: string; events: any[] }[] {
  const todayStr = TODAY.toISOString().substring(0, 10)
  const order: string[] = []
  const map = new Map<string, any[]>()
  for (const e of events) {
    const key = e.date.substring(0, 10)
    if (!map.has(key)) { map.set(key, []); order.push(key) }
    map.get(key)!.push(e)
  }
  return order.map((dateStr) => ({ dateStr, label: dayLabel(dateStr, todayStr), events: map.get(dateStr)! }))
}

function EventDigestRow({ event, pastVariant, cardRef, flashing, showAnnotations, isOpen, onToggle }) {
  const { indication } = useConfig()
  const past = Boolean(pastVariant)
  const isMultiDay = Boolean(event.endDate)
  const typeCfg = EVENT_TYPE[event.type] || { label: event.type, bg: 'var(--cream-300)', text: 'var(--ink-600)', icon: null }
  const TypeIcon = typeCfg.icon
  const noteText = (event as any).note ?? null
  const annotation = getEventAnnotation(event)
  const ciSignificance = buildCISignificance(event, indication)
  const durationDays = isMultiDay
    ? Math.round((new Date(event.endDate).getTime() - new Date(event.date).getTime()) / 86400000) + 1
    : null
  const isVirtualLoc = /^(Virtual|Online|Broadcast)$/i.test(((event as any).location ?? '').trim())
  const locationStr = event.location && !isVirtualLoc ? event.location : event.location === 'Virtual' ? 'Virtual' : null
  const sourceUrl    = (event as any).sourceUrl ?? null
  const isIllustrative = (event as any).sourceType === 'illustrative'
  const showSource   = Boolean(sourceUrl && !isIllustrative)
  const attending: string[] = event.attendingCompetitors ?? []

  const hasExpandableContent = Boolean(
    ciSignificance || annotation?.whyRelevant || noteText || attending.length > 0 ||
    event.expectedTopics?.length > 0 || (showAnnotations && (annotation?.expect || annotation?.surprise))
  )

  return (
    <div ref={cardRef} style={{ scrollMarginTop: '80px', background: flashing ? 'var(--indigo-050)' : 'transparent', transition: 'background 350ms ease' }}>
      <button
        type="button"
        className="digest-row"
        aria-expanded={hasExpandableContent ? isOpen : undefined}
        onClick={() => hasExpandableContent && onToggle()}
        style={{ cursor: hasExpandableContent ? 'pointer' : 'default', opacity: past ? 0.65 : 1 }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0,
          padding: '2px 8px', borderRadius: 'var(--r-pill)',
          fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-ui)',
          background: typeCfg.bg, color: typeCfg.text, whiteSpace: 'nowrap',
        }}>
          {TypeIcon && <TypeIcon size={9} aria-hidden="true" />}
          {typeCfg.label}
        </span>

        <span className="headline">{event.title}</span>

        <span className="row-meta">
          {durationDays && durationDays > 1 && <span>{durationDays}d</span>}
          {(event as any)._isLive && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--sage-600)', fontWeight: 700 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--sage-600)', display: 'inline-block', flexShrink: 0 }} />
              EMA
            </span>
          )}
          {isIllustrative && <span style={{ color: 'var(--amber-800)', fontWeight: 600 }}>Illustrative</span>}
          {attending.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {attending.slice(0, 3).map((id) => <CompetitorBadge key={id} name={competitorName(id)} size={16} />)}
              {attending.length > 3 && <span style={{ fontSize: '11px' }}>+{attending.length - 3}</span>}
            </span>
          )}
          {hasExpandableContent && (
            <ChevronDown size={12} strokeWidth={2} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease', flexShrink: 0 }} aria-hidden="true" />
          )}
        </span>
      </button>

      {hasExpandableContent && (
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: REDUCED_MOTION ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden', margin: '0 var(--s-5)' }}
            >
          <div className="signal-excerpt" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', marginBottom: 'var(--s-2)' }}>

            {/* Date/location/source — the info the dense row omits */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span className="num" style={{ fontSize: '12px', color: 'var(--ink-600)' }}>
                {isMultiDay ? `${formatDateAbs(event.date)} – ${formatDateAbs(event.endDate)}` : formatDateAbs(event.date)}
                {locationStr ? ` · ${locationStr}` : ''}
              </span>
              {showSource && (
                <a
                  href={sourceUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-600)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--indigo-600)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-600)')}
                >
                  Source <ExternalLink size={10} aria-hidden="true" />
                </a>
              )}
            </div>

            {ciSignificance && (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-700)', lineHeight: '1.55' }}>{ciSignificance}</p>
            )}

            {attending.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--ink-600)', fontWeight: 500 }}>Attending</span>
                {attending.map((id) => <CompetitorBadge key={id} name={competitorName(id)} size={18} />)}
              </div>
            )}

            {event.expectedTopics?.length > 0 && (
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-600)' }}>
                  Expected topics
                </p>
                <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                  {event.expectedTopics.map((topic, i) => (
                    <li key={i} style={{ fontSize: '14px', lineHeight: '1.55', color: 'var(--ink-900)' }}>{topic}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Synthesized annotation — why relevant, + actionable follow-up when present. */}
            {annotation?.whyRelevant && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: isIllustrative ? 'var(--amber-050)' : 'var(--indigo-050)' }}>
                  <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isIllustrative ? 'var(--amber-800)' : 'var(--ink-600)' }}>
                    Why this is relevant{isIllustrative ? ' · Illustrative' : ''}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.55', color: 'var(--ink-900)' }}>{annotation.whyRelevant}</p>
                </div>
                {annotation.actionableFollowUp && (
                  <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: isIllustrative ? 'var(--amber-050)' : 'var(--cream-200)' }}>
                    <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isIllustrative ? 'var(--amber-800)' : 'var(--ink-600)' }}>
                      Actionable follow-up{isIllustrative ? ' · Illustrative' : ''}
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.55', color: 'var(--ink-900)' }}>{annotation.actionableFollowUp}</p>
                  </div>
                )}
              </div>
            )}

            {noteText && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '6px 10px', borderRadius: 'var(--r-xs)', background: 'var(--indigo-050)' }}>
                <AlertCircle size={12} color="var(--indigo-600)" style={{ marginTop: '3px', flexShrink: 0 }} aria-hidden="true" />
                <span style={{ fontSize: '12px', color: 'var(--indigo-600)', lineHeight: '1.5' }}>{noteText}</span>
              </div>
            )}

            {showAnnotations && (annotation?.expect || annotation?.surprise) && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {annotation?.expect && (
                  <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'var(--indigo-050)' }}>
                    <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-600)' }}>What we expect</p>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.55', color: 'var(--ink-900)' }}>{annotation.expect}</p>
                  </div>
                )}
                {annotation?.surprise && (
                  <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'var(--cream-200)' }}>
                    <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-600)' }}>What would surprise us</p>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.55', color: 'var(--ink-900)' }}>{annotation.surprise}</p>
                  </div>
                )}
              </div>
            )}

          </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

function EventsTab({ liveCalendarEvents, liveTrialCells }: { liveCalendarEvents: DbRegulatoryCalendarEvent[]; liveTrialCells: Record<string, Record<number, CalCell>> }) {
  const { watchedCompetitors } = useApp()
  const [searchParams]  = useSearchParams()
  const eventFromUrl    = searchParams.get('event')
  const [viewFilter, setViewFilter]         = useState('all')
  const [flashedId, setFlashedId]           = useState(null)
  const [showCatalysts, setShowCatalysts]   = useState(false)
  const [upcomingOpen, setUpcomingOpen]     = useState(true)
  const [pastOpen, setPastOpen]             = useState(true)
  const [selectedDate, setSelectedDate]     = useState<string | null>(null)
  // Controlled (not per-row local state, unlike DigestFeed's DigestRow) because
  // jumpToEvent (deep-link from ?event=, e.g. War Room's "Next up" links) needs
  // to force a specific row open, not just scroll to and flash it.
  const [openIds, setOpenIds]               = useState<Set<string>>(new Set())
  const cardRefs = useRef(new Map())

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const pastCutoffTs   = TODAY.getTime() - NINETY_DAYS_MS

  // Map live EMA calendar events to local event shape
  const mappedCalendarEvents = liveCalendarEvents.map((row) => ({
    id: `reg-${row.id}`,
    date: row.start_date ?? '',
    endDate: row.end_date ?? undefined,
    type: 'regulatory',
    title: row.title ?? 'EMA Committee Meeting',
    location: 'Amsterdam, Netherlands (EMA)',
    attendingCompetitors: [] as string[],
    expectedTopics: [] as string[],
    _isLive: true as const,
  }))

  const allEvents = [...(eventsData as any[]), ...mappedCalendarEvents]
    .filter((e) => e.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  const filtered = allEvents.filter((e) => {
    if (viewFilter === 'leadership' && !LEADERSHIP_TYPES.has(e.type)) return false
    if (selectedDate && e.date.substring(0, 10) !== selectedDate) return false
    // EMA regulatory events have no attendingCompetitors — always show.
    // Congress/conference events only show if a watched competitor is attending.
    const comps = (e.attendingCompetitors as string[] | undefined) ?? []
    if (comps.length > 0 && !comps.some((id: string) => watchedCompetitors.has(id))) return false
    return true
  })

  const upcoming = filtered
    .filter((e) => new Date(e.date) >= TODAY)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const past = filtered
    .filter((e) => {
      const ts = new Date(e.date).getTime()
      return ts < TODAY.getTime() && ts >= pastCutoffTs
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  function jumpToEvent(eventId) {
    const node = cardRefs.current.get(eventId)
    if (node?.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setOpenIds((prev) => new Set(prev).add(eventId))
    setFlashedId(eventId)
    setTimeout(() => setFlashedId(null), 1000)
  }

  function setCardRef(id, node) {
    if (node) cardRefs.current.set(id, node)
    else cardRefs.current.delete(id)
  }

  useEffect(() => {
    if (!eventFromUrl) return
    const handle = setTimeout(() => jumpToEvent(eventFromUrl), 120)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFromUrl])

  const VIEW_OPTS = [
    { value: 'all',        label: 'All events'          },
    { value: 'leadership', label: 'Leadership priority' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── VIEW filter bar + catalyst toggle ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--ink-600)', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-ui)',
          }}>
            View:
          </span>
          <div className="seg">
            {VIEW_OPTS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`seg-item${viewFilter === opt.value ? ' is-active' : ''}`}
                onClick={() => setViewFilter(opt.value)}
                style={{ border: 'none', background: viewFilter === opt.value ? undefined : 'transparent' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* View / Hide key catalyst events — back in filter bar */}
        <button
          type="button"
          onClick={() => setShowCatalysts(v => !v)}
          style={{
            background: 'none', border: 'none', padding: '0 0 2px',
            borderBottom: '1px dashed var(--ink-400)',
            cursor: 'pointer', fontSize: '12px',
            fontFamily: 'var(--font-ui)', color: 'var(--ink-600)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {showCatalysts ? 'Hide key catalyst events' : 'View key catalyst events'}
        </button>
      </div>

      {/* ── Calendar strip ──────────────────────────────────────────────────── */}
      <WeekStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} allEvents={allEvents} />

      {/* ── "Showing 90 days" text (right-aligned, below strip) ────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--ink-600)', fontFamily: 'var(--font-ui)' }}>
          Showing 90 days · scroll to navigate
        </span>
      </div>

      {/* ── Key catalyst calendar — opens between strip and cards ───────────── */}
      {showCatalysts && (
        <KeyCatalystsCalendar count={allEvents.length} liveTrialCells={liveTrialCells} />
      )}

      {/* ── Date filter indicator ─────────────────────────────────────────── */}
      {selectedDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontFamily: 'var(--font-ui)', color: 'var(--ink-800)' }}>
            Showing events on{' '}
            <strong>{new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}</strong>
          </span>
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            style={{
              padding: '2px 10px', borderRadius: 'var(--r-pill)',
              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-ui)',
              background: 'transparent',
              color: 'var(--ink-600)',
              border: '1px solid var(--cream-400)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Sections ─────────────────────────────────────────────────────────── */}
      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState message="No events found." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* ── Upcoming ────────────────────────────────────────────────────── */}
          {upcoming.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>

              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <button
                  onClick={() => setUpcomingOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '0', flexShrink: 0 }}
                >
                  <div style={{ transform: upcomingOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms ease', flexShrink: 0, display: 'flex' }}>
                    <ChevronDown size={14} color='var(--ink-600)' strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--ink-600)', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)' }}>
                    Upcoming · {upcoming.length} events
                  </span>
                </button>
                <div style={{ flex: 1, height: '1px', background: 'var(--cream-300)' }} />
              </div>

              {/* Grouped daily digest: one plate, a bold day heading per date,
                  dense hairline rows underneath. Type pill (inside each row) is
                  the sole color signal, per craft-floor's ban on colored border
                  accents. */}
              {upcomingOpen && (
                <div className="digest-plate" style={NEU_PLATE_STYLE}>
                  {groupByDay(upcoming).map((group) => (
                    <div className="digest-group" key={group.dateStr}>
                      <div className="digest-group-hd">
                        <span className="name">{group.label}</span>
                        <span className="count">{group.events.length} event{group.events.length === 1 ? '' : 's'}</span>
                      </div>
                      {group.events.map((e) => (
                        <EventDigestRow
                          key={(e as any).id}
                          event={e}
                          cardRef={(node) => setCardRef((e as any).id, node)}
                          flashing={flashedId === (e as any).id}
                          showAnnotations={viewFilter === 'leadership'}
                          isOpen={openIds.has((e as any).id)}
                          onToggle={() => toggleOpen((e as any).id)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* ── Past ─────────────────────────────────────────────────────────── */}
          {past.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <button
                  onClick={() => setPastOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '0', flexShrink: 0 }}
                >
                  <div style={{ transform: pastOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms ease', flexShrink: 0, display: 'flex' }}>
                    <ChevronDown size={14} color='var(--ink-600)' strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--ink-600)', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)' }}>
                    Past · last 90 days · {past.length} {past.length === 1 ? 'event' : 'events'}
                  </span>
                </button>
                <div style={{ flex: 1, height: '1px', background: 'var(--cream-300)' }} />
              </div>
              {pastOpen && (
                <div className="digest-plate" style={NEU_PLATE_STYLE}>
                  {groupByDay(past).map((group) => (
                    <div className="digest-group" key={group.dateStr}>
                      <div className="digest-group-hd">
                        <span className="name">{group.label}</span>
                        <span className="count">{group.events.length} event{group.events.length === 1 ? '' : 's'}</span>
                      </div>
                      {group.events.map((e) => (
                        <EventDigestRow
                          key={(e as any).id}
                          event={e}
                          pastVariant
                          cardRef={(node) => setCardRef((e as any).id, node)}
                          flashing={flashedId === (e as any).id}
                          showAnnotations={viewFilter === 'leadership'}
                          isOpen={openIds.has((e as any).id)}
                          onToggle={() => toggleOpen((e as any).id)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 3: MARKET DEVELOPMENTS
// ──────────────────────────────────────────────────────────────────────────────

function formatMonthYear(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ── Market Development card type config ──────────────────────────────────────
// Same constraint as EVENT_TYPE: DESIGN.md defines no categorical palette, only
// functional-state meanings. Nearest fit: deal/launch-performance (commercial
// action) and payer (financial/reimbursement) share indigo; guideline reads as
// official/approved (sage); hta stands in for the missing purple with terra;
// epidemiology is neutral background context (ink-muted); advocacy keeps its
// original amber (attention/awareness).
const MARKET_DEV_TYPE_CFG = {
  deal:                 { label: 'Deal',             bg: 'var(--indigo-050)', text: 'var(--indigo-600)' },
  guideline:            { label: 'Guideline',         bg: 'var(--sage-050)',   text: 'var(--sage-600)'   },
  hta:                  { label: 'HTA decision',      bg: 'var(--terra-050)',  text: 'var(--terra-600)'  },
  epidemiology:         { label: 'Epidemiology',       bg: 'var(--cream-300)',  text: 'var(--ink-800)'    },
  advocacy:             { label: 'Advocacy',           bg: 'var(--amber-050)', text: 'var(--amber-800)'  },
  payer:                { label: 'Payer',              bg: 'var(--indigo-100)', text: 'var(--indigo-600)' },
  'launch-performance': { label: 'Launch Performance', bg: 'var(--indigo-050)', text: 'var(--indigo-600)' },
}

const MARKET_FILTER_TABS = [
  { value: 'all',  label: 'All'           },
  { value: 'deal', label: 'Deals'         },
  { value: 'hta',  label: 'HTA decisions' },
]


function MarketDevCard({ item }) {
  const typeCfg = MARKET_DEV_TYPE_CFG[item.type] || { label: item.type, bg: 'var(--cream-300)', text: 'var(--ink-800)' }

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
  const resolvedLabel: string   = srcLabel ?? buildSourceLabel(srcUrl, item.type ?? '')

  return (
    <div style={{
      ...NEU_PLATE_STYLE,
      padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>

      {/* Row 1: type pill + provenance chip + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px 8px', borderRadius: 'var(--r-sm)',
            fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', lineHeight: '18px',
            background: typeCfg.bg, color: typeCfg.text, whiteSpace: 'nowrap',
          }}>
            {typeCfg.label}
          </span>
          {(srcUrl || srcLabel) && (
            <ProvenanceChip
              sourceLabel={resolvedLabel}
              sourceUrl={srcUrl}
              date={item.date}
              isLive={isLive}
            />
          )}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-600)', lineHeight: '18px', whiteSpace: 'nowrap' }}>
          {formatDateAbs(item.date)}
        </span>
      </div>

      {/* Row 2: competitor badge + title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexShrink: 0 }}>
        {badgeName && <div style={{ flexShrink: 0 }}><CompetitorBadge name={badgeName} size={24} /></div>}
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '1.45' }}>
          {item.headline}
        </p>
      </div>

      {/* Row 3: blue extract box */}
      {item.summary && (
        <div style={{ background: 'var(--indigo-050)', borderRadius: 'var(--r-sm)', padding: '4px 8px', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
            {item.summary}
          </p>
        </div>
      )}

      {/* Divider + metadata (deals and HTA / payer only) */}
      {hasMetadata && (
        <>
          <div style={{ height: '1px', background: 'var(--cream-300)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>

            {item.type === 'deal' && (
              <>
                {item.parties && item.parties.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '18px', whiteSpace: 'nowrap' }}>Parties:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
                      {item.parties.join(' • ')}
                    </span>
                  </div>
                )}
                {item.dealValue && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '18px', whiteSpace: 'nowrap' }}>Deal value:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
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
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '18px', whiteSpace: 'nowrap' }}>Agency:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
                      {item.agency ?? item.agencyShort}
                    </span>
                  </div>
                )}
                {item.outcome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '18px', whiteSpace: 'nowrap' }}>Outcome:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
                      {item.outcome}
                    </span>
                  </div>
                )}
                {item.timeToReimbursement && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '18px', whiteSpace: 'nowrap' }}>Time to reimbursement:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
                      {item.timeToReimbursement}
                    </span>
                  </div>
                )}
                {!item.outcome && item.htaStatusBadge && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '18px', whiteSpace: 'nowrap' }}>Status:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
                      {item.htaStatusBadge}
                    </span>
                  </div>
                )}
                {!item.outcome && item.initiatedDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '18px', whiteSpace: 'nowrap' }}>Assessment initiated:</span>
                    <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px' }}>
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

function MarketTab({ liveDeals }: { liveDeals: DbRecentSignal[] }) {
  const { watchedCompetitors } = useApp()
  const [activeFilter, setActiveFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'feed' | 'landscape'>('feed')

  // Map live company_signals deals to market-dev card format — scoped to watched competitors
  const liveDealItems = liveDeals.filter(row => watchedCompetitors.has(row.competitor_id ?? '')).map((row) => ({
    id: `sig-${row.id}`,
    date: row.date ?? '',
    type: 'deal' as const,
    headline: row.headline ?? '(no headline)',
    summary: row.body_excerpt ? decodeEntities(row.body_excerpt) : '',
    parties: [competitorName(row.competitor_id)],
    dealType: 'Press Release',
    _isLive: true as const,
    _sourceLabel: 'SEC EDGAR',
    _sourceUrl: row.source_url ?? null,
  }))

  const sorted = [...(marketData as any[]), ...liveDealItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filtered = activeFilter === 'all'
    ? sorted
    : activeFilter === 'deal'
    ? sorted.filter((m: any) => m.type === 'deal')
    : sorted.filter((m: any) => m.type === 'hta' || m.type === 'payer')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Filter row + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: '21px', whiteSpace: 'nowrap' }}>
            Filter by:
          </span>
          <div className="seg">
            {MARKET_FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                type="button"
                className={`seg-item${activeFilter === tab.value ? ' is-active' : ''}`}
                onClick={() => setActiveFilter(tab.value)}
                style={{ border: 'none', background: activeFilter === tab.value ? undefined : 'transparent' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed / Landscape toggle */}
        <div className="seg">
          {(['feed', 'landscape'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              className={`seg-item${viewMode === mode ? ' is-active' : ''}`}
              onClick={() => setViewMode(mode)}
              style={{ border: 'none', background: viewMode === mode ? undefined : 'transparent', textTransform: 'capitalize' }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Card list — Feed (1 col) or Landscape (2-col grid) */}
      {filtered.length === 0 ? (
        <EmptyState message="No market developments match the current filter." />
      ) : (
        <div style={viewMode === 'landscape'
          ? { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }
          : { display: 'flex', flexDirection: 'column', gap: '12px' }
        }>
          {filtered.map(item => (
            <MarketDevCard key={item.id} item={item} />
          ))}
        </div>
      )}

    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TAB_NAME_TO_INDEX = { events: 0, market: 1 }

export default function Portal() {
  const [searchParams] = useSearchParams()
  const tabFromUrl = TAB_NAME_TO_INDEX[searchParams.get('tab')]
  const [activeTab, setActiveTab] = useState(tabFromUrl ?? 0)
  const loaded = usePageLoad('portal')
  const [liveCalendarEvents, setLiveCalendarEvents] = useState<DbRegulatoryCalendarEvent[]>([])
  const [liveDeals, setLiveDeals] = useState<DbRecentSignal[]>([])
  const [liveTrialCells, setLiveTrialCells] = useState<Record<string, Record<number, CalCell>>>({})

  useEffect(() => {
    if (tabFromUrl !== undefined && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl])

  useEffect(() => {
    Promise.all([getRegulatoryCalendar(), getRecentSignals(365), getTrialsForCalendarYear(CAL_COMPS, 2026)])
      .then(([calendar, signals, calTrials]) => {
        setLiveCalendarEvents(calendar)
        setLiveDeals(signals.filter((s) => s.signal_type === 'deal' && isQualityHeadline(s.headline)))
        setLiveTrialCells(trialsToCalendarCells(calTrials, 2026) as Record<string, Record<number, CalCell>>)
      })
      .catch(() => {})
  }, [])

  return (
    <div data-tour="intelligence-feed" className="inform-app-bg" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Tab bar — sticky so it stays visible while scrolling events */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--white)', borderBottom: '1px solid var(--border-default)' }}>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div style={{ padding: '16px 36px 36px' }}>
        {!loaded ? (
          <SkeletonPortalList />
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div style={{ display: activeTab === 0 ? 'block' : 'none' }}><EventsTab liveCalendarEvents={liveCalendarEvents} liveTrialCells={liveTrialCells} /></div>
            <div style={{ display: activeTab === 1 ? 'block' : 'none' }}><MarketTab liveDeals={liveDeals} /></div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
