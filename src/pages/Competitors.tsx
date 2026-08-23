import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { ChevronRight, FileText, BarChart2 } from 'lucide-react'
import { motion } from 'framer-motion'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import competitors from '../data/competitors.json'
import { formatDate } from '../utils/formatDate'
import { getAllSignalsSummary, getAllAssets, getRecentSignals, type DbSignalSummary } from '../lib/db'
import { staggerContainer, listItem, REDUCED_MOTION } from '../lib/motion'
import { usePageLoad } from '../hooks/usePageLoad'
import { SkeletonCompetitorGrid } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { useEnrichedTimelineRows } from '../hooks/useTimelineData'
import { useApp } from '../context/AppContext'
import FilterDropdown from '../components/ui/FilterDropdown'
import { currentQuarterStart, daysSince } from '../lib/clock'
import { Badge } from '../components/shadcn/ui/badge'
import { activeLandscapeSignalScope } from '../lib/activeLandscape'
import type { TrackedCompetitor } from '../config/setup-draft'

const RELATIONSHIP_LABEL: Record<'direct' | 'indirect', string> = { direct: 'Direct', indirect: 'Indirect' }

// ── Threat classification (for KPI count) ────────────────────────────────────
const HIGH_THREAT_POSTURES = new Set([
  'Incumbent to displace',
  'Emerging direct threat',
  'Emerging oral competitor',
])

// ── Threat rank for the "Threat" sort (higher = more threatening) ───────────
// Per docs/competitors-page-redesign-spec.md §2.2: direct threat > emerging
// oral/gene/RNA > adjacent > incumbent. Reuses POSTURE_CONFIG's own value set
// so the ranking and the badge coloring never drift apart.
const POSTURE_THREAT_RANK: Record<string, number> = {
  'Emerging direct threat':          4,
  'Emerging oral competitor':        3,
  'Emerging gene therapy':           3,
  'Emerging RNA-based prophylaxis':  3,
  'Adjacent oral competitor':        2,
  'Adjacent injectable prophylaxis': 2,
  'Incumbent to displace':           1,
}

