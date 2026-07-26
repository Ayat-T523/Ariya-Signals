import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays, FileText, TrendingUp,
  MapPin, Users, ChevronRight, ChevronDown,
  Mic, DollarSign, FlaskConical, Landmark, Star, AlertCircle, Crosshair,
  FileSearch, ArrowRight, Link2, ExternalLink, Clock,
} from 'lucide-react'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import ProvenanceChip from '../components/ui/ProvenanceChip'
import { usePageLoad } from '../hooks/usePageLoad'
import { SkeletonPortalList } from '../components/ui/Skeleton'
import FilterDropdown from '../components/ui/FilterDropdown'
import TimelineStrip from '../components/ui/TimelineStrip'
import { competitorsData, eventsData, marketDevelopments as marketData, reportsData } from '../data/kalvista'
import { buildSourceLabel } from '../lib/transformers'
import { tierOf, sourceNameOf, resolveCuratedSourceName, type AttributionTier } from '../lib/deterministic/provenance'
import { formatDateAbs } from '../utils/formatDate'
import { DEMO } from '../config/demo-config'
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

// §4-1: auto-generated "CI significance" removed. Templated interpretation
// ("Monitor for positioning shifts", "reshapes the competitive landscape") is a
// paid-tier function. The free tier shows events factually (title, date,
// attendees); a hand-authored note (event.note) is still surfaced as-is.
function buildCISignificance(_event: any, _indication: string): string | null {
  return null
}

