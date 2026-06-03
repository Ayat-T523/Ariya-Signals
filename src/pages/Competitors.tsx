import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, BarChart2, Plus } from 'lucide-react'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import competitors from '../data/competitors.json'
import alerts from '../data/alerts.json'
import { formatDate } from '../utils/formatDate'

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

// ── Quarter reference date ────────────────────────────────────────────────────
const QUARTER_CUTOFF = new Date('2026-01-01')

// ── Gantt timeline constants ──────────────────────────────────────────────────
const TL_START_YEAR = 2025  // Timeline starts Q1 2025
const TL_TOTAL_Q    = 20    // 2025–2029 = 20 quarters
const Q_W           = 65    // px per quarter
const ROW_H         = 64    // px per timeline row
const LABEL_W       = 118   // px for competitor/drug label column

const PHASE_CFG = {
  phase1: { bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.35)', text: '#5B21B6' },
  phase2: { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)', text: '#92500A' },
  phase3: { bg: 'rgba(42,118,244,0.18)', border: 'rgba(42,118,244,0.35)', text: '#0055BB' },
}

// Returns 0-based index from start of timeline
function qi(year, q) { return (year - TL_START_YEAR) * 4 + (q - 1) }
// Returns left-px position (after label column)
function qPx(year, q) { return LABEL_W + qi(year, q) * Q_W }

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

// ── Helper functions ──────────────────────────────────────────────────────────
function getQuarterlyActivity(competitorId) {
  return alerts.filter(a => a.competitorId === competitorId && new Date(a.timestamp) >= QUARTER_CUTOFF).length
}