// Posture badge tier — reuses the threat rank so the badge and the "Threat"
// sort can never disagree about which postures count as more dangerous.
function posturePillTier(posture: string): 'incumbent' | 'adjacent' | 'emerging' {
  const rank = POSTURE_THREAT_RANK[posture] ?? 0
  return rank >= 3 ? 'emerging' : rank === 2 ? 'adjacent' : 'incumbent'
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

// ── Competitor Card ────────────────────────────────────────────────────────
function CompetitorCard({ competitor, liveSignals, haeAssetCount, userRelationship }: { competitor: any; liveSignals?: DbSignalSummary | null; haeAssetCount: number; userRelationship?: 'direct' | 'indirect' | null }) {
  const pipelineCount  = haeAssetCount
  const signalCount    = liveSignals?.count ?? 0
  const lastSignalDate = liveSignals?.latestDate ?? null

  return (
    <Link
      to={`/competitors/${competitor.id}`}
      className="competitor-card"
      onClick={() => analytics.competitor_viewed(competitor.name)}
    >
      {/* Badge + name + posture pill */}
      <div className="cc-header">
        <CompetitorBadge name={competitor.name} size={44} />
        <div className="cc-title-group">
          <p className="cc-name">{competitor.name}</p>
          <span className={`cc-posture tier-${posturePillTier(competitor.strategicPosture)}`}>
            {competitor.strategicPosture}
          </span>
        </div>
        {/* SETUP PROPAGATION: the user's own Direct/Indirect classification from
            setup -- never Ariya's advisory read, and never shown unless the
            active landscape actually classified this company. */}
        {userRelationship && (
          <Badge
            variant={userRelationship === 'direct' ? 'default' : 'outline'}
            style={{ alignSelf: 'flex-start', flexShrink: 0 }}
          >
            {RELATIONSHIP_LABEL[userRelationship]}
          </Badge>
        )}
      </div>

      {/* Auto-composed descriptor */}
      <p className="cc-descriptor">{buildDescriptor(competitor)}</p>

      {/* Three-column stats */}
      <div className="cc-stats">
        <div className="cc-stat">
          <span className="cc-stat-label">Pipeline</span>
          <span className="cc-stat-value">{pipelineCount} assets</span>
        </div>
        <div className="cc-stat-divider" />
        <div className="cc-stat">
          <span className="cc-stat-label">
            Signals · all-time
            {liveSignals && <span className="cc-stat-live" aria-hidden="true" />}
          </span>
          <span className="cc-stat-value">{signalCount}</span>
        </div>
        <div className="cc-stat-divider" />
        <div className="cc-stat">
          <span className="cc-stat-label">
            Last signal
            {liveSignals && <span className="cc-stat-live" aria-hidden="true" />}
          </span>
          <span className="cc-stat-value">{formatDate(lastSignalDate ?? '')}</span>
        </div>
      </div>

      <span className="cc-cta">
        See more details
        <ChevronRight size={13} aria-hidden="true" />
      </span>
    </Link>
  )
}

// ── TrackedCompetitorCard ─────────────────────────────────────────────────────
// SETUP PROPAGATION: a real, backend-discovered tracked competitor with no
// legacy static/live-data profile (competitors.json / company_signals) to
// enrich it with. Deliberately does NOT reuse CompetitorCard's posture pill,
// marketedProducts/pipeline descriptor, or signal/last-signal stats -- none
// of that data truthfully exists for a company outside the legacy HAE
// roster. Shows only what setup actually produced: company name, the user's
// own Direct/Indirect classification, and the real relevant-assets evidence
// from discovery. Reuses the same .competitor-card/.cc-* classes so it sits
// visually consistent in the grid without introducing new styling.
function TrackedCompetitorCard({ competitor }: { competitor: TrackedCompetitor }) {
  return (
    <div className="competitor-card" style={{ cursor: 'default' }}>
      <div className="cc-header">
        <CompetitorBadge name={competitor.companyName} size={44} />
        <div className="cc-title-group">
          <p className="cc-name">{competitor.companyName}</p>
          <span className="cc-posture tier-incumbent">
            {competitor.source === 'manual' ? 'Manually added' : 'Discovered'}
          </span>
        </div>
        <Badge
          variant={competitor.userRelationship === 'direct' ? 'default' : 'outline'}
          style={{ alignSelf: 'flex-start', flexShrink: 0 }}
        >
          {RELATIONSHIP_LABEL[competitor.userRelationship]}
        </Badge>
      </div>

      <p className="cc-descriptor">
        {competitor.relevantAssets.length > 0
          ? `Relevant assets: ${competitor.relevantAssets.map((a) => a.identityKey).join(', ')}`
          : 'No relevant assets recorded.'}
      </p>

      <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--ink-600)' }}>
        {competitor.evidenceStatus === 'evidence_available'
          ? `${competitor.evidenceRefs.length} evidence reference${competitor.evidenceRefs.length === 1 ? '' : 's'} from discovery`
          : 'Not yet evaluated for live signals.'}
      </p>
    </div>
  )
}

