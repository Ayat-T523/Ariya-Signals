import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { ChevronRight, FileText, BarChart2, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import competitors from '../data/competitors.json'
import { formatDate } from '../utils/formatDate'
import { getAllSignalsSummary, getAllAssets, type DbSignalSummary } from '../lib/db'
import { staggerContainer, listItem, REDUCED_MOTION } from '../lib/motion'
import { usePageLoad } from '../hooks/usePageLoad'
import { SkeletonCompetitorGrid } from '../components/ui/Skeleton'
import { useEnrichedTimelineRows } from '../hooks/useTimelineData'
import { useApp } from '../context/AppContext'

// ── Threat classification (for KPI count) ────────────────────────────────────
const HIGH_THREAT_POSTURES = new Set([
  'Incumbent to displace',
  'Emerging direct threat',
  'Emerging oral competitor',
])

// ── Strategic posture badge colours ──────────────────────────────────────────
const POSTURE_CONFIG = {
  'Incumbent to displace':           { bg: 'rgba(5,10,68,0.08)',    text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor':        { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Adjacent injectable prophylaxis': { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Emerging direct threat':          { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging gene therapy':           { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging oral competitor':        { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging RNA-based prophylaxis':  { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
}

// ── Auto-composed competitor descriptor ──────────────────────────────────────
function buildDescriptor(c: any): string {
  const marketed: any[] = c.marketedProducts ?? []
  const pipeline: any[] = c.pipeline ?? []
  const mktStr = marketed.length === 0
    ? 'No approved products'
    : marketed.map((p: any) => p.name + (p.approvalYear ? ` (${p.approvalYear})` : '')).join(', ')
  const lastPhase = pipeline.at(-1)?.phase ?? null
  const pplStr = pipeline.length === 0
    ? 'No pipeline'
    : `${pipeline.length} asset${pipeline.length > 1 ? 's' : ''}${lastPhase ? ` (${lastPhase})` : ''}`
  return `Marketed: ${mktStr} · Pipeline: ${pplStr}`
}

// ── Quarter reference date ────────────────────────────────────────────────────
const QUARTER_CUTOFF = new Date('2026-01-01')

// ── Gantt phase colours ───────────────────────────────────────────────────────
const PHASE_CFG: Record<string, { bg: string; border: string; text: string }> = {
  phase1: { bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.35)', text: '#5B21B6' },
  phase2: { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)', text: '#92500A' },
  phase3: { bg: 'rgba(42,118,244,0.18)', border: 'rgba(42,118,244,0.35)', text: '#0055BB' },
}

const COUNTRY_CFG: Record<string, { border: string; bg: string; flag: string; textColor: string; regulatorLabel: string }> = {
  us: { border: 'rgba(26,86,219,0.65)',  bg: 'rgba(26,86,219,0.10)', flag: '🇺🇸', textColor: '#1a56db', regulatorLabel: 'FDA'  },
  eu: { border: 'rgba(0,52,114,0.65)',   bg: 'rgba(0,52,114,0.10)',  flag: '🇪🇺', textColor: '#003472', regulatorLabel: 'EMA'  },
  jp: { border: 'rgba(188,0,45,0.60)',   bg: 'rgba(188,0,45,0.08)', flag: '🇯🇵', textColor: '#bc002d', regulatorLabel: 'PMDA' },
}

// ── Custom Gantt layout constants ────────────────────────────────────────────
const TL_START_YEAR = 2025
const YEARS         = [2025, 2026, 2027, 2028, 2029]
const TL_TOTAL_Q    = YEARS.length * 4
const QUARTERS      = ['Q1', 'Q2', 'Q3', 'Q4']
const MONTHS        = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const ROW_H         = 76
const LABEL_W       = 186

// Timeline rows — each entry represents one competitor/drug row
const TIMELINE_ROWS = [
  {
    competitorId: 'pharvaris',
    drugLabel: 'Deucrictibant',
    bars: [
      { sy: 2025, sq: 1, ey: 2026, eq: 3, label: 'Phase III RAPIDe-3 (N=130)', phase: 'phase3' },
    ],
    milestones: [
      { y: 2026, q: 3, type: 'readout', label: 'Topline' },
      { y: 2027, q: 1, type: 'filing',  label: 'Rolling NDA' },
      { y: 2027, q: 3, type: 'us',      label: 'US' },
      { y: 2028, q: 1, type: 'eu',      label: 'EU' },
    ],
  },
  {
    competitorId: 'pharvaris',
    drugLabel: 'Deucrictibant (PPX)',
    bars: [
      { sy: 2026, sq: 3, ey: 2028, eq: 2, label: 'Phase III prophylaxis (planned)', phase: 'phase3' },
    ],
    milestones: [],
  },
  {
    competitorId: 'biocryst',
    drugLabel: 'BCX17725 (ER)',
    bars: [
      { sy: 2025, sq: 4, ey: 2026, eq: 3, label: 'Phase I', phase: 'phase1' },
      { sy: 2026, sq: 4, ey: 2028, eq: 3, label: 'Phase III ALPHA ORBIT (N=145)', phase: 'phase3' },
    ],
    milestones: [
      { y: 2028, q: 4, type: 'filing', label: 'NDA' },
    ],
  },
  {
    competitorId: 'biocryst',
    drugLabel: 'Orladeyo (pediatric)',
    bars: [
      { sy: 2025, sq: 1, ey: 2026, eq: 4, label: 'Phase III pediatric (APeX-P)', phase: 'phase3' },
    ],
    milestones: [
      { y: 2026, q: 4, type: 'readout', label: 'PCD' },
      { y: 2027, q: 3, type: 'us',      label: 'US' },
      { y: 2027, q: 4, type: 'jp',      label: 'JP' },
      { y: 2028, q: 1, type: 'eu',      label: 'EU' },
    ],
  },
  {
    competitorId: 'csl-behring',
    drugLabel: 'Andembry (pediatric)',
    bars: [
      { sy: 2025, sq: 2, ey: 2027, eq: 1, label: 'Phase III HAELO (N=60)', phase: 'phase3' },
    ],
    milestones: [
      { y: 2027, q: 1, type: 'readout', label: 'PCD' },
      { y: 2027, q: 3, type: 'filing',  label: 'sBLA' },
      { y: 2028, q: 2, type: 'us',      label: 'US' },
    ],
  },
  {
    competitorId: 'ionis',
    drugLabel: 'Donidalorsen (LCM)',
    bars: [
      { sy: 2026, sq: 1, ey: 2026, eq: 4, label: 'Phase II extended dosing', phase: 'phase2' },
      { sy: 2027, sq: 2, ey: 2029, eq: 1, label: 'Phase III (quarterly dosing)', phase: 'phase3' },
    ],
    milestones: [
      { y: 2029, q: 1, type: 'filing', label: 'sNDA' },
    ],
  },
  {
    competitorId: 'astria',
    drugLabel: 'STAR-0215',
    bars: [
      { sy: 2025, sq: 1, ey: 2026, eq: 2, label: 'Phase II (ALPHA-STAR)', phase: 'phase2' },
      { sy: 2026, sq: 4, ey: 2028, eq: 3, label: 'Phase III ALPHA ORBIT', phase: 'phase3' },
    ],
    milestones: [
      { y: 2028, q: 4, type: 'filing', label: 'NDA' },
      { y: 2029, q: 3, type: 'us',     label: 'US' },
    ],
  },
  {
    competitorId: 'takeda',
    drugLabel: 'TAK-079',
    bars: [
      { sy: 2025, sq: 2, ey: 2026, eq: 4, label: 'Phase II (enrollment)', phase: 'phase2' },
      { sy: 2027, sq: 1, ey: 2028, eq: 4, label: 'Phase III (planned)', phase: 'phase3' },
    ],
    milestones: [],
  },
]


function isHaeAcute(c) {
  return (
    c.pipeline?.some(p => p.indicationSubtype?.toLowerCase().includes('on-demand')) ||
    c.marketedProducts?.some(p => p.indication?.toLowerCase().includes('on-demand'))
  )
}

function isHaeProphylaxis(c) {
  return (
    c.pipeline?.some(p => p.indicationSubtype?.toLowerCase().includes('prophylaxis')) ||
    c.marketedProducts?.some(p => p.indication?.toLowerCase().includes('prophylaxis'))
  )
}

// ── CompetitorListItem ────────────────────────────────────────────────────────
function CompetitorListItem({ competitor, isLast, haeAssetCount }: { competitor: any; isLast: boolean; haeAssetCount: number }) {
  const pipelineCount = haeAssetCount

  return (
    <div style={{ padding: '14px 14px 14px' }}>
      {/* Row 1: badge + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CompetitorBadge name={competitor.name} size={20} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {competitor.name}
        </span>
      </div>

      {/* Row 2: auto-composed descriptor */}
      <p style={{
        margin: '6px 0 0',
        fontSize: '12px',
        color: 'rgba(5,10,68,0.62)',
        lineHeight: 1.55,
      }}>
        {buildDescriptor(competitor)}
      </p>

      {/* Row 3: three-column stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: '10px' }}>
        {/* Column 1 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(5,10,68,0.38)' }}>Signals this quarter</p>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)' }}>— signals</p>
        </div>
        {/* Divider */}
        <div style={{ width: '1px', height: '32px', background: 'rgba(5,10,68,0.08)', margin: '0 12px', flexShrink: 0 }} />
        {/* Column 2 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(5,10,68,0.38)' }}>Pipeline</p>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)' }}>{pipelineCount} assets</p>
        </div>
        {/* Divider */}
        <div style={{ width: '1px', height: '32px', background: 'rgba(5,10,68,0.08)', margin: '0 12px', flexShrink: 0 }} />
        {/* Column 3 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(5,10,68,0.38)' }}>Last signal</p>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)' }}>—</p>
        </div>
      </div>

      {/* Row 4: See more details button */}
      <div style={{ marginTop: '12px' }}>
        <Link to={`/competitors/${competitor.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(21,45,97,1)',
            color: '#FFFFFF',
            borderRadius: '9999px',
            padding: '7px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            See more details
            <ChevronRight size={13} />
          </div>
        </Link>
      </div>

      {/* Divider */}
      {!isLast && (
        <div style={{ borderBottom: '1px solid rgba(5,10,68,0.06)', marginTop: '14px' }} />
      )}
    </div>
  )
}

// ── Competitor Card (Figma 84:1682) ──────────────────────────────────────────
function CompetitorCard({ competitor, liveSignals, haeAssetCount }: { competitor: any; liveSignals?: DbSignalSummary | null; haeAssetCount: number }) {
  const [hovered, setHovered] = useState(false)
  const pipelineCount  = haeAssetCount
  const signalCount    = liveSignals?.count ?? 0
  const lastSignalDate = liveSignals?.latestDate ?? null

  return (
    <Link
      to={`/competitors/${competitor.id}`}
      style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => analytics.competitor_viewed(competitor.name)}
    >
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '12px',
        flex: 1, cursor: 'pointer',
        transition: 'box-shadow 200ms ease',
        boxShadow: hovered
          ? '0px 0px 12px 2px rgba(194,219,255,0.80), 0px 0px 40px 4px rgba(194,219,255,0.48)'
          : 'none',
      }}>

        {/* Badge + name + posture pill */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            <CompetitorBadge name={competitor.name} size={44} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '1.25' }}>
              {competitor.name}
            </p>
          </div>
        </div>

        {/* Auto-composed descriptor */}
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: 'rgba(5,10,68,0.62)', lineHeight: '1.55', flex: 1 }}>
          {buildDescriptor(competitor)}
        </p>

        {/* Three-column stats */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px' }}>Pipeline</span>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>{pipelineCount} assets</span>
          </div>
          <div style={{ width: '1px', height: '48px', background: 'rgba(5,10,68,0.10)', flexShrink: 0, margin: '0 4px' }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px' }}>Signals</span>
              {liveSignals && <span style={{ fontSize: 8, color: '#15803d', lineHeight: 1 }}>●</span>}
            </div>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>{signalCount}</span>
          </div>
          <div style={{ width: '1px', height: '48px', background: 'rgba(5,10,68,0.10)', flexShrink: 0, margin: '0 4px' }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px' }}>Last signal</span>
              {liveSignals && <span style={{ fontSize: 8, color: '#15803d', lineHeight: 1 }}>●</span>}
            </div>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px', whiteSpace: 'nowrap' }}>{formatDate(lastSignalDate ?? '')}</span>
          </div>
        </div>

      </div>
    </Link>
  )
}

// ── KeyCompetitorTimeline ─────────────────────────────────────────────────────
function KeyCompetitorTimeline() {
  const { watchedCompetitors } = useApp()
  const [qw, setQw]              = useState(52)
  const [hiddenComps, setHidden] = useState(new Set<string>())

  // Strict config scoping: only show timeline rows for watched competitors
  const watchedTimelineRows = TIMELINE_ROWS.filter(r => watchedCompetitors.has(r.competitorId))

  const containerRef = useRef<HTMLDivElement>(null)
  // Bump counter on viewport resize so re-render reads the current clientWidth
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const { rows: liveRows, hasAnyLive } = useEnrichedTimelineRows(watchedTimelineRows)

  // Read clientWidth directly from ref (populated after first mount)
  // At Y zoom expand to fill container; Q/M keep their fixed values
  const containerWidth = containerRef.current?.clientWidth ?? 900
  const actualQw = qw === 36
    ? Math.max(36, Math.floor((containerWidth - LABEL_W) / TL_TOTAL_Q))
    : qw

  function qi(y: number, q: number): number { return (y - TL_START_YEAR) * 4 + (q - 1) }
  function qPx(y: number, q: number): number { return LABEL_W + qi(y, q) * actualQw }

  const visibleRows   = hiddenComps.size === 0
    ? liveRows
    : liveRows.filter(r => !hiddenComps.has(r.competitorId))

  const uniqueCompIds = [...new Set(watchedTimelineRows.map(r => r.competitorId))]

  function toggleComp(id: string) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        borderBottom: '1px solid rgba(5,10,68,0.06)',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--font-primary)' }}>
          Key competitor timelines
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '9999px', background: 'rgba(42,118,244,0.10)', color: '#0055BB',
        }}>
          {visibleRows.length} of {watchedTimelineRows.length} programs
        </span>
        {hasAnyLive && (
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '9999px', background: 'rgba(22,163,74,0.10)', color: '#15803d',
          }}>
            Live · ClinicalTrials.gov
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.40)', fontWeight: 500, marginRight: 2 }}>Zoom</span>
          {(['Y', 'Q', 'M'] as const).map((label, i) => {
            const val = [36, 52, 78][i]
            return (
              <button key={label} onClick={() => setQw(val)} style={{
                width: 28, height: 24, borderRadius: 6,
                border: qw === val ? '1.5px solid #050A44' : '1.5px solid rgba(5,10,68,0.12)',
                background: qw === val ? '#050A44' : 'transparent',
                color: qw === val ? '#FFFFFF' : 'rgba(5,10,68,0.50)',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(5,10,68,0.10)', flexShrink: 0 }} />

        {/* Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.40)', fontWeight: 500, marginRight: 2 }}>Filter</span>
          {uniqueCompIds.map(id => {
            const name   = (competitors as any[]).find(c => c.id === id)?.name ?? id
            const hidden = hiddenComps.has(id)
            return (
              <button key={id} onClick={() => toggleComp(id)} style={{
                padding: '2px 8px', borderRadius: '9999px',
                border: hidden ? '1.5px solid rgba(5,10,68,0.10)' : '1.5px solid rgba(42,118,244,0.30)',
                background: hidden ? 'transparent' : 'rgba(42,118,244,0.08)',
                color: hidden ? 'rgba(5,10,68,0.30)' : '#0055BB',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                textDecoration: hidden ? 'line-through' : 'none',
                transition: 'all 120ms ease',
              }}>
                {name}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
        padding: '6px 16px',
        borderBottom: '1px solid rgba(5,10,68,0.06)',
      }}>
        {([
          { label: 'Phase I',   k: 'phase1' },
          { label: 'Phase II',  k: 'phase2' },
          { label: 'Phase III', k: 'phase3' },
        ] as const).map(({ label, k }) => {
          const cfg = PHASE_CFG[k]
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: 16, height: 10, borderRadius: 3, background: cfg.bg, border: `1.5px solid ${cfg.border}`, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.55)', fontWeight: 500 }}>{label}</span>
            </div>
          )
        })}
        <div style={{ width: 1, height: 14, background: 'rgba(5,10,68,0.12)', flexShrink: 0 }} />
        {[
          {
            node: (
              <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: 'rgba(192,16,65,0.15)', border: '1.5px solid #C01041', borderRadius: 1 }} />
              </div>
            ),
            label: 'Readout',
          },
          {
            node: (
              <div style={{ width: 13, height: 15, background: 'rgba(70,70,220,0.10)', border: '1px solid rgba(70,70,220,0.40)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={9} color="rgba(70,70,220,0.75)" />
              </div>
            ),
            label: 'Filing',
          },
          { node: <span style={{ fontSize: 13, lineHeight: 1 }}>🇺🇸</span>, label: 'FDA'  },
          { node: <span style={{ fontSize: 13, lineHeight: 1 }}>🇪🇺</span>, label: 'EMA'  },
          { node: <span style={{ fontSize: 13, lineHeight: 1 }}>🇯🇵</span>, label: 'PMDA' },
        ].map(({ node, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {node}
            <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.55)', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Scrollable Gantt ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

        {/* Year header — always shown */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 4, background: 'var(--bg-1)',
          display: 'flex',
          borderBottom: qw === 36 ? '2px solid rgba(5,10,68,0.10)' : '1px solid rgba(5,10,68,0.08)',
          minWidth: LABEL_W + TL_TOTAL_Q * actualQw,
        }}>
          <div style={{ width: LABEL_W, flexShrink: 0, height: 28, borderRight: '1px solid rgba(5,10,68,0.07)', background: 'rgba(5,10,68,0.03)' }} />
          {YEARS.map((year, yi) => (
            <div key={year} style={{
              width: 4 * actualQw, flexShrink: 0, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'rgba(5,10,68,0.40)',
              background: 'rgba(5,10,68,0.03)',
              borderRight: yi < YEARS.length - 1 ? '1px solid rgba(5,10,68,0.07)' : 'none',
            }}>
              {year}
            </div>
          ))}
        </div>

        {/* Quarter header — Q and M zoom only */}
        {qw !== 36 && (
          <div style={{
            position: 'sticky', top: 28, zIndex: 4, background: 'var(--bg-1)',
            display: 'flex',
            borderBottom: qw === 52 ? '2px solid rgba(5,10,68,0.10)' : '1px solid rgba(5,10,68,0.08)',
            minWidth: LABEL_W + TL_TOTAL_Q * actualQw,
          }}>
            <div style={{ width: LABEL_W, flexShrink: 0, height: 26, borderRight: '1px solid rgba(5,10,68,0.07)' }} />
            {Array.from({ length: TL_TOTAL_Q }, (_, idx) => (
              <div key={idx} style={{
                width: actualQw, flexShrink: 0, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 500, color: 'rgba(5,10,68,0.35)',
                borderRight: (idx + 1) % 4 === 0 ? '1px solid rgba(5,10,68,0.07)' : '1px solid rgba(5,10,68,0.03)',
              }}>
                {QUARTERS[idx % 4]}
              </div>
            ))}
          </div>
        )}

        {/* Month header — M zoom only */}
        {qw === 78 && (
          <div style={{
            position: 'sticky', top: 54, zIndex: 4, background: 'var(--bg-1)',
            display: 'flex',
            borderBottom: '2px solid rgba(5,10,68,0.10)',
            minWidth: LABEL_W + TL_TOTAL_Q * actualQw,
          }}>
            <div style={{ width: LABEL_W, flexShrink: 0, height: 22, borderRight: '1px solid rgba(5,10,68,0.07)' }} />
            {Array.from({ length: TL_TOTAL_Q * 3 }, (_, idx) => (
              <div key={idx} style={{
                width: 26, flexShrink: 0, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 500, color: 'rgba(5,10,68,0.30)',
                borderRight: (idx + 1) % 3 === 0 ? '1px solid rgba(5,10,68,0.07)' : '1px solid rgba(5,10,68,0.03)',
              }}>
                {MONTHS[idx % 12]}
              </div>
            ))}
          </div>
        )}

        {/* Rows */}
        <div style={{ minWidth: LABEL_W + TL_TOTAL_Q * actualQw }}>
          {visibleRows.map((row, rowIdx) => {
            const compName = (competitors as any[]).find(c => c.id === row.competitorId)?.name ?? row.competitorId

            return (
              <div key={rowIdx} style={{ position: 'relative', height: ROW_H, borderBottom: '1px solid rgba(5,10,68,0.05)' }}>

                {/* Sticky label column */}
                <div style={{
                  position: 'sticky', left: 0, zIndex: 2,
                  background: 'var(--bg-1)', width: LABEL_W, height: '100%',
                  borderRight: '1px solid rgba(5,10,68,0.07)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '11px', color: 'rgba(5,10,68,0.80)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {compName}
                  </span>
                  <span style={{ fontSize: '10px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.drugLabel}
                  </span>
                </div>

                {/* Phase bars */}
                {row.bars.map((bar, bi) => {
                  const left  = qPx(bar.sy, bar.sq)
                  const width = Math.max(4, (qi(bar.ey, bar.eq) - qi(bar.sy, bar.sq)) * actualQw - 4)
                  const cfg   = PHASE_CFG[bar.phase]
                  return (
                    <div key={bi} style={{
                      position: 'absolute', left, width,
                      top: (ROW_H - 28) / 2, height: 28,
                      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6,
                      display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: cfg.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {bar.label}
                      </span>
                      {bar._live && (
                        <span style={{ marginLeft: 4, fontSize: 8, color: '#15803d', flexShrink: 0 }}>●</span>
                      )}
                    </div>
                  )
                })}

                {/* Milestones */}
                {row.milestones.map((m, mi) => {
                  const left  = qPx(m.y, m.q) + actualQw / 2 - 16
                  const ccfg  = COUNTRY_CFG[m.type]
                  return (
                    <div key={mi} style={{
                      position: 'absolute', left,
                      top: ROW_H - 36, width: 32,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}>
                      {ccfg ? (
                        <>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            border: `2px solid ${ccfg.border}`,
                            background: ccfg.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <span style={{ fontSize: 14, lineHeight: 1 }}>{ccfg.flag}</span>
                          </div>
                          <span style={{ fontSize: 8, fontWeight: 700, color: ccfg.textColor, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
                            {ccfg.regulatorLabel}
                          </span>
                        </>
                      ) : m.type === 'filing' ? (
                        <>
                          <div style={{
                            width: 20, height: 22,
                            background: 'rgba(70,70,220,0.10)',
                            border: '1.5px solid rgba(70,70,220,0.40)',
                            borderRadius: 3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <FileText size={13} color="rgba(70,70,220,0.75)" />
                          </div>
                          <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(70,70,220,0.75)', letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
                            {m.label}
                          </span>
                        </>
                      ) : (
                        <>
                          <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{
                              width: 14, height: 14,
                              transform: 'rotate(45deg)',
                              background: 'rgba(192,16,65,0.15)',
                              border: '2px solid #C01041',
                              borderRadius: 2,
                            }} />
                          </div>
                          <span style={{ fontSize: 8, fontWeight: 700, color: '#C01041', letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
                            {m.label}
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}

                {/* Quarter grid lines */}
                {Array.from({ length: TL_TOTAL_Q }, (_, idx) => (
                  <div key={idx} style={{
                    position: 'absolute', left: LABEL_W + idx * actualQw,
                    top: 0, width: 1, height: '100%',
                    background: 'rgba(5,10,68,0.04)', pointerEvents: 'none',
                  }} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
// HAE indication_tags matching — same terms as useCompetitorSupabase INDICATION_TAGS
const HAE_TAG_TERMS_COMP = ['hereditary angioedema', 'hae']

export default function Competitors() {
  const { watchedCompetitors } = useApp()
  const [filter, setFilter]           = useState('all')
  const [showTimeline, setShowTimeline] = useState(false)
  const [signalsSummary, setSignalsSummary] = useState(new Map<string, DbSignalSummary>())
  const [haeAssetCountMap, setHaeAssetCountMap] = useState(new Map<string, number>())
  const [liveDataReady, setLiveDataReady] = useState(false)
  const loaded = usePageLoad('competitors')

  useEffect(() => {
    let sigsDone = false
    let assetsDone = false
    function checkReady() { if (sigsDone && assetsDone) setLiveDataReady(true) }

    getAllSignalsSummary().then(data => { setSignalsSummary(data); sigsDone = true; checkReady() })
    getAllAssets().then(assets => {
      const map = new Map<string, number>()
      for (const a of assets) {
        if (!a.competitor_id) continue
        const isHAE = a.indication_tags?.some(tag =>
          HAE_TAG_TERMS_COMP.some(term => tag.toLowerCase().includes(term))
        )
        if (isHAE) map.set(a.competitor_id, (map.get(a.competitor_id) ?? 0) + 1)
      }
      setHaeAssetCountMap(map)
      assetsDone = true
      checkReady()
    })
  }, [])

  const filtered = competitors.filter(c => {
    if (!watchedCompetitors.has(c.id)) return false
    if (filter === 'hae-acute')       return isHaeAcute(c)
    if (filter === 'hae-prophylaxis') return isHaeProphylaxis(c)
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div data-tour="competitors-page" style={{ padding: '8px 36px 36px' }}>

        {/* Header: subtitle + filter pills + View Timeline button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Filter pills */}
            <div style={{ display: 'inline-flex', padding: '3px', borderRadius: '9999px', border: '1px solid rgba(210,226,255,1)', gap: '2px' }}>
              {[
                { value: 'all',             label: 'All'             },
                { value: 'hae-acute',       label: 'HAE acute'       },
                { value: 'hae-prophylaxis', label: 'HAE prophylaxis' },
              ].map(opt => {
                const isActive = filter === opt.value
                return (
                  <button key={opt.value} onClick={() => setFilter(opt.value)} style={{
                    padding: '4px 10px', borderRadius: '9999px',
                    fontSize: '14px', fontWeight: isActive ? 700 : 400,
                    background: isActive ? 'rgba(21,45,97,1)' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 120ms ease', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* View Timeline toggle — text + dotted underline style */}
          <button
            onClick={() => setShowTimeline(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', padding: '0',
              cursor: 'pointer', flexShrink: 0,
              fontSize: '14px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif',
              color: '#10224A',
            }}
          >
            <BarChart2 size={14} strokeWidth={2} color="#10224A" />
            <span style={{ borderBottom: '1px dashed #10224A', paddingBottom: '1px', lineHeight: '1.4' }}>
              {showTimeline ? 'Hide timeline' : 'View timeline'}
            </span>
          </button>
        </div>

        {/* Timeline panel — shown above the grid */}
        {showTimeline && (
          <div style={{
            marginBottom: '0',
            border: '1px solid rgba(210,226,255,1)',
            borderRadius: '16px',
            overflow: 'hidden',
            height: '520px',
            display: 'flex', flexDirection: 'column',
          }}>
            <KeyCompetitorTimeline />
          </div>
        )}

        {/* Separator between timeline and grid */}
        {showTimeline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(5,10,68,0.07)' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: 'rgba(5,10,68,0.35)', whiteSpace: 'nowrap' }}>
              Tracked competitors
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(5,10,68,0.07)' }} />
          </div>
        )}

        {/* 3-column card grid */}
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px', fontSize: '13px', color: 'rgba(5,10,68,0.40)' }}>
            No competitors match this filter.
          </p>
        ) : (!loaded || !liveDataReady) ? (
          <SkeletonCompetitorGrid count={competitors.length} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}
          >
            {filtered.map(c => (
              <motion.div
                key={c.id}
                variants={listItem}
                whileHover={REDUCED_MOTION ? {} : { y: -2 }}
                transition={{ duration: 0.12 }}
              >
                <CompetitorCard competitor={c} liveSignals={signalsSummary.get(c.id) ?? null} haeAssetCount={haeAssetCountMap.get(c.id) ?? (c.pipeline || []).length} />
              </motion.div>
            ))}

            {/* Add competitor placeholder */}
            <div style={{
              border: '1px dashed rgba(210,226,255,1)',
              borderRadius: '16px',
              padding: '10px',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                background: 'rgba(112,128,144,0.10)',
                borderRadius: '12px',
                flex: 1, minHeight: '160px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                <div style={{
                  background: 'rgba(112,128,144,0.50)',
                  borderRadius: '9999px', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Plus size={20} color="#ffffff" strokeWidth={2} />
                </div>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '1.25' }}>
                  Add competitor
                </p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px', textAlign: 'center' }}>
                  Available in paid version
                </p>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
