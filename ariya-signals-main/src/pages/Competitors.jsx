import { Link } from 'react-router-dom'
import { Plus, Activity } from 'lucide-react'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import competitors from '../data/competitors.json'
import alerts from '../data/alerts.json'
import { formatDateAbs } from '../utils/formatDate'

const POSTURE_CONFIG = {
  'Incumbent to displace':           { bg: 'rgba(5,10,68,0.08)',    text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor':        { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Adjacent injectable prophylaxis': { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Emerging direct threat':          { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging gene therapy':           { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging oral competitor':        { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
}

// Count alerts in last ~90 days (this quarter + last) as "activity this quarter"
const QUARTER_CUTOFF = new Date('2026-01-01')

function getQuarterlyActivity(competitorId) {
  return alerts.filter((a) => {
    if (a.competitorId !== competitorId) return false
    return new Date(a.timestamp) >= QUARTER_CUTOFF
  }).length
}

function getMostRecentActivity(competitorId) {
  const recent = alerts
    .filter((a) => a.competitorId === competitorId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
  return recent ? recent.timestamp : null
}

function ActivityDots({ count }) {
  const max = 8
  const dots = Math.min(count, max)
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: dots }).map((_, i) => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: i < 3 ? '#0055BB' : i < 6 ? '#6B9FFF' : '#C5D5FF',
        }} />
      ))}
      {count > max && (
        <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.40)', marginLeft: '2px' }}>+{count - max}</span>
      )}
    </div>
  )
}

function CompetitorCard({ competitor }) {
  const postureCfg = POSTURE_CONFIG[competitor.strategicPosture] || { bg: '#E8EAF6', text: 'rgba(5,10,68,0.65)' }
  const pipelineCount = (competitor.pipeline || []).length
  const activityCount = getQuarterlyActivity(competitor.id)
  const lastActivity = getMostRecentActivity(competitor.id)

  return (
    <Link
      to={`/competitors/${competitor.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div
        className="hover-lift"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid rgba(5,10,68,0.08)',
          boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04)',
          padding: '24px',
          cursor: 'pointer',
          height: '100%',
        }}
      >
        {/* Badge + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <CompetitorBadge name={competitor.name} size={48} />
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
              {competitor.name}
            </h2>
            <span style={{
              display: 'inline-block', marginTop: '4px',
              padding: '2px 10px', borderRadius: '9999px',
              fontSize: '11px', fontWeight: 700,
              background: postureCfg.bg, color: postureCfg.text,
            }}>
              {competitor.strategicPosture}
            </span>
          </div>
        </div>

        {/* One-liner */}
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(5,10,68,0.60)', lineHeight: '1.55' }}>
          {competitor.oneLineDescription}
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
              Pipeline assets
            </p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'rgba(5,10,68,0.88)', fontVariantNumeric: 'tabular-nums' }}>
              {pipelineCount}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
              Last signal
            </p>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.70)' }}>
              {lastActivity ? formatDateAbs(lastActivity) : '—'}
            </p>
          </div>
        </div>

        {/* Activity this quarter */}
        <div style={{ borderTop: '1px solid rgba(5,10,68,0.06)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Activity size={12} color="rgba(5,10,68,0.35)" />
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
              Activity this quarter — {activityCount} signals
            </p>
          </div>
          <ActivityDots count={activityCount} />
        </div>
      </div>
    </Link>
  )
}

// ── Disabled "Add competitor" card (§4.3) ─────────────────────────────────────
function AddCompetitorCard() {
  return (
    <div
      title="Available in paid version"
      style={{
        background: '#FAFAFA',
        borderRadius: '20px',
        border: '1.5px dashed rgba(5,10,68,0.15)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        minHeight: '200px',
        cursor: 'not-allowed',
        opacity: 0.55,
      }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background: 'rgba(5,10,68,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Plus size={18} color="rgba(5,10,68,0.50)" />
      </div>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.50)', textAlign: 'center' }}>
        Add competitor
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.35)', textAlign: 'center' }}>
        Available in paid version
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Competitors() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Tracked Competitors
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.50)' }}>
          {competitors.length} competitors tracked · HAE therapeutic area
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {competitors.map((c) => (
          <CompetitorCard key={c.id} competitor={c} />
        ))}
        <AddCompetitorCard />
      </div>
    </div>
  )
}