// ── KeyCompetitorTimeline ─────────────────────────────────────────────────────
function KeyCompetitorTimeline({ effectiveCompetitorIds }: { effectiveCompetitorIds: Set<string> }) {
  const [qw, setQw]              = useState(52)
  const [hiddenComps, setHidden] = useState(new Set<string>())

  // Strict config scoping: only show timeline rows for the active landscape's
  // competitors (falls back to legacy watchedCompetitors when no landscape
  // has been completed yet -- see activeLandscape.ts / Competitors()).
  const watchedTimelineRows = TIMELINE_ROWS.filter(r => effectiveCompetitorIds.has(r.competitorId))

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
        borderBottom: '1px solid var(--cream-300)',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink-900)' }}>
          Key competitor timelines
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '9999px', background: 'var(--indigo-050)', color: 'var(--indigo-600)',
        }}>
          {visibleRows.length} of {watchedTimelineRows.length} programs
        </span>
        {hasAnyLive && (
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '9999px', background: 'var(--sage-050)', color: 'var(--sage-600)',
          }}>
            Live · ClinicalTrials.gov
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink-600)', fontWeight: 500, marginRight: 2 }}>Zoom</span>
          {(['Y', 'Q', 'M'] as const).map((label, i) => {
            const val = [36, 52, 78][i]
            return (
              <button key={label} type="button" onClick={() => setQw(val)} style={{
                width: 28, height: 24, borderRadius: 6,
                border: qw === val ? '1.5px solid var(--navy-700)' : '1.5px solid var(--cream-400)',
                background: qw === val ? 'var(--navy-700)' : 'transparent',
                color: qw === val ? '#FFFFFF' : 'var(--ink-600)',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--cream-400)', flexShrink: 0 }} />

        {/* Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink-600)', fontWeight: 500, marginRight: 2 }}>Filter</span>
          {uniqueCompIds.map(id => {
            const name   = (competitors as any[]).find(c => c.id === id)?.name ?? id
            const hidden = hiddenComps.has(id)
            return (
              <button key={id} type="button" onClick={() => toggleComp(id)} style={{
                padding: '2px 8px', borderRadius: '9999px',
                border: hidden ? '1.5px solid var(--cream-400)' : '1.5px solid var(--indigo-100)',
                background: hidden ? 'transparent' : 'var(--indigo-050)',
                color: hidden ? 'var(--ink-400)' : 'var(--indigo-600)',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
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
        borderBottom: '1px solid var(--cream-300)',
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
              <span style={{ fontSize: '11px', color: 'var(--ink-600)', fontWeight: 500 }}>{label}</span>
            </div>
          )
        })}
        <div style={{ width: 1, height: 14, background: 'var(--cream-400)', flexShrink: 0 }} />
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
            <span style={{ fontSize: '11px', color: 'var(--ink-600)', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Scrollable Gantt ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

        {/* Year header — always shown */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 4, background: 'var(--cream-100)',
          display: 'flex',
          borderBottom: qw === 36 ? '2px solid var(--cream-400)' : '1px solid var(--cream-300)',
          minWidth: LABEL_W + TL_TOTAL_Q * actualQw,
        }}>
          <div style={{ width: LABEL_W, flexShrink: 0, height: 28, borderRight: '1px solid var(--cream-300)', background: 'var(--cream-200)' }} />
          {YEARS.map((year, yi) => (
            <div key={year} style={{
              width: 4 * actualQw, flexShrink: 0, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink-600)',
              background: 'var(--cream-200)',
              borderRight: yi < YEARS.length - 1 ? '1px solid var(--cream-300)' : 'none',
            }}>
              {year}
            </div>
          ))}
        </div>

        {/* Quarter header — Q and M zoom only */}
        {qw !== 36 && (
          <div style={{
            position: 'sticky', top: 28, zIndex: 4, background: 'var(--cream-100)',
            display: 'flex',
            borderBottom: qw === 52 ? '2px solid var(--cream-400)' : '1px solid var(--cream-300)',
            minWidth: LABEL_W + TL_TOTAL_Q * actualQw,
          }}>
            <div style={{ width: LABEL_W, flexShrink: 0, height: 26, borderRight: '1px solid var(--cream-300)' }} />
            {Array.from({ length: TL_TOTAL_Q }, (_, idx) => (
              <div key={idx} style={{
                width: actualQw, flexShrink: 0, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--ink-600)',
                borderRight: (idx + 1) % 4 === 0 ? '1px solid var(--cream-300)' : '1px solid var(--cream-200)',
              }}>
                {QUARTERS[idx % 4]}
              </div>
            ))}
          </div>
        )}

        {/* Month header — M zoom only */}
        {qw === 78 && (
          <div style={{
            position: 'sticky', top: 54, zIndex: 4, background: 'var(--cream-100)',
            display: 'flex',
            borderBottom: '2px solid var(--cream-400)',
            minWidth: LABEL_W + TL_TOTAL_Q * actualQw,
          }}>
            <div style={{ width: LABEL_W, flexShrink: 0, height: 22, borderRight: '1px solid var(--cream-300)' }} />
            {Array.from({ length: TL_TOTAL_Q * 3 }, (_, idx) => (
              <div key={idx} style={{
                width: 26, flexShrink: 0, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--ink-400)',
                borderRight: (idx + 1) % 3 === 0 ? '1px solid var(--cream-300)' : '1px solid var(--cream-200)',
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
              <div key={rowIdx} style={{ position: 'relative', height: ROW_H, borderBottom: '1px solid var(--cream-300)' }}>

                {/* Sticky label column */}
                <div style={{
                  position: 'sticky', left: 0, zIndex: 2,
                  background: 'var(--cream-100)', width: LABEL_W, height: '100%',
                  borderRight: '1px solid var(--cream-300)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '11px', fontFamily: 'var(--font-ui)', color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {compName}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--ink-600)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                        <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--sage-600)', flexShrink: 0 }}>●</span>
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
                    background: 'rgba(42,39,34,0.04)', pointerEvents: 'none',
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

type SortMode = 'activity' | 'recent' | 'threat' | 'name'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'recent',   label: 'Recent'   },
  { value: 'threat',   label: 'Threat'   },
  { value: 'name',     label: 'Name'     },
]

export default function Competitors() {
  const { watchedCompetitors, trackedCompetitors } = useApp()
  // SETUP PROPAGATION: once a real completed landscape exists, it is
  // authoritative over the legacy HAE default -- see activeLandscape.ts.
  // `matches` also drives which trackedCompetitors get a real legacy card
  // (below) vs. the honest minimal TrackedCompetitorCard.
  const { hasActiveLandscape, legacyIds: activeLandscapeIds, matches } = useMemo(
    () => activeLandscapeSignalScope(trackedCompetitors, competitors),
    [trackedCompetitors],
  )
  const effectiveCompetitorIds = hasActiveLandscape ? activeLandscapeIds : watchedCompetitors
  // legacyId -> userRelationship, so the legacy CompetitorCard branch can show
  // the user's real Direct/Indirect classification for a matched company.
  const relationshipByLegacyId = useMemo(() => {
    const map = new Map<string, 'direct' | 'indirect'>()
    for (const m of matches) if (m.legacyId) map.set(m.legacyId, m.competitor.userRelationship)
    return map
  }, [matches])
  // Tracked competitors with no legacy profile at all -- rendered via the
  // honest minimal card, never fabricated into a rich legacy one.
  const unmatchedTrackedCompetitors: TrackedCompetitor[] = hasActiveLandscape
    ? matches.filter((m) => m.legacyId === null).map((m) => m.competitor)
    : []
  const [filter, setFilter]           = useState('all')
  const [showTimeline, setShowTimeline] = useState(false)
  const [signalsSummary, setSignalsSummary] = useState(new Map<string, DbSignalSummary>())
  const [haeAssetCountMap, setHaeAssetCountMap] = useState(new Map<string, number>())
  const [liveDataReady, setLiveDataReady] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('activity')
  const [postureFilter, setPostureFilter] = useState(new Set<string>())
  const [quarterActivity, setQuarterActivity] = useState(new Map<string, number>())
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

  // "Activity this quarter" — the sort's primary criterion (§2.2/§2.5). Window
  // is the real current quarter via the shared clock, not a frozen date.
  const watchedIds = Array.from(effectiveCompetitorIds).sort()
  useEffect(() => {
    if (watchedIds.length === 0) { setQuarterActivity(new Map()); return }
    const days = daysSince(currentQuarterStart())
    getRecentSignals(days, watchedIds).then(rows => {
      const map = new Map<string, number>()
      for (const r of rows) map.set(r.competitor_id, (map.get(r.competitor_id) ?? 0) + 1)
      setQuarterActivity(map)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedIds.join(',')])

  const postureFiltered = competitors.filter(c => {
    if (!effectiveCompetitorIds.has(c.id)) return false
    if (filter === 'hae-acute')       return isHaeAcute(c)
    if (filter === 'hae-prophylaxis') return isHaeProphylaxis(c)
    return true
  })
  const filtered = postureFiltered.filter(c => postureFilter.size === 0 || postureFilter.has(c.strategicPosture))

  const sorted = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case 'recent': {
        const aDate = signalsSummary.get(a.id)?.latestDate ?? ''
        const bDate = signalsSummary.get(b.id)?.latestDate ?? ''
        return bDate.localeCompare(aDate)
      }
      case 'threat':
        return (POSTURE_THREAT_RANK[b.strategicPosture] ?? 0) - (POSTURE_THREAT_RANK[a.strategicPosture] ?? 0)
      case 'name':
        return a.name.localeCompare(b.name)
      case 'activity':
      default:
        return (quarterActivity.get(b.id) ?? 0) - (quarterActivity.get(a.id) ?? 0)
    }
  })

  const postureOptions = Array.from(new Set(postureFiltered.map(c => c.strategicPosture)))
    .map(p => ({ value: p, label: p, count: postureFiltered.filter(c => c.strategicPosture === p).length }))

  return (
    <div className="inform-app-bg" style={{ display: 'flex', flexDirection: 'column' }}>
      <div data-tour="competitors-page" style={{ padding: '8px 36px 36px' }}>

        {/* Header: subtitle + filter pills + View Timeline button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Filter pills */}
            <div className="seg">
              {[
                { value: 'all',             label: 'All'             },
                { value: 'hae-acute',       label: 'HAE acute'       },
                { value: 'hae-prophylaxis', label: 'HAE prophylaxis' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`seg-item${filter === opt.value ? ' is-active' : ''}`}
                  onClick={() => setFilter(opt.value)}
                  style={{ border: 'none', background: filter === opt.value ? undefined : 'transparent' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
            {/* Discover competitors — Frontend Step 4 of 7 entry point */}
            <Link
              to="/competitors/discover"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-ui)',
                color: 'var(--ink-800)', textDecoration: 'none',
              }}
            >
              <span style={{ borderBottom: '1px dashed var(--ink-400)', paddingBottom: '1px', lineHeight: '1.4' }}>
                Discover competitors
              </span>
            </Link>

            {/* View Timeline toggle — text + dotted underline style */}
            <button
              onClick={() => setShowTimeline(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', padding: '0',
                cursor: 'pointer', flexShrink: 0,
                fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-ui)',
                color: 'var(--ink-800)',
              }}
            >
              <BarChart2 size={14} strokeWidth={2} aria-hidden="true" />
              <span style={{ borderBottom: '1px dashed var(--ink-400)', paddingBottom: '1px', lineHeight: '1.4' }}>
                {showTimeline ? 'Hide timeline' : 'View timeline'}
              </span>
            </button>
          </div>
        </div>

        {/* Timeline panel — shown above the grid */}
        {showTimeline && (
          <div style={{
            marginBottom: '0',
            background: 'var(--cream-100)',
            boxShadow: 'var(--neu-raised)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
            height: '520px',
            display: 'flex', flexDirection: 'column',
          }}>
            <KeyCompetitorTimeline effectiveCompetitorIds={effectiveCompetitorIds} />
          </div>
        )}

        {/* Separator between timeline and grid */}
        {showTimeline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--cream-300)' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--ink-600)', whiteSpace: 'nowrap' }}>
              Tracked competitors
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--cream-300)' }} />
          </div>
        )}

        {/* Sort + posture filter control bar (§2.2) — glass chrome, per DESIGN.md's
            two-layer model (filter bars are chrome, never neumorphic content). */}
        <div className="feed-filter-bar" style={{ margin: showTimeline ? '0 0 16px' : '4px 0 16px' }}>
          <div className="seg">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`seg-item${sortMode === opt.value ? ' is-active' : ''}`}
                onClick={() => setSortMode(opt.value)}
                style={{ border: 'none', background: sortMode === opt.value ? undefined : 'transparent' }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {postureOptions.length > 0 && (
            <FilterDropdown label="Posture" options={postureOptions} applied={postureFilter} onApply={setPostureFilter} />
          )}

          <span className="num" style={{ fontSize: '12px', color: 'var(--ink-600)', marginLeft: 'auto' }}>
            {sorted.length + unmatchedTrackedCompetitors.length} shown
          </span>
        </div>

        {/* Responsive card grid */}
        {sorted.length === 0 && unmatchedTrackedCompetitors.length === 0 ? (
          <EmptyState message="No competitors match this filter." />
        ) : (!loaded || !liveDataReady) ? (
          <SkeletonCompetitorGrid count={competitors.length} />
        ) : (
          <motion.div
            variants={staggerContainer} initial="initial" animate="animate"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}
          >
            {sorted.map(c => (
              <motion.div
                key={c.id}
                variants={listItem}
                whileHover={REDUCED_MOTION ? {} : { y: -2 }}
                transition={{ duration: 0.12 }}
              >
                <CompetitorCard
                  competitor={c}
                  liveSignals={signalsSummary.get(c.id) ?? null}
                  haeAssetCount={haeAssetCountMap.get(c.id) ?? (c.pipeline || []).length}
                  userRelationship={relationshipByLegacyId.get(c.id) ?? null}
                />
              </motion.div>
            ))}
            {/* SETUP PROPAGATION: real tracked competitors from the active
                landscape with no legacy profile -- honest minimal card, never
                fabricated into the rich legacy shape above. */}
            {unmatchedTrackedCompetitors.map((tc) => (
              <motion.div
                key={tc.companyId}
                variants={listItem}
                whileHover={REDUCED_MOTION ? {} : { y: -2 }}
                transition={{ duration: 0.12 }}
              >
                <TrackedCompetitorCard competitor={tc} />
              </motion.div>
            ))}
          </motion.div>
        )}

      </div>
    </div>
  )
}
