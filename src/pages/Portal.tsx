import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarDays, FileText, TrendingUp,
  MapPin, Users, ChevronRight,
  Mic, DollarSign, FlaskConical, Landmark, Star, AlertCircle, Crosshair, Copy,
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
  'Under review':           { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB' },
  'Horizon scan':           { bg: 'rgba(245,158,11,0.12)', text: '#92500A' },
  'Approved':               { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
  'Restricted':             { bg: 'rgba(245,158,11,0.10)', text: '#92500A' },
  'Framework update':       { bg: 'rgba(5,10,68,0.07)',    text: 'rgba(5,10,68,0.55)' },
  'Approved with discount': { bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
}

// ── Signal card config ────────────────────────────────────────────────────────
const SIGNAL_CARD_CFG = {
  guideline:            { label: 'Guideline',          labelColor: 'rgba(5,10,68,0.65)',  cardBg: 'rgba(5,10,68,0.03)'     },
  epidemiology:         { label: 'Epidemiology',        labelColor: '#0055BB',             cardBg: 'rgba(0,85,187,0.06)'    },
  advocacy:             { label: 'Advocacy',            labelColor: '#7C3AED',             cardBg: 'rgba(139,92,246,0.08)'  },
  'launch-performance': { label: 'Launch Performance',  labelColor: '#0055BB',             cardBg: 'rgba(210,226,255,0.50)' },
  payer:                { label: 'Payer',               labelColor: '#7C3AED',             cardBg: 'rgba(139,92,246,0.06)'  },
}

const SIGNAL_FILTER_TABS = [
  { value: 'all',                label: 'All'               },
  { value: 'guideline',          label: 'Guidelines'        },
  { value: 'epidemiology',       label: 'Epidemiology'      },
  { value: 'advocacy',           label: 'Advocacy'          },
  { value: 'launch-performance', label: 'Launch performance' },
]

const SIGNAL_ITEM_TYPES = new Set(['guideline', 'epidemiology', 'advocacy', 'launch-performance'])

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

// ─── Key Catalysts Calendar — data ───────────────────────────────────────────

const MONTHS_LABELS = [
  'Jan 26','Feb 26','Mar 26','Apr 26','May 26','Jun 26',
  'Jul 26','Aug 26','Sep 26','Oct 26','Nov 26','Dec 26',
]

const CONF_DATA: Record<number, string[]> = {
  3: ['EAACI','Apr 15–18','Madrid'],
  8: ['HAEi Global','Sep 24–27','Berlin'],
  9: ['ACAAI','Oct 10–14','Anaheim, CA'],
}

const IR_DATA: Record<number, string[]> = {
  4: ['BioCryst Q1','Takeda Q4 FY25','Pharvaris Q1'],
  6: ['Pharvaris','Investor Day'],
  10: ['Q3 Earnings','(All 3 cos.)'],
}

type CalCellVariant = 'default' | 'yellow' | 'blue' | 'purple'
interface CalCell { lines: string[]; v: CalCellVariant }

const CAL_CELLS: Record<string, Record<number, CalCell>> = {
  takeda: {
    3:  { lines: ['EAACI','Apr 15–18'],   v: 'default' },
    4:  { lines: ['Q4 FY25','Earnings'],  v: 'default' },
    8:  { lines: ['HAEi Global','Sep 24–27'], v: 'default' },
    9:  { lines: ['ACAAI','Oct 10–14'],   v: 'default' },
    10: { lines: ['Q3 2026','Earnings'],  v: 'default' },
  },
  biocryst: {
    3:  { lines: ['EAACI','Apr 15–18'],   v: 'default' },
    4:  { lines: ['Q1 2026','Earnings'],  v: 'default' },
    8:  { lines: ['HAEi Global','Sep 24–27'], v: 'default' },
    9:  { lines: ['ACAAI','Oct 10–14'],   v: 'default' },
    10: { lines: ['Q3 2026','Earnings'],  v: 'default' },
  },
  pharvaris: {
    3:  { lines: ['EAACI','Apr 15–18'],   v: 'default' },
    4:  { lines: ['Q1 2026','Earnings'],  v: 'default' },
    6:  { lines: ['Investor','R&D Day'],  v: 'default' },
    7:  { lines: ['RAPIDe-3','Topline'],  v: 'blue'    },
    8:  { lines: ['HAEi Global','Sep 24–27'], v: 'default' },
    9:  { lines: ['ACAAI','Oct 10–14'],   v: 'default' },
    10: { lines: ['Q3 2026','Earnings'],  v: 'default' },
    11: { lines: ['Rolling NDA','US Filing'], v: 'yellow' },
  },
  'csl-behring': {
    8:  { lines: ['HAEi Global','Sep 24–27'], v: 'default' },
    9:  { lines: ['ACAAI','Oct 10–14'],   v: 'default' },
  },
  ionis: {
    8:  { lines: ['HAEi Global','Sep 24–27'], v: 'default' },
    9:  { lines: ['ACAAI','Oct 10–14'],   v: 'default' },
  },
}

const CAL_ASSET: Record<string, string> = {
  takeda:      'Takhzyro',
  biocryst:    'Orladeyo',
  pharvaris:   'Deucrictibant',
  'csl-behring': 'Andembry',
  ionis:       'Dawnzera',
}

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

function KeyCatalystsCalendar({ count }: { count: number }) {
  const BG       = 'var(--bg-1)'
  const DIV_H    = '1px solid rgba(5,10,68,0.07)'
  const DIV_V    = '1px solid rgba(5,10,68,0.05)'
  const DIV_FC   = '1px solid rgba(5,10,68,0.10)'
  const THICK    = '2px solid rgba(5,10,68,0.10)'
  const N        = MONTHS_LABELS.length

  return (
    <div style={{ flex: 1, minWidth: 0, background: BG, border: '1.8px solid rgba(210,226,255,1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(5,10,68,0.85)' }}>Key catalysts</span>
        <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>{count} events</span>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
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
              const cells = CAL_CELLS[id] || {}
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
        <span style={{ fontSize: '38px', fontWeight: 700, color: 'var(--font-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {days}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--font-secondary)', fontWeight: 400, alignSelf: 'flex-end', paddingBottom: '5px' }}>days</span>
      </div>
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--font-primary)', lineHeight: '1.3' }}>
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
        <span style={{ fontSize: '38px', fontWeight: 700, color: 'var(--font-primary)', lineHeight: 1 }}>
          {displayValue}
        </span>
        {unit && (
          <span style={{ fontSize: '14px', color: 'var(--font-secondary)', fontWeight: 400, alignSelf: 'flex-end', paddingBottom: '5px' }}>
            {unit}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--font-primary)', lineHeight: '1.3' }}>
        {(deal.parties || []).join(' × ')}
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)' }}>
        Deal
      </p>
    </div>
  )
}

// ── Tab bar (underline style) ─────────────────────────────────────────────────
const TABS = [
  { label: 'Events'              },
  { label: 'Reports & Earnings'  },
  { label: 'Market Developments' },
]

const TAB_COUNTS = [eventsData.length, reportsData.length, marketData.length]

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      padding: '0 36px',
      borderBottom: '1px solid rgba(5,10,68,0.10)',
    }}>
      {TABS.map(({ label }, i) => {
        const isActive = active === i
        return (
          <button
            key={label}
            onClick={() => onChange(i)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '10px 20px',
              fontSize: '14px', fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--font-primary)' : 'var(--font-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '3px solid rgba(21,45,97,1)' : '3px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 150ms ease, border-color 150ms ease',
            }}
          >
            <Star size={13} />
            {label}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '22px', height: '18px', padding: '0 5px',
              borderRadius: '9999px',
              background: isActive ? 'rgba(21,45,97,1)' : 'rgba(5,10,68,0.10)',
              color: isActive ? '#FFFFFF' : 'var(--font-secondary)',
              fontSize: '11px', fontWeight: 700,
              lineHeight: 1,
            }}>
              {String(TAB_COUNTS[i]).padStart(2, '0')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: EVENTS
// ──────────────────────────────────────────────────────────────────────────────
function EventCard({ event, pastVariant, cardRef, flashing }) {
  const past = Boolean(pastVariant)
  const annotations = LEADERSHIP_ANNOTATIONS[event.type]
  const isMultiDay = Boolean(event.endDate)
  const dateLabel = isMultiDay
    ? `${formatDateAbs(event.date)} – ${formatDateAbs(event.endDate)}`
    : formatDateAbs(event.date)
  const format = event.location === 'Virtual' ? 'Virtual'
    : event.location ? event.location : 'In person'
  const digestReport = past ? findDigestForEvent(event) : null
  const primaryCompetitor = event.attendingCompetitors?.[0]

  return (
    <div
      ref={cardRef}
      style={{
        padding: '8px 0',
        display: 'flex', flexDirection: 'column', gap: '12px',
        opacity: past ? 0.65 : 1,
        background: flashing ? 'rgba(42,118,244,0.04)' : 'transparent',
        borderRadius: flashing ? '8px' : 0,
        transition: 'background 350ms ease',
        scrollMarginTop: '80px',
      }}
    >
      {/* Title row: competitor badge + title … date / format */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
          {primaryCompetitor && (
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
              <CompetitorBadge name={competitorName(primaryCompetitor)} size={20} />
            </div>
          )}
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-primary)', lineHeight: '1.5' }}>
            {event.title}
            {past && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 400, color: 'rgba(5,10,68,0.40)' }}>(past)</span>}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-secondary)', whiteSpace: 'nowrap', lineHeight: '21px' }}>{dateLabel}</p>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--font-secondary)', whiteSpace: 'nowrap', lineHeight: '18px' }}>{format}</p>
        </div>
      </div>

      {/* Expected topics — label + bullet list */}
      {event.expectedTopics?.length > 0 && (
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 500, color: 'var(--font-primary)', lineHeight: '21px' }}>Expected Topics:</p>
          <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
            {event.expectedTopics.map((topic, i) => (
              <li key={i} style={{ fontSize: '14px', lineHeight: '21px', color: 'var(--font-primary)' }}>{topic}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Annotation boxes — always shown when defined */}
      {annotations && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0, padding: '4px 8px', borderRadius: '8px', background: 'rgba(42,118,244,0.15)' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, lineHeight: '21px', color: 'var(--font-primary)' }}>What we expect:</p>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '21px', color: 'var(--font-primary)' }}>{annotations.expect}</p>
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: '4px 8px', borderRadius: '8px', background: 'rgba(16,34,74,0.15)' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, lineHeight: '21px', color: 'var(--font-primary)' }}>What would surprise us:</p>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '21px', color: 'var(--font-primary)' }}>{annotations.surprise}</p>
          </div>
        </div>
      )}

      {/* Attendees + confidence */}
      {event.attendingCompetitors?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--font-primary)' }}>Attendees:</span>
            {event.attendingCompetitors.map((id) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CompetitorBadge name={competitorName(id)} size={12} />
                <span style={{ fontSize: '12px', color: 'var(--font-primary)' }}>{competitorName(id)}</span>
              </div>
            ))}
          </div>
          {annotations && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--font-primary)' }}>Confidence:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: 'var(--status-green)', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--font-primary)' }}>Strong</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post-event digest link */}
      {digestReport && (
        <div>
          <Link
            to={`/intelligence?tab=reports&competitor=${digestReport.competitorId}`}
            style={{ fontSize: '12px', fontWeight: 600, color: '#0055BB', textDecoration: 'none', borderBottom: '1px dashed rgba(0,85,187,0.40)' }}
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
  const [filter, setFilter] = useState('all')
  const [flashedId, setFlashedId] = useState(null)
  const cardRefs = useRef(new Map())
  const leadershipMode = filter === 'leadership'

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const pastCutoffTs = TODAY.getTime() - NINETY_DAYS_MS

  const filtered = leadershipMode
    ? eventsData.filter((e) => LEADERSHIP_TYPES.has(e.type))
    : eventsData

  const upcoming = filtered
    .filter((e) => new Date(e.date) >= TODAY)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const past = filtered
    .filter((e) => {
      const ts = new Date(e.date).getTime()
      return ts < TODAY.getTime() && ts >= pastCutoffTs
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const allEvents = [...upcoming, ...past]

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

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid rgba(210,226,255,1)',
      borderRadius: '16px',
      padding: '16px',
      height: 'calc(100vh - 268px)',
      minHeight: '500px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', height: '100%' }}>

      {/* ── Left: upcoming events list ─────────────────────────────────────── */}
      <div style={{
        flex: '0 0 420px',
        background: 'var(--bg-1)',
        border: '1.8px solid rgba(210,226,255,1)',
        borderRadius: '16px',
        padding: '16px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)' }}>Upcoming events</span>
            <span style={{ fontSize: '12px', color: 'rgba(174,169,177,1)' }}>{upcoming.length} events</span>
          </div>
          <div style={{ display: 'inline-flex', padding: '4px', borderRadius: '16px', border: '1px solid rgba(210,226,255,1)', gap: '8px' }}>
            {[{ value: 'all', label: 'All events' }, { value: 'leadership', label: 'Leadership priorities' }].map((opt) => {
              const isActive = filter === opt.value
              return (
                <button key={opt.value} onClick={() => setFilter(opt.value)} style={{
                  padding: '4px 8px',
                  borderRadius: isActive ? '16px' : '12px',
                  fontSize: '14px', fontWeight: 400, border: 'none',
                  background: isActive ? 'rgba(16,34,74,1)' : 'transparent',
                  color: isActive ? 'var(--bg-1)' : 'var(--font-primary)',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 120ms ease',
                }}>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Event cards with dividers — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {upcoming.length === 0 && past.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)' }}>
              No events found
            </p>
          ) : (
            <>
              {upcoming.map((e, idx) => (
                <div key={e.id}>
                  <EventCard
                    event={e}
                    cardRef={(node) => setCardRef(e.id, node)}
                    flashing={flashedId === e.id}
                  />
                  {(idx < upcoming.length - 1 || past.length > 0) && (
                    <div style={{ height: '1px', background: 'rgba(5,10,68,0.07)' }} />
                  )}
                </div>
              ))}
              {past.map((e, idx) => (
                <div key={e.id}>
                  <EventCard
                    event={e}
                    pastVariant
                    cardRef={(node) => setCardRef(e.id, node)}
                    flashing={flashedId === e.id}
                  />
                  {idx < past.length - 1 && (
                    <div style={{ height: '1px', background: 'rgba(5,10,68,0.07)' }} />
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ flexShrink: 0, marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(5,10,68,0.07)' }}>
          <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#0055BB', borderBottom: '1px dashed rgba(0,85,187,0.45)' }}>
            Read full assessment
          </button>
        </div>
      </div>

      <KeyCatalystsCalendar count={eventsData.length} />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: REPORTS & EARNINGS
// ──────────────────────────────────────────────────────────────────────────────

const ALL_REPORT_TYPES = [...new Set(reportsData.map((r) => r.type))]

function ReportListCard({ report, isSelected, onSelect }) {
  const typeCfg = REPORT_TYPE[report.type] || { label: report.type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
  const cName = competitorName(report.competitorId)

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px',
        borderRadius: '12px',
        border: isSelected ? '1.5px solid rgba(210,226,255,1)' : '1.5px solid transparent',
        background: isSelected ? 'rgba(210,226,255,0.18)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {/* Row 1: type pill + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <TypePill cfg={typeCfg} />
        <span style={{ fontSize: '12px', color: 'var(--font-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatDateAbs(report.date)}
        </span>
      </div>

      {/* Row 2: badge + title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <div style={{ flexShrink: 0, marginTop: '1px' }}>
          <CompetitorBadge name={cName} size={20} />
        </div>
        <p style={{
          margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)', lineHeight: '1.4',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {report.title}
        </p>
      </div>

      {/* HAE extract box */}
      {report.haeExtract && (
        <div style={{ background: 'rgba(5,10,68,0.04)', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
          <p style={{ margin: '0 0 3px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)', fontWeight: 700 }}>
            HAE extract:
          </p>
          <p style={{
            margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.5',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {report.haeExtract}
          </p>
        </div>
      )}

      {/* Row 4: source + confidence */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          fontSize: '11px', color: 'rgba(5,10,68,0.40)', flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          Sources: {report.source}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(5,10,68,0.55)', flexShrink: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '9999px', background: 'var(--status-green)', display: 'inline-block' }} />
          Confidence: Strong
        </span>
      </div>
    </div>
  )
}

function ReportDetailPanel({ report }) {
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--font-secondary)' }}>
            <Star size={12} /> {typeCfg.label ?? report.type}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--font-secondary)' }}>
            <Star size={12} /> {formatDateAbs(report.date)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--font-secondary)' }}>
            <Star size={12} /> {report.source}
          </span>
        </div>
      </div>

      {/* Section 2 — KPI cards */}
      {report.kpis && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {report.kpis.map((kpi, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(21,45,97,1)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Crosshair size={12} color='rgba(255,255,255,0.5)' />
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
          ))}
        </div>
      )}

      {/* Section 3 — Signal box */}
      {report.signal && (
        <div style={{ background: 'rgba(42,118,244,0.08)', borderRadius: '10px', padding: '14px 16px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(42,118,244,0.85)' }}>
            {report.signal.label}:
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-primary)', lineHeight: '1.6' }}>
            {report.signal.text}
          </p>
        </div>
      )}

      {/* Section 4 — Implications */}
      {report.implications && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)' }}>
            {report.implications.label}
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-primary)', lineHeight: '1.7' }}>
            {report.implications.text}
          </p>
        </div>
      )}

      {/* Section 5 — HAE extract fallback (only if no kpis) */}
      {!report.kpis && report.haeExtract && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)' }}>
            HAE Extract
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-primary)', lineHeight: '1.7' }}>
            {report.haeExtract}
          </p>
        </div>
      )}

      {/* Section 6 — Quotes */}
      {report.quotes && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)' }}>
            Key Management Quotes
          </p>
          {report.quotes.map((q, i) => (
            <div key={i} style={{
              padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(5,10,68,0.08)',
              background: '#FFFFFF', marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--font-primary)', lineHeight: '1.6', flex: 1 }}>
                  "{q.text}"
                </p>
                <button
                  onClick={() => navigator.clipboard?.writeText(q.text)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', padding: '2px 4px',
                    cursor: 'pointer', fontSize: '12px', color: 'rgba(5,10,68,0.45)',
                    flexShrink: 0, fontFamily: 'inherit',
                  }}
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--font-secondary)' }}>
                {q.attribution}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportsTab() {
  const [searchParams] = useSearchParams()
  const competitorFromUrl = searchParams.get('competitor')

  // Filter state — multi-select Sets backing the dropdowns
  const [competitorFilter, setCompetitorFilter] = useState(
    () => competitorFromUrl ? new Set([competitorFromUrl]) : new Set()
  )
  const [typeFilter, setTypeFilter] = useState(() => new Set())
  const [selectedId, setSelectedId] = useState(null)

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

  const effectiveSelectedId = selectedId ?? filtered[0]?.id ?? null
  const selectedReport = filtered.find((r) => r.id === effectiveSelectedId) ?? null

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid rgba(210,226,255,1)',
      borderRadius: '16px',
      padding: '16px',
      height: 'calc(100vh - 268px)',
      minHeight: '500px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', gap: '16px', height: '100%' }}>

        {/* LEFT PANEL — report list */}
        <div style={{
          flex: '0 0 380px',
          background: 'var(--bg-1)',
          border: '1.8px solid rgba(210,226,255,1)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header row */}
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 14px 10px',
            gap: '8px',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--font-primary)' }}>Reports</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
          </div>

          {/* Scrollable list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 8px 8px' }}>
            {filtered.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)' }}>
                No reports match the current filters.
              </p>
            ) : (
              filtered.map((r, idx) => (
                <div key={r.id}>
                  <ReportListCard
                    report={r}
                    isSelected={r.id === effectiveSelectedId}
                    onSelect={() => setSelectedId(r.id)}
                  />
                  {idx < filtered.length - 1 && (
                    <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)', margin: '0 4px' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL — report detail */}
        <div style={{
          flex: 1,
          background: 'var(--bg-1)',
          border: '1.8px solid rgba(210,226,255,1)',
          borderRadius: '16px',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          <ReportDetailPanel report={selectedReport} />
        </div>

      </div>
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

  function ColHeader({ label, sortK }) {
    const isActive = sortKey === sortK
    return (
      <button
        onClick={() => toggleSort(sortK)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: isActive ? 'var(--font-primary)' : 'rgba(5,10,68,0.45)',
          userSelect: 'none', fontFamily: 'inherit',
        }}
      >
        {label}
        <span style={{ fontSize: '9px', opacity: isActive ? 1 : 0.5 }}>
          {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    )
  }

  return (
    <div style={{
      flex: '0 0 58%', minWidth: 0,
      background: 'var(--bg-1)',
      border: '1.8px solid rgba(210,226,255,1)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Panel header */}
      <div style={{ flexShrink: 0, padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--font-primary)' }}>
            Deals &amp; Partnership
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>{deals.length} deals</span>
        </div>
        {/* Column headers */}
        <div style={{ display: 'flex', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(5,10,68,0.08)' }}>
          <div style={{ flex: 1, minWidth: 0 }}><ColHeader label="Parties" sortK="parties" /></div>
          <div style={{ width: '110px', flexShrink: 0 }}><ColHeader label="Type" sortK="type" /></div>
          <div style={{ width: '68px', flexShrink: 0 }}><ColHeader label="Value" sortK="value" /></div>
          <div style={{ width: '70px', flexShrink: 0 }}><ColHeader label="Date" sortK="date" /></div>
        </div>
      </div>
      {/* Scrollable rows */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sorted.map((deal, idx) => {
          const isExpanded = expandedIds.has(deal.id)
          const typeCfg = DEAL_TYPE_CFG[deal.dealType] || { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
          const partiesLabel = (deal.parties || []).join(' & ')
          const dateLabel = formatMonthYear(deal.date)
          const valueLabel = (() => {
            const v = deal.dealValue ?? ''
            const m = v.match(/\$[\d,.]+[KMBkm]?/)
            return m ? m[0] : (v.slice(0, 8) || '—')
          })()
          return (
            <div
              key={deal.id}
              style={{ borderTop: idx === 0 ? 'none' : '1px solid rgba(5,10,68,0.06)' }}
            >
              {/* Row */}
              <div style={{ display: 'flex', gap: '8px', padding: '10px 16px 0', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--font-primary)', lineHeight: '1.4',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {partiesLabel}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic', lineHeight: '1.4',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {deal.headline}
                  </p>
                </div>
                <div style={{ width: '110px', flexShrink: 0, paddingTop: '1px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 8px', borderRadius: '9999px',
                    fontSize: '11px', fontWeight: 600,
                    background: typeCfg.bg, color: typeCfg.text, whiteSpace: 'nowrap',
                  }}>
                    {deal.dealType ?? 'Deal'}
                  </span>
                </div>
                <div style={{ width: '68px', flexShrink: 0, fontSize: '12px', fontWeight: 600,
                  color: 'var(--font-primary)', paddingTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                  {valueLabel}
                </div>
                <div style={{ width: '70px', flexShrink: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)', paddingTop: '2px' }}>
                  {dateLabel}
                </div>
              </div>
              {/* Description + expand toggle */}
              <div style={{ padding: '6px 16px 10px' }}>
                <p style={{
                  margin: '0 0 4px', fontSize: '12px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.55',
                  display: isExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: isExpanded ? undefined : 3,
                  WebkitBoxOrient: isExpanded ? undefined : 'vertical',
                  overflow: isExpanded ? 'visible' : 'hidden',
                }}>
                  {deal.summary}
                </p>
                <button
                  onClick={() => toggleExpand(deal.id)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: '12px', fontWeight: 500, color: 'rgba(5,10,68,0.55)',
                    textDecoration: 'underline', textDecorationStyle: 'dashed',
                    textUnderlineOffset: '2px', fontFamily: 'inherit',
                  }}
                >
                  {isExpanded ? 'Collapse relevance note' : 'Expand relevance note'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── HTA & Payer access panel ──────────────────────────────────────────────────
function HtaStatusBadge({ status }) {
  if (!status) return null
  const cfg = HTA_STATUS_CFG[status] || { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '9999px',
      fontSize: '11px', fontWeight: 700,
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
      background: 'var(--bg-1)',
      border: '1.8px solid rgba(210,226,255,1)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, padding: '14px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--font-primary)' }}>HTA &amp; Payer access</span>
        <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>by market</span>
      </div>
      {/* Scrollable cards */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--bg-2)',
              border: '1px solid rgba(210,226,255,0.70)',
              borderRadius: '12px',
              padding: '12px',
            }}
          >
            {/* Flag + agency + badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>{item.flagEmoji ?? '🌍'}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--font-primary)', lineHeight: '1.3',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.country}: {item.agencyShort ?? item.agency}
                </span>
              </div>
              <HtaStatusBadge status={item.htaStatusBadge} />
            </div>
            {/* Product label */}
            {item.productLabel && (
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'rgba(5,10,68,0.50)', lineHeight: '1.4' }}>
                {item.productLabel}
              </p>
            )}
            {/* Description box */}
            {item.summary && (
              <div style={{ background: 'rgba(42,118,244,0.07)', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.70)', lineHeight: '1.55' }}>
                  {item.summary}
                </p>
              </div>
            )}
            {/* Footer date */}
            {item.initiatedDate && (
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(5,10,68,0.40)' }}>
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
  const cfg = SIGNAL_CARD_CFG[item.type] || { label: item.type, labelColor: 'rgba(5,10,68,0.55)', cardBg: 'rgba(5,10,68,0.03)' }
  return (
    <div style={{
      background: cfg.cardBg,
      borderRadius: '14px',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      breakInside: 'avoid',
    }}>
      <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: cfg.labelColor }}>
        {cfg.label}
      </p>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--font-primary)', lineHeight: '1.4' }}>
        {item.headline}
      </p>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.62)', lineHeight: '1.60', flex: 1 }}>
        {item.summary}
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.40)', textAlign: 'right' }}>
        {formatMonthYear(item.date)}
      </p>
    </div>
  )
}

function MarketSignalsPanel({ items }) {
  const [activeFilter, setActiveFilter] = useState('all')

  const filtered = activeFilter === 'all'
    ? items
    : items.filter(i => i.type === activeFilter)

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--font-primary)' }}>Market Signals</span>
        <button style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: '12px', fontWeight: 500, color: 'rgba(5,10,68,0.55)',
          textDecoration: 'underline', textDecorationStyle: 'dashed',
          textUnderlineOffset: '2px', fontFamily: 'inherit',
        }}>
          View full competitor list
        </button>
      </div>
      {/* Filter pill tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {SIGNAL_FILTER_TABS.map(tab => {
          const isActive = activeFilter === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              style={{
                padding: '5px 14px', borderRadius: '9999px',
                fontSize: '13px', fontWeight: isActive ? 700 : 400,
                background: isActive ? 'rgba(21,45,97,1)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
                border: `1px solid ${isActive ? 'rgba(21,45,97,1)' : 'rgba(5,10,68,0.15)'}`,
                cursor: 'pointer', transition: 'all 120ms ease', fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {/* 3-column grid */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)' }}>
          No signals match the current filter.
        </p>
      ) : (
        <div style={{ columns: 3, columnGap: '16px' }}>
          {filtered.map(item => (
            <div key={item.id} style={{ marginBottom: '16px', breakInside: 'avoid' }}>
              <SignalCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MarketTab() {
  const deals    = [...marketData].filter(m => m.type === 'deal').sort((a, b) => new Date(b.date) - new Date(a.date))
  const htaPayer = [...marketData].filter(m => m.type === 'hta' || m.type === 'payer').sort((a, b) => new Date(b.date) - new Date(a.date))
  const signals  = [...marketData].filter(m => SIGNAL_ITEM_TYPES.has(m.type)).sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top two-panel card */}
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '16px',
        padding: '16px',
        height: '440px',
        minHeight: '360px',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: '16px', height: '100%' }}>
          <DealsPanel deals={deals} />
          <HtaPayerPanel items={htaPayer} />
        </div>
      </div>
      {/* Market Signals */}
      <MarketSignalsPanel items={signals} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TAB_NAME_TO_INDEX = { events: 0, reports: 1, market: 2 }

export default function Portal() {
  const [searchParams] = useSearchParams()
  const tabFromUrl = TAB_NAME_TO_INDEX[searchParams.get('tab')]
  const [activeTab, setActiveTab] = useState(tabFromUrl ?? 0)

  useEffect(() => {
    if (tabFromUrl !== undefined && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl])

  const nextUpcomingEvents = eventsData
    .filter((e) => !isPast(e.endDate || e.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const mostRecentDeal = [...marketData]
    .filter((m) => m.type === 'deal')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null

  const totalSignals = eventsData.length + reportsData.length + marketData.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Stats row (left) + KPI items (right) */}
      <div style={{ padding: '16px 36px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--font-secondary)' }}>
            Last refreshed: <span style={{ fontWeight: 600, color: 'var(--font-primary)' }}>2 mins ago</span>
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--font-secondary)' }}>
            <span style={{ color: 'var(--font-primary)' }}>{competitorsData.length} tracked competitors</span>
            <span style={{ margin: '0 6px' }}>•</span>
            <span style={{ color: 'var(--font-primary)' }}>{totalSignals} signals found</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '36px', flexShrink: 0 }}>
          {nextUpcomingEvents.slice(0, 1).map((e) => (
            <KpiCountdownCard key={e.id} event={e} />
          ))}
          <KpiDealCard deal={mostRecentDeal} />
        </div>
      </div>

      {/* Underline tab bar — spans full content width */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div style={{ padding: '16px 36px 36px' }}>
        <div style={{ display: activeTab === 0 ? 'block' : 'none' }}><EventsTab /></div>
        <div style={{ display: activeTab === 1 ? 'block' : 'none' }}><ReportsTab /></div>
        <div style={{ display: activeTab === 2 ? 'block' : 'none' }}><MarketTab /></div>
      </div>
    </div>
  )
}