function getMostRecentActivity(competitorId) {
  const recent = alerts
    .filter(a => a.competitorId === competitorId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
  return recent ? recent.timestamp : null
}

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
function CompetitorListItem({ competitor, isLast }) {
  const postureCfg = POSTURE_CONFIG[competitor.strategicPosture] || { bg: 'rgba(5,10,68,0.06)', text: 'rgba(5,10,68,0.55)' }
  const pipelineCount = (competitor.pipeline || []).length
  const activityCount = getQuarterlyActivity(competitor.id)
  const lastActivity = getMostRecentActivity(competitor.id)

  return (
    <div style={{ padding: '14px 14px 14px' }}>
      {/* Row 1: badge + name + posture pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CompetitorBadge name={competitor.name} size={20} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {competitor.name}
        </span>
        <span style={{
          flexShrink: 0,
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 600,
          background: postureCfg.bg,
          color: postureCfg.text,
          whiteSpace: 'nowrap',
        }}>
          {competitor.strategicPosture}
        </span>
      </div>

      {/* Row 2: description */}
      <p style={{
        margin: '6px 0 0',
        fontSize: '12px',
        color: 'rgba(5,10,68,0.62)',
        lineHeight: 1.55,
      }}>
        {competitor.oneLineDescription}
      </p>

      {/* Row 3: three-column stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: '10px' }}>
        {/* Column 1 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(5,10,68,0.38)' }}>Signals this quarter</p>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)' }}>{activityCount} signals</p>
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
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--font-primary)' }}>{formatDate(lastActivity)}</p>
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
function CompetitorCard({ competitor }) {
  const postureCfg    = POSTURE_CONFIG[competitor.strategicPosture] || { bg: 'rgba(67,76,91,0.15)', text: '#434c5b' }
  const pipelineCount = (competitor.pipeline || []).length
  const activityCount = getQuarterlyActivity(competitor.id)
  const lastActivity  = getMostRecentActivity(competitor.id)

  return (
    <Link to={`/competitors/${competitor.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '12px',
        flex: 1, cursor: 'pointer',
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
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start',
              padding: '4px 8px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', lineHeight: '21px',
              background: postureCfg.bg, color: postureCfg.text, whiteSpace: 'nowrap',
            }}>
              {competitor.strategicPosture}
            </span>
          </div>
        </div>

        {/* Description */}
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px', flex: 1 }}>
          {competitor.oneLineDescription}
        </p>

        {/* Three-column stats */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px' }}>Pipeline</span>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>{pipelineCount} assets</span>
          </div>
          <div style={{ width: '1px', height: '48px', background: 'rgba(5,10,68,0.10)', flexShrink: 0, margin: '0 4px' }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px' }}>Signals</span>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>{activityCount}</span>
          </div>
          <div style={{ width: '1px', height: '48px', background: 'rgba(5,10,68,0.10)', flexShrink: 0, margin: '0 4px' }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#708090', lineHeight: '18px' }}>Last signal</span>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px', whiteSpace: 'nowrap' }}>{formatDate(lastActivity)}</span>
          </div>
        </div>

      </div>
    </Link>
  )
}

// ── KeyCompetitorTimeline ─────────────────────────────────────────────────────
function KeyCompetitorTimeline() {
  const YEARS = [2025, 2026, 2027, 2028, 2029]
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Panel header */}
      <div style={{ flexShrink: 0, padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(5,10,68,0.06)' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--font-primary)' }}>Key competitor timelines</span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '9999px',
          background: 'rgba(42,118,244,0.10)',
          color: '#0055BB',
        }}>
          {TIMELINE_ROWS.length * 2} events
        </span>
      </div>

      {/* Scrollable area */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {/* Sticky year header row */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 4,
          background: 'var(--bg-1)',
          display: 'flex',
          borderBottom: '1px solid rgba(5,10,68,0.08)',
          minWidth: LABEL_W + TL_TOTAL_Q * Q_W,
        }}>
          {/* Left spacer */}
          <div style={{
            width: LABEL_W,
            flexShrink: 0,
            height: '28px',
            borderRight: '1px solid rgba(5,10,68,0.07)',
            background: 'rgba(5,10,68,0.03)',
          }} />
          {/* Year cells */}
          {YEARS.map((year, yi) => (
            <div key={year} style={{
              width: 4 * Q_W,
              flexShrink: 0,
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(5,10,68,0.40)',
              background: 'rgba(5,10,68,0.03)',
              borderRight: yi < YEARS.length - 1 ? '1px solid rgba(5,10,68,0.07)' : 'none',
            }}>
              {year}
            </div>
          ))}
        </div>

        {/* Sticky quarter header row */}
        <div style={{
          position: 'sticky',
          top: 28,
          zIndex: 4,
          background: 'var(--bg-1)',
          display: 'flex',
          borderBottom: '2px solid rgba(5,10,68,0.10)',
          minWidth: LABEL_W + TL_TOTAL_Q * Q_W,
        }}>
          {/* Left spacer */}
          <div style={{
            width: LABEL_W,
            flexShrink: 0,
            height: '26px',
            borderRight: '1px solid rgba(5,10,68,0.07)',
          }} />
          {/* Quarter cells */}
          {Array.from({ length: TL_TOTAL_Q }, (_, idx) => (
            <div key={idx} style={{
              width: Q_W,
              flexShrink: 0,
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 500,
              color: 'rgba(5,10,68,0.35)',
              borderRight: (idx + 1) % 4 === 0 ? '1px solid rgba(5,10,68,0.07)' : '1px solid rgba(5,10,68,0.03)',
            }}>
              {QUARTERS[idx % 4]}
            </div>
          ))}
        </div>

        {/* Rows container */}
        <div style={{ minWidth: LABEL_W + TL_TOTAL_Q * Q_W }}>
          {TIMELINE_ROWS.map((row, rowIdx) => {
            const comp = competitors.find(c => c.id === row.competitorId)
            const compName = comp?.name ?? row.competitorId

            return (
              <div key={rowIdx} style={{
                position: 'relative',
                height: ROW_H,
                borderBottom: '1px solid rgba(5,10,68,0.05)',
              }}>
                {/* Left label — sticky left */}
                <div style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: 'var(--bg-1)',
                  width: LABEL_W,
                  height: '100%',
                  borderRight: '1px solid rgba(5,10,68,0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '0 10px',
                }}>
                  <span style={{
                    fontWeight: 700,
                    fontSize: '11px',
                    color: 'rgba(5,10,68,0.80)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {compName}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: 'rgba(5,10,68,0.40)',
                    fontStyle: 'italic',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {row.drugLabel}
                  </span>
                </div>

                {/* Phase bars */}
                {row.bars.map((bar, bi) => {
                  const left = qPx(bar.sy, bar.sq)
                  const width = (qi(bar.ey, bar.eq) - qi(bar.sy, bar.sq)) * Q_W - 4
                  const cfg = PHASE_CFG[bar.phase]
                  return (
                    <div key={bi} style={{
                      position: 'absolute',
                      left,
                      width,
                      top: (ROW_H - 26) / 2,
                      height: 26,
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      overflow: 'hidden',
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: cfg.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {bar.label}
                      </span>
                    </div>
                  )
                })}

                {/* Milestones */}
                {row.milestones.map((m, mi) => {
                  const left = qPx(m.y, m.q) + Q_W / 2 - 10
                  return (
                    <div key={mi} style={{
                      position: 'absolute',
                      left,
                      top: ROW_H - 24,
                      width: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                    }}>
                      {m.type === 'filing' ? (
                        <FileText size={11} color="rgba(5,10,68,0.55)" />
                      ) : m.type === 'readout' ? (
                        <span style={{ fontSize: 8, lineHeight: 1, color: '#C01041' }}>●</span>
                      ) : m.type === 'us' ? (
                        <span style={{ fontSize: 13, lineHeight: 1 }}>🇺🇸</span>
                      ) : m.type === 'eu' ? (
                        <span style={{ fontSize: 13, lineHeight: 1 }}>🇪🇺</span>
                      ) : m.type === 'jp' ? (
                        <span style={{ fontSize: 13, lineHeight: 1 }}>🇯🇵</span>
                      ) : (
                        <span style={{ fontSize: 10, lineHeight: 1 }}>•</span>
                      )}
                      <span style={{
                        fontSize: 8,
                        color: 'rgba(5,10,68,0.45)',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}>
                        {m.label}
                      </span>
                    </div>
                  )
                })}

                {/* Quarter grid lines */}
                {Array.from({ length: TL_TOTAL_Q }, (_, idx) => (
                  <div key={idx} style={{
                    position: 'absolute',
                    left: LABEL_W + idx * Q_W,
                    top: 0,
                    width: 1,
                    height: '100%',
                    background: 'rgba(5,10,68,0.04)',
                    pointerEvents: 'none',
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
export default function Competitors() {
  const [filter, setFilter]           = useState('all')
  const [showTimeline, setShowTimeline] = useState(false)

  const filtered = competitors.filter(c => {
    if (filter === 'hae-acute')       return isHaeAcute(c)
    if (filter === 'hae-prophylaxis') return isHaeProphylaxis(c)
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 36px 36px' }}>

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
                    fontSize: '12px', fontWeight: isActive ? 700 : 400,
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
              fontSize: '13px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif',
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
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {filtered.map(c => (
              <CompetitorCard key={c.id} competitor={c} />
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
          </div>
        )}

      </div>
    </div>
  )
}
