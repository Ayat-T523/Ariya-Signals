import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Bookmark, BookmarkCheck, Sparkles, ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import AIButton from '../components/ui/AIButton'
import ConfidenceIndicator from '../components/ui/ConfidenceIndicator'
import PipelineTab from '../components/competitor/tabs/PipelineTab'
import StrategicSignalsTab from '../components/competitor/tabs/StrategicSignalsTab'
import MessagingTab from '../components/competitor/tabs/MessagingTab'
import competitors from '../data/competitors.json'

// ── Posture pill ──────────────────────────────────────────────────────────────
const POSTURE_CONFIG = {
  'Incumbent to displace':           { bg: 'rgba(5,10,68,0.08)',    text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor':        { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Adjacent injectable prophylaxis': { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Emerging direct threat':          { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging gene therapy':           { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging oral competitor':        { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
}

function PosturePill({ posture }) {
  const cfg = POSTURE_CONFIG[posture] || { bg: '#E8EAF6', text: 'rgba(5,10,68,0.65)' }
  return (
    <span style={{
      padding: '4px 14px', borderRadius: '9999px',
      fontSize: '12px', fontWeight: 700,
      background: cfg.bg, color: cfg.text,
      letterSpacing: '0.01em',
    }}>
      {posture}
    </span>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { label: 'Pipeline' },
  { label: 'Company' },
  { label: 'Messaging' },
]

// ── Executive summary card ────────────────────────────────────────────────────
function ExecutiveSummaryCard({ summary }) {
  return (
    <div style={{
      background: '#E8EAF6',
      borderRadius: '20px',
      border: '1px solid rgba(5,10,68,0.06)',
      padding: '20px 24px',
      marginBottom: '28px',
    }}>
      {/* "AI summary" label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <Sparkles size={13} color="#0055BB" />
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#0055BB' }}>
          AI summary (illustrative)
        </span>
      </div>
      {/* Role-tailored chip (Task 3e) */}
      <div style={{ marginBottom: '12px' }}>
        <span style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 600,
          background: 'rgba(5,10,68,0.06)',
          color: 'rgba(5,10,68,0.55)',
          letterSpacing: '0.01em',
        }}>
          Summary tailored to: Commercial
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.70', color: 'rgba(5,10,68,0.78)' }}>
        {summary}
      </p>
      {/* Confidence on AI-derived executive summary */}
      <div style={{
        marginTop: '14px', paddingTop: '12px',
        borderTop: '1px solid rgba(5,10,68,0.08)',
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <ConfidenceIndicator sourceCoverage="high" dataFreshness="high" inferenceDepth="high" />
      </div>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ activeTab, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '2px solid rgba(5,10,68,0.08)',
      marginBottom: '28px',
      gap: '0',
      overflowX: 'auto',
    }}>
      {TABS.map((tab, i) => {
        const isActive = activeTab === i
        return (
          <button
            key={tab.label}
            onClick={() => onChange(i)}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'rgba(5,10,68,0.92)' : 'rgba(5,10,68,0.45)',
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid #050A44' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 150ms ease',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompetitorProfile() {
  const { id } = useParams()
  const { watchedCompetitors, toggleWatch } = useApp()
  const [activeTab, setActiveTab] = useState(0)

  const competitor = competitors.find((c) => c.id === id)
  if (!competitor) {
    return (
      <div style={{ padding: '40px 32px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(5,10,68,0.45)', fontSize: '15px' }}>
          Competitor "{id}" not found.{' '}
          <Link to="/competitors" style={{ color: '#0055BB' }}>View all competitors</Link>
        </p>
      </div>
    )
  }

  const isWatched = watchedCompetitors.has(id)

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1080px' }}>

      {/* Breadcrumb */}
      <Link
        to="/competitors"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'rgba(5,10,68,0.45)', textDecoration: 'none', marginBottom: '20px' }}
      >
        <ChevronLeft size={14} />
        Competitors
      </Link>

      {/* ── Header block ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', marginBottom: '20px' }}>
        {/* Left: badge + name + posture + one-liner */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <CompetitorBadge name={competitor.name} size={56} />
          <div>
            {/* Name with signature gradient */}
            <h1 className="text-gradient" style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, lineHeight: '1.2' }}>
              {competitor.name}
            </h1>
            <PosturePill posture={competitor.strategicPosture} />
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: 'rgba(5,10,68,0.60)', maxWidth: '560px', lineHeight: '1.55' }}>
              {competitor.oneLineDescription}
            </p>
          </div>
        </div>

        {/* Right: Watch toggle + Summarize AI button */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, paddingTop: '4px' }}>
          <button
            onClick={() => toggleWatch(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px',
              background: isWatched ? '#050A44' : 'transparent',
              color: isWatched ? '#FFFFFF' : 'rgba(5,10,68,0.65)',
              border: `1.5px solid ${isWatched ? '#050A44' : 'rgba(5,10,68,0.20)'}`,
              borderRadius: '9999px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {isWatched
              ? <><BookmarkCheck size={14} /> Watching</>
              : <><Bookmark size={14} /> Watch</>
            }
          </button>
          <AIButton source={`competitor-profile-${id}-summarize-for-me`}>
            Summarize for me
          </AIButton>
        </div>
      </div>

      {/* ── Executive summary ─────────────────────────────────────────────── */}
      <ExecutiveSummaryCard summary={competitor.executiveSummary} />

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {/* ── Tab content — CSS display toggle preserves scroll (§8) ─────── */}
      <div style={{ display: activeTab === 0 ? 'block' : 'none' }}>
        <PipelineTab competitor={competitor} />
      </div>
      <div style={{ display: activeTab === 1 ? 'block' : 'none' }}>
        <StrategicSignalsTab competitor={competitor} />
      </div>
      <div style={{ display: activeTab === 2 ? 'block' : 'none' }}>
        <MessagingTab competitor={competitor} />
      </div>

    </div>
  )
}