function buildRegulatoryContext(event: any): { whyRelevant: string; actionableFollowUp: string } | null {
  if (event.type !== 'regulatory') return null
  // Authored ciContext takes priority — fail-safe: only use when both fields present
  const ctx = (event as any).ciContext
  if (ctx?.whyRelevant && ctx?.actionableFollowUp) {
    return { whyRelevant: ctx.whyRelevant, actionableFollowUp: ctx.actionableFollowUp }
  }
  // Live EMA calendar events: template from committee subtype
  if ((event as any)._isLive) {
    const sub: string = (event as any)._emaSubtype ?? ''
    if (sub === 'CHMP') return {
      whyRelevant: 'CHMP plenaries set the EU regulatory calendar. Decisions here affect HAE competitor approvals, label changes, and opinion renewals.',
      actionableFollowUp: 'Check EMA post-meeting outcomes for any HAE or angioedema INN mentions. Update competitor regulatory timelines if a new opinion is adopted.',
    }
    if (sub === 'PRAC') return {
      whyRelevant: 'PRAC meetings review post-market safety signals. A safety concern for an HAE competitor could shift prescribing behaviour or trigger label changes.',
      actionableFollowUp: 'Review PRAC meeting highlights for any HAE-class safety referrals. Flag to medical affairs if a competitor product is under review.',
    }
    return {
      whyRelevant: 'This EMA agenda item references an HAE-relevant term, indicating it may affect competitor products or the treatment landscape.',
      actionableFollowUp: 'Review the published EMA meeting agenda for full context. Escalate to medical affairs if this relates to a direct competitor product.',
    }
  }
  return null
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
  guideline:            { label: 'Guideline',         bg: 'rgba(16,185,129,0.10)', text: '#065F46'            },
  epidemiology:         { label: 'Epidemiology',       bg: 'rgba(0,85,187,0.09)',   text: '#0055BB'            },
  advocacy:             { label: 'Advocacy',           bg: 'rgba(245,158,11,0.10)', text: '#92500A'            },
  payer:                { label: 'Payer',              bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
  deal:                 { label: 'Deal',               bg: 'rgba(0,85,187,0.09)',   text: '#0055BB'            },
  hta:                  { label: 'HTA decision',       bg: 'rgba(139,92,246,0.10)', text: '#5B21B6'            },
  'launch-performance': { label: 'Launch Performance', bg: 'rgba(210,226,255,0.50)', text: '#0055BB'           },
}

// ── Deal type config ──────────────────────────────────────────────────────────
const DEAL_TYPE_CFG = {
  'Manufacturing': { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
  'Distribution':  { bg: 'rgba(0,85,187,0.09)',   text: '#0055BB' },
  'M&A':           { bg: 'rgba(245,158,11,0.10)', text: '#92500A' },
  'Co-promote':    { bg: 'rgba(139,92,246,0.10)', text: '#5B21B6' },
  'Licensing':     { bg: 'rgba(0,85,187,0.09)',   text: '#0055BB' },
}

// ── HTA status badge config ───────────────────────────────────────────────────
const HTA_STATUS_CFG = {
  'Under review':           { bg: 'rgba(250,174,54,0.15)',  text: '#FAAE36' },
  'Horizon scan':           { bg: 'rgba(250,174,54,0.15)',  text: '#FAAE36' },
  'Approved':               { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
  'Restricted':             { bg: 'rgba(245,158,11,0.10)', text: '#92500A' },
  'Framework update':       { bg: 'rgba(5,10,68,0.07)',    text: 'rgba(5,10,68,0.55)' },
  'Approved with discount': { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
}

// ── Signal card config ────────────────────────────────────────────────────────
const SIGNAL_CARD_CFG = {
  guideline:            { label: 'Guideline',          labelColor: '#10224A',  outerBg: 'rgba(16,34,74,0.15)'    },
  epidemiology:         { label: 'Epidemiology',        labelColor: '#0055BB',  outerBg: 'rgba(0,85,187,0.09)'    },
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

const LEADERSHIP_ANNOTATIONS = {
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

const CELL_STYLE: Record<CalCellVariant, { bg: string; color: string }> = {
  default: { bg: 'rgba(5,10,68,0.07)',  color: 'rgba(5,10,68,0.78)' },
  yellow:  { bg: 'rgba(250,174,54,0.22)', color: '#8C5500'           },
  blue:    { bg: 'rgba(42,118,244,0.14)', color: '#0055BB'           },
  purple:  { bg: 'rgba(139,92,246,0.14)', color: '#5B21B6'           },
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
      padding: '5px 7px', borderRadius: '6px',
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
  const BG       = 'var(--bg-1)'
  const DIV_H    = '1px solid rgba(5,10,68,0.07)'
  const DIV_V    = '1px solid rgba(5,10,68,0.05)'
  const DIV_FC   = '1px solid rgba(5,10,68,0.10)'
  const THICK    = '2px solid rgba(5,10,68,0.10)'
  const N        = MONTHS_LABELS.length

  return (
    <div style={{ background: BG, border: '1.8px solid rgba(210,226,255,1)', borderRadius: '16px', padding: '16px' }}>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(5,10,68,0.85)' }}>Key catalysts</span>
          <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>{count} events</span>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(5,10,68,0.40)' }}>
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
                  background: 'rgba(5,10,68,0.03)',
                  height: MO_H, padding: '0 8px', textAlign: 'center',
                  fontSize: '11px', fontWeight: 600, color: 'rgba(5,10,68,0.45)',
                  borderBottom: DIV_H, borderRight: i < N - 1 ? DIV_V : 'none',
                  whiteSpace: 'nowrap',
                }}>{mo}</th>
              ))}
            </tr>
            {/* Conferences */}
            <tr>
              <th style={{ position: 'sticky', top: MO_H, left: 0, zIndex: 5, background: BG, height: CONF_H, padding: '0 8px', textAlign: 'left', borderBottom: DIV_H, borderRight: DIV_FC, verticalAlign: 'middle' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(5,10,68,0.45)' }}>Conferences</span>
              </th>
              {MONTHS_LABELS.map((_, i) => {
                const d = CONF_DATA[i]
                return (
                  <td key={i} style={{ position: 'sticky', top: MO_H, zIndex: 1, background: BG, height: CONF_H, padding: '6px 8px', verticalAlign: 'middle', borderBottom: DIV_H, borderRight: i < N - 1 ? DIV_V : 'none' }}>
                    {d && d.map((ln, li) => (
                      <div key={li} style={{ fontSize: li === 0 ? '11px' : '10px', fontWeight: li === 0 ? 600 : 400, color: li === 0 ? 'rgba(5,10,68,0.80)' : 'rgba(5,10,68,0.40)', lineHeight: '1.5' }}>{ln}</div>
                    ))}
                  </td>
                )
              })}
            </tr>
            {/* IR Events */}
            <tr>
              <th style={{ position: 'sticky', top: MO_H + CONF_H, left: 0, zIndex: 5, background: BG, height: IR_H, padding: '0 8px', textAlign: 'left', borderBottom: THICK, borderRight: DIV_FC, verticalAlign: 'middle' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(5,10,68,0.45)' }}>IR Events</span>
              </th>
              {MONTHS_LABELS.map((_, i) => {
                const d = IR_DATA[i]
                return (
                  <td key={i} style={{ position: 'sticky', top: MO_H + CONF_H, zIndex: 1, background: BG, height: IR_H, padding: '6px 8px', verticalAlign: 'middle', borderBottom: THICK, borderRight: i < N - 1 ? DIV_V : 'none' }}>
                    {d && d.map((ln, li) => (
                      <div key={li} style={{ fontSize: li === 0 ? '11px' : '10px', fontWeight: li === 0 ? 600 : 400, color: li === 0 ? 'rgba(5,10,68,0.80)' : 'rgba(5,10,68,0.40)', lineHeight: '1.5' }}>{ln}</div>
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
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'rgba(5,10,68,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.name}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'rgba(5,10,68,0.38)', fontStyle: 'italic' }}>{CAL_ASSET[id]}</p>
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

// ── KPI countdown helpers ─────────────────────────────────────────────────────
function daysUntil(dateStr) {
  const diff = new Date(dateStr).getTime() - TODAY.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function KpiCountdownCard({ event }) {
  const days = daysUntil(event.date)
  const typeCfg = EVENT_TYPE[event.type] || { label: event.type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)', icon: null }
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

// ── Tab bar (underline style) ─────────────────────────────────────────────────
const TABS: Array<{ label: string; icon: (p: { size?: number; strokeWidth?: number }) => JSX.Element; disabled?: boolean; disabledLabel?: string }> = [
  { label: 'Events',              icon: CalendarDays },
  { label: 'Earnings Filings',    icon: FileText,     disabled: true, disabledLabel: 'Coming soon' },
  { label: 'Market Developments', icon: TrendingUp   },
]

const TAB_COUNTS = [eventsData.length, reportsData.length, marketData.length]

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      padding: '0 36px',
      borderBottom: '1px solid #708090',
    }}>
      {TABS.map(({ label, icon: TabIcon, disabled, disabledLabel }, i) => {
        const isActive = active === i
        return (
          <button
            key={label}
            onClick={disabled ? undefined : () => onChange(i)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px',
              fontSize: '14px', fontWeight: isActive ? 500 : 400,
              fontFamily: 'Satoshi, sans-serif',
              color: disabled ? 'rgba(112,128,144,0.55)' : isActive ? '#10224a' : '#434c5b',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '4px solid #10224a' : '3px solid transparent',
              marginBottom: '-1px',
              cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
              transition: 'color 150ms ease, border-color 150ms ease',
              opacity: disabled ? 0.7 : 1,
            }}
          >
            {TabIcon && <TabIcon size={14} strokeWidth={isActive ? 2 : 1.5} />}
            {label}
            {disabledLabel ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '1px 7px', borderRadius: '9999px',
                background: 'rgba(112,128,144,0.15)',
                color: 'rgba(112,128,144,0.70)',
                fontSize: '10px', fontWeight: 600,
                fontFamily: 'Satoshi, sans-serif', lineHeight: 1,
              }}>
                <Clock size={9} />
                {disabledLabel}
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '22px', height: '18px', padding: '0 4px',
                borderRadius: '4px',
                background: isActive ? 'rgba(16,34,74,0.15)' : 'rgba(112,128,144,0.30)',
                color: isActive ? '#10224a' : '#434c5b',
                fontSize: '12px', fontWeight: 500,
                fontFamily: 'Satoshi, sans-serif',
                lineHeight: 1,
              }}>
                {String(TAB_COUNTS[i]).padStart(2, '0')}
              </span>
            )}
          </button>
        )
      })}
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
              <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(5,10,68,0.12)', margin: '0 8px', flexShrink: 0 }} />
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
                  return (
                    <div
                      key={str}
                      data-today={isToday ? 'true' : undefined}
                      onClick={() => onDateSelect(isSelected ? null : str)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        padding: isToday ? '8px 4px' : '6px 4px',
                        borderRadius: '10px',
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

function EventCard({ event, pastVariant, cardRef, flashing, showAnnotations }) {
  const { indication } = useConfig()
  const past = Boolean(pastVariant)
  const isMultiDay = Boolean(event.endDate)
  const dateLabel = isMultiDay
    ? `${formatDateAbs(event.date)} – ${formatDateAbs(event.endDate)}`
    : formatDateAbs(event.date)
  const locationStr = event.location && event.location !== 'Virtual'
    ? ` · ${event.location}`
    : event.location === 'Virtual' ? ' · Virtual' : ''
  const digestReport = past ? findDigestForEvent(event) : null
  const typeCfg = EVENT_TYPE[event.type] || { label: event.type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)', icon: null }
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
            fontSize: '11px', fontWeight: 700,
            background: typeCfg.bg, color: typeCfg.text,
            whiteSpace: 'nowrap',
          }}>
            {TypeIcon && <TypeIcon size={10} />}
            {typeCfg.label}
          </span>
          {(event as any)._isLive && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '10px', fontWeight: 700,
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
              fontSize: '10px', fontWeight: 700,
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
              fontSize: '10px', fontWeight: 600,
              background: 'rgba(5,10,68,0.07)', color: 'rgba(5,10,68,0.50)',
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
                fontSize: '11px', fontWeight: 500, color: 'rgba(5,10,68,0.45)',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0055BB')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(5,10,68,0.45)')}
            >
              {sourceName ?? 'View source'} <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Row 2: title */}
      <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--font-primary)', lineHeight: '1.4' }}>
        {event.title}
        {past && <span style={{ marginLeft: '6px', fontSize: '12px', fontWeight: 400, color: 'rgba(5,10,68,0.40)' }}>(past)</span>}
      </p>

      {/* Row 2b: CI significance — only when no note is present */}
      {ciSignificance && (
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.58)', lineHeight: '1.55' }}>
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
          <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
            Expected topics
          </p>
          <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
            {event.expectedTopics.map((topic, i) => (
              <li key={i} style={{ fontSize: '14px', lineHeight: '1.55', color: 'var(--font-primary)' }}>{topic}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Row 4b: Regulatory context — why relevant + actionable follow up */}
      {regulatoryCtx && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: '8px', background: 'rgba(42,118,244,0.06)' }}>
            <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
              Why this is relevant
            </p>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.55', color: 'var(--font-primary)' }}>
              {regulatoryCtx.whyRelevant}
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: '8px', background: 'rgba(16,34,74,0.06)' }}>
            <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
              Actionable follow up
            </p>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.55', color: 'var(--font-primary)' }}>
              {regulatoryCtx.actionableFollowUp}
            </p>
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
          <AlertCircle size={12} color='#0055BB' style={{ marginTop: '3px', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: '#0055BB', lineHeight: '1.5' }}>
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
      {digestReport && (
        <Link
          to={`/intelligence?tab=reports&competitor=${digestReport.competitorId}`}
          style={{ fontSize: '12px', fontWeight: 600, color: '#0055BB', textDecoration: 'none', borderBottom: '1px dashed rgba(0,85,187,0.40)' }}
        >
          Read digest →
        </Link>
      )}

    </div>
  )
}

// Event type is carried by the labeled type chip inside EventCard (colour, icon,
// and word together) — it does not need a second encoding on the card edge.

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
  const cardRefs = useRef(new Map())

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
    _emaSubtype: row.event_type,
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
            letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)', whiteSpace: 'nowrap',
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
        </div>

        {/* View / Hide key catalyst events — back in filter bar */}
        <button
          onClick={() => setShowCatalysts(v => !v)}
          style={{
            background: 'none', border: 'none', padding: '0 0 2px',
            borderBottom: '1px dashed rgba(5,10,68,0.35)',
            cursor: 'pointer', fontSize: '12px',
            fontFamily: 'Satoshi, sans-serif', color: 'rgba(5,10,68,0.55)',
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
        <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)', fontFamily: 'Satoshi, sans-serif' }}>
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
          <span style={{ fontSize: '14px', fontFamily: 'Satoshi, sans-serif', color: '#434c5b' }}>
            Showing events on{' '}
            <strong>{new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}</strong>
          </span>
          <button
            onClick={() => setSelectedDate(null)}
            style={{
              padding: '2px 10px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 600,
              background: 'transparent',
              color: 'rgba(5,10,68,0.50)',
              border: '1px solid rgba(5,10,68,0.15)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Sections ─────────────────────────────────────────────────────────── */}
      {upcoming.length === 0 && past.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)', fontFamily: 'Satoshi, sans-serif' }}>
          No events found
        </p>
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
                    <ChevronDown size={14} color='rgba(5,10,68,0.40)' strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.45)', whiteSpace: 'nowrap', fontFamily: 'Satoshi, sans-serif' }}>
                    Upcoming · {upcoming.length} events
                  </span>
                </button>
                <div style={{ flex: 1, height: '1px', background: 'rgba(5,10,68,0.07)' }} />
              </div>

              {/* Cards — always full width */}
              {upcomingOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {upcoming.map((e) => {
                    return (
                      <div key={(e as any).id} style={{
                        background: '#ffffff',
                        border: '1px solid rgba(210,226,255,1)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                      }}>
                        <EventCard
                          event={e}
                          cardRef={(node) => setCardRef((e as any).id, node)}
                          flashing={flashedId === (e as any).id}
                          showAnnotations={viewFilter === 'leadership'}
                        />
                      </div>
                    )
                  })}
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
                    <ChevronDown size={14} color='rgba(5,10,68,0.40)' strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.45)', whiteSpace: 'nowrap', fontFamily: 'Satoshi, sans-serif' }}>
                    Past · last 90 days · {past.length} {past.length === 1 ? 'event' : 'events'}
                  </span>
                </button>
                <div style={{ flex: 1, height: '1px', background: 'rgba(5,10,68,0.07)' }} />
              </div>
              {pastOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {past.map((e) => {
                    return (
                      <div key={(e as any).id} style={{
                        background: '#ffffff',
                        border: '1px solid rgba(210,226,255,1)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                      }}>
                        <EventCard
                          event={e}
                          pastVariant
                          cardRef={(node) => setCardRef((e as any).id, node)}
                          flashing={flashedId === (e as any).id}
                          showAnnotations={viewFilter === 'leadership'}
                        />
                      </div>
                    )
                  })}
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
// TAB 2: REPORTS & EARNINGS
// ──────────────────────────────────────────────────────────────────────────────

const ALL_REPORT_TYPES = [...new Set(reportsData.map((r) => r.type))]

function ReportListCard({ report }) {
  const { indication } = useConfig()
  const typeCfg = REPORT_TYPE[report.type] || { label: report.type, bg: 'rgba(42,118,244,0.15)', text: '#2A76F4', icon: null }
  const cName = competitorName(report.competitorId)

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(210,226,255,1)',
      borderRadius: '12px',
      padding: '8px 16px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      {/* Row 1: type pill + illustrative badge + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px 8px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', lineHeight: '18px',
            background: typeCfg.bg, color: typeCfg.text,
            whiteSpace: 'nowrap',
          }}>
            {typeCfg.label}
          </span>
          {(report as any).isIllustrative && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '10px', fontWeight: 700, fontFamily: 'Satoshi, sans-serif',
              background: 'rgba(245,158,11,0.12)', color: '#92500A',
              whiteSpace: 'nowrap',
            }}>
              Illustrative
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px', whiteSpace: 'nowrap' }}>
          {formatDateAbs(report.date)}
        </span>
      </div>

      {/* Row 2: badge + title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
        <div style={{ flexShrink: 0 }}>
          <CompetitorBadge name={cName} size={24} />
        </div>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '1.45' }}>
          {report.title}
        </p>
      </div>

      {/* Row 3: TA extract */}
      {report.haeExtract && (
        <div style={{ background: 'rgba(42,118,244,0.15)', borderRadius: '8px', padding: '4px 8px' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
            {indication} extract:
          </p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
            {report.haeExtract}
          </p>
        </div>
      )}

      {/* Row 4: sources + confidence */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434c5b', whiteSpace: 'nowrap', flexShrink: 0 }}>Sources:</span>
          <span style={{
            fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '18px',
            borderBottom: '1px dashed #434343', paddingBottom: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {report.source}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434c5b', whiteSpace: 'nowrap' }}>Confidence:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434c5b' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#49A078', display: 'inline-block', flexShrink: 0 }} />
            Strong
          </span>
        </div>
      </div>
    </div>
  )
}

function ReportDetailPanel({ report }) {
  const { assetName, indication } = useConfig()
  if (!report) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '14px', color: 'rgba(5,10,68,0.35)' }}>Select a report to view details.</p>
      </div>
    )
  }

  const typeCfg = REPORT_TYPE[report.type] || { label: report.type }

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', height: '100%' }}>
      {/* Section 1 — Title + meta */}
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700, color: 'var(--font-primary)', lineHeight: '1.3' }}>
          {report.title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {(() => { const TypeIcon = typeCfg?.icon; return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--font-secondary)' }}>
            {TypeIcon ? <TypeIcon size={12} strokeWidth={1.8} /> : <FileText size={12} strokeWidth={1.8} />}
            {typeCfg.label ?? report.type}
          </span>
          )})()}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--font-secondary)' }}>
            <CalendarDays size={12} strokeWidth={1.8} /> {formatDateAbs(report.date)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--font-secondary)' }}>
            <Link2 size={12} strokeWidth={1.8} /> {report.source}
          </span>
          {(report as any).isIllustrative && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '10px', fontWeight: 700, fontFamily: 'Satoshi, sans-serif',
              background: 'rgba(245,158,11,0.12)', color: '#92500A',
              whiteSpace: 'nowrap',
            }}>
              Illustrative
            </span>
          )}
        </div>
      </div>

      {/* Section 2 — KPI cards */}
      {report.kpis && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {report.kpis.map((kpi, i) => {
            const l = kpi.label.toUpperCase()
            const KpiIcon = l.includes('REVENUE') || l.includes('CASH') || l.includes('DEAL') || l.includes('VALUE')
              ? DollarSign
              : l.includes('PIPELINE') || l.includes('FILING') || l.includes('PHASE') || l.includes('ORAL')
              ? FlaskConical
              : l.includes('GUIDANCE') || l.includes('GROWTH') || l.includes('RWE') || l.includes('INVEST')
              ? TrendingUp
              : l.includes('DATE') || l.includes('TIMELINE') || l.includes('READOUT')
              ? CalendarDays
              : Crosshair
            return (
              <div key={i} style={{ flex: '0 0 auto', background: 'rgba(21,45,97,1)', borderRadius: '12px', padding: '16px 32px', minWidth: '140px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <KpiIcon size={12} color='rgba(255,255,255,0.5)' />
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                    {kpi.label}
                  </span>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                  {kpi.value}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                  {kpi.subtext}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Section 5 — TA extract fallback (only if no kpis) */}
      {!report.kpis && report.haeExtract && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)' }}>
            {indication} Extract
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-primary)', lineHeight: '1.7' }}>
            {report.haeExtract}
          </p>
        </div>
      )}

    </div>
  )
}

function ReportsTab({ liveEarnings }: { liveEarnings: DbRecentSignal[] }) {
  const { watchedCompetitors } = useApp()
  // Strict config scoping: only watched competitors' earnings signals
  const earnings = liveEarnings.filter(s => watchedCompetitors.has(s.competitor_id ?? ''))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Not yet available notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '16px 20px', borderRadius: '12px',
        background: 'rgba(5,10,68,0.03)', border: '1px solid rgba(210,226,255,1)',
      }}>
        <Clock size={18} style={{ flexShrink: 0, color: 'rgba(5,10,68,0.35)', marginTop: '1px' }} />
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.80)', fontFamily: 'Satoshi, sans-serif' }}>
            Synthesized analysis not yet available
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.55' }}>
            Earnings call summaries, investor day notes, and analyst report digests will appear here once they have been reviewed and structured. Raw source documents are linked below where available.
          </p>
        </div>
      </div>

      {/* Live earnings signals — shown if present */}
      {earnings.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.40)' }}>
              Live Earnings Signals
            </p>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px', background: 'rgba(22,163,74,0.10)', color: '#15803d' }}>
              Live
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {earnings.map((s) => (
              <div key={s.id} style={{
                background: '#FFFFFF', borderRadius: '10px',
                border: '1px solid rgba(210,226,255,1)',
                padding: '12px 14px',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {s.date && (
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: 'rgba(5,10,68,0.45)' }}>
                      {formatDateAbs(s.date)}
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.80)', lineHeight: '1.4' }}>
                    {decodeEntities(s.headline ?? '')}
                  </p>
                </div>
                {s.source_url && (
                  <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'rgba(5,10,68,0.35)' }}>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
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
      <span style={{ fontSize: '9px', color: active ? 'var(--font-primary)' : 'rgba(5,10,68,0.35)', marginLeft: '4px' }}>
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
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', fontFamily: 'Inter, sans-serif' }}>
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
  const cfg = HTA_STATUS_CFG[status] || { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
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
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', fontFamily: 'Inter, sans-serif' }}>HTA &amp; Payer access</span>
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
                  <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Inter, sans-serif', color: 'var(--font-primary)', lineHeight: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: 'var(--font-primary)', lineHeight: 'normal' }}>
                Assessment initiated {item.initiatedDate}
              </p>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p style={{ textAlign: 'center', padding: '32px 0', fontSize: '13px', color: 'rgba(5,10,68,0.35)' }}>
            No HTA or payer items available.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Market Signals panel ──────────────────────────────────────────────────────
function SignalCard({ item }) {
  const cfg = SIGNAL_CARD_CFG[item.type] || { label: item.type, labelColor: 'rgba(5,10,68,0.65)', outerBg: 'rgba(5,10,68,0.05)' }
  return (
    <div style={{
      background: cfg.outerBg,
      borderRadius: '16px',
      padding: '10px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      height: '100%', boxSizing: 'border-box',
    }}>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, fontFamily: 'Inter, sans-serif', color: cfg.labelColor, lineHeight: 'normal', whiteSpace: 'nowrap' }}>
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
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)', fontFamily: 'Inter, sans-serif' }}>Market Signals</span>
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
        <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)' }}>
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
const MARKET_DEV_TYPE_CFG = {
  deal:                 { label: 'Deal',             bg: 'rgba(42,118,244,0.15)',  text: '#2A76F4' },
  guideline:            { label: 'Guideline',         bg: 'rgba(73,160,120,0.15)', text: '#49A078' },
  hta:                  { label: 'HTA decision',      bg: 'rgba(185,156,252,0.15)',text: '#B99CFC' },
  epidemiology:         { label: 'Epidemiology',       bg: 'rgba(16,34,74,0.15)',   text: '#10224A' },
  advocacy:             { label: 'Advocacy',           bg: 'rgba(245,158,11,0.10)', text: '#92500A' },
  payer:                { label: 'Payer',              bg: 'rgba(139,92,246,0.10)', text: '#5B21B6' },
  'launch-performance': { label: 'Launch Performance', bg: 'rgba(42,118,244,0.15)', text: '#2A76F4' },
}

const MARKET_FILTER_TABS = [
  { value: 'all',  label: 'All'           },
  { value: 'deal', label: 'Deals'         },
  { value: 'hta',  label: 'HTA decisions' },
]


function MarketDevCard({ item }) {
  const typeCfg = MARKET_DEV_TYPE_CFG[item.type] || { label: item.type, bg: 'rgba(5,10,68,0.07)', text: '#10224A' }

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
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '1.45' }}>
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
          <div style={{ height: '1px', background: 'rgba(5,10,68,0.08)', flexShrink: 0 }} />
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
    // §4.7: prefer the recorded pipeline over a hardcoded label.
    _sourceLabel: sourceNameOf(row.data_source) ?? 'SEC EDGAR',
    _sourceUrl: row.source_url ?? null,
    _lastRefreshed: row.created_at ?? null,
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
          <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px', whiteSpace: 'nowrap' }}>
            Filter by:
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px', border: '1px solid rgba(210,226,255,1)', borderRadius: '16px' }}>
            {MARKET_FILTER_TABS.map(tab => {
              const isActive = activeFilter === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  style={{
                    padding: '4px 8px', borderRadius: isActive ? '16px' : '12px',
                    fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', lineHeight: '21px',
                    background: isActive ? '#10224A' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#434c5b',
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 120ms ease',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Feed / Landscape toggle */}
        <div style={{ display: 'inline-flex', padding: '3px', border: '1px solid rgba(210,226,255,1)', borderRadius: '16px', gap: '2px' }}>
          {(['feed', 'landscape'] as const).map(mode => {
            const isActive = viewMode === mode
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '4px 12px', borderRadius: '16px',
                  fontSize: '14px', fontFamily: 'Satoshi, sans-serif',
                  background: isActive ? '#10224A' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#434c5b',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 120ms ease',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            )
          })}
        </div>
      </div>

      {/* Card list — Feed (1 col) or Landscape (2-col grid) */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)' }}>
          No market developments match the current filter.
        </p>
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
const TAB_NAME_TO_INDEX = { events: 0, reports: 1, market: 2 }

export default function Portal() {
  const [searchParams] = useSearchParams()
  const tabFromUrl = TAB_NAME_TO_INDEX[searchParams.get('tab')]
  const [activeTab, setActiveTab] = useState(tabFromUrl ?? 0)
  const loaded = usePageLoad('portal')
  const [liveCalendarEvents, setLiveCalendarEvents] = useState<DbRegulatoryCalendarEvent[]>([])
  const [liveDeals, setLiveDeals] = useState<DbRecentSignal[]>([])
  const [liveEarnings, setLiveEarnings] = useState<DbRecentSignal[]>([])
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
        setLiveEarnings(signals.filter((s) => s.signal_type === 'earnings' && isQualityHeadline(s.headline)))
        setLiveTrialCells(trialsToCalendarCells(calTrials, 2026) as Record<string, Record<number, CalCell>>)
      })
      .catch(() => {})
  }, [])

  return (
    <div data-tour="intelligence-feed" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Underline tab bar — sticky so it stays visible while scrolling events */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-1)' }}>
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
            <div style={{ display: activeTab === 1 ? 'block' : 'none' }}><ReportsTab liveEarnings={liveEarnings} /></div>
            <div style={{ display: activeTab === 2 ? 'block' : 'none' }}><MarketTab liveDeals={liveDeals} /></div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
