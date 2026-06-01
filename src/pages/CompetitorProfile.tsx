import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Bookmark, BookmarkCheck, Sparkles, ChevronLeft,
  DollarSign, TrendingUp, FlaskConical, Crosshair,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import AIButton from '../components/ui/AIButton'
import ConfidenceIndicator from '../components/ui/ConfidenceIndicator'
import WhatItMeansTab from '../components/competitor/tabs/WhatItMeansTab'
import PipelineTab from '../components/competitor/tabs/PipelineTab'
import StrategicSignalsTab from '../components/competitor/tabs/StrategicSignalsTab'
import KeyEventsTab from '../components/competitor/tabs/KeyEventsTab'
import MessagingTab from '../components/competitor/tabs/MessagingTab'
import competitors from '../data/competitors.json'

// ── Posture pill ──────────────────────────────────────────────────────────────
const POSTURE_CONFIG = {
  'Incumbent to displace':           { bg: 'rgba(5,10,68,0.08)',   text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor':        { bg: 'rgba(0,85,187,0.10)',  text: '#0055BB'             },
  'Adjacent injectable prophylaxis': { bg: 'rgba(0,85,187,0.10)',  text: '#0055BB'             },
  'Emerging direct threat':          { bg: 'rgba(225,29,72,0.10)', text: '#C01041'             },
  'Emerging gene therapy':           { bg: 'rgba(225,29,72,0.10)', text: '#C01041'             },
  'Emerging oral competitor':        { bg: 'rgba(225,29,72,0.10)', text: '#C01041'             },
}

function PosturePill({ posture }) {
  const cfg = POSTURE_CONFIG[posture] || { bg: 'rgba(5,10,68,0.06)', text: 'rgba(5,10,68,0.65)' }
  return (
    <span style={{
      padding: '3px 12px', borderRadius: '9999px',
      fontSize: '12px', fontWeight: 700,
      background: cfg.bg, color: cfg.text,
      letterSpacing: '0.01em',
    }}>
      {posture}
    </span>
  )
}

// ── KPI item (matches Portal's established format) ────────────────────────────
function KpiItem({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Crosshair size={12} color='rgba(5,10,68,0.35)' />
        <span style={{
          fontSize: '22px', fontWeight: 700,
          color: 'rgba(5,10,68,0.88)', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '11px', color: 'rgba(5,10,68,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </p>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { label: 'What It Means' },
  { label: 'Pipeline'      },
  { label: 'Signals'       },
  { label: 'Events'        },
  { label: 'Messaging'     },
]

// ── Executive summary card (compact sticky variant) ──────────────────────────
function ExecutiveSummaryCard({ summary }) {
  return (
    <div style={{
      background: '#E8EAF6',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.06)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'flex-start', gap: '10px',
    }}>
      <Sparkles size={13} color="#0055BB" style={{ flexShrink: 0, marginTop: '2px' }} />
      <p style={{
        margin: 0,
        fontSize: '13px',
        lineHeight: '1.60',
        color: 'rgba(5,10,68,0.78)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        flex: 1,
      }}>
        {summary}
      </p>
      <div style={{ flexShrink: 0, paddingTop: '1px' }}>
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
      padding: '0 32px',
      borderBottom: '2px solid rgba(5,10,68,0.08)',
    }}>
      {TABS.map((tab, i) => {
        const isActive = activeTab === i
        return (
          <button
            key={tab.label}
            onClick={() => onChange(i)}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
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
  const fin = competitor.financials || {}
  const pipelineCount = competitor.pipeline?.length ?? 0

  const kpis = [
    { icon: DollarSign,   label: 'Total Revenue', value: fin.totalRevenue ?? '—'                                          },
    { icon: TrendingUp,   label: 'R&D Spend',     value: fin.rdSpend ?? '—'                                              },
    { icon: FlaskConical, label: 'HAE Pipeline',  value: pipelineCount > 0 ? `${pipelineCount}` : '—'                   },
  ]

  return (
    <div>

      {/* ── STICKY HEADER (company info + AI summary + tab bar) ───────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-1)',
        boxShadow: '0 1px 0 rgba(5,10,68,0.08)',
      }}>

        {/* Breadcrumb */}
        <div style={{ padding: '12px 32px 0' }}>
          <Link
            to="/competitors"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '12px', color: 'rgba(5,10,68,0.40)', textDecoration: 'none',
            }}
          >
            <ChevronLeft size={13} />
            Competitors
          </Link>
        </div>

        {/* ── Company header: left (badge + info + buttons) | right (KPIs) ── */}
        <div style={{
          padding: '10px 32px 10px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '24px',
        }}>

          {/* Left — badge + name + posture + one-liner + CTAs */}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <CompetitorBadge name={competitor.name} id={competitor.id} size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h1
                  className="text-gradient"
                  style={{ margin: 0, fontSize: '22px', fontWeight: 700, lineHeight: '1.2' }}
                >
                  {competitor.name}
                </h1>
                <PosturePill posture={competitor.strategicPosture} />
              </div>
              <p style={{
                margin: '0 0 8px', fontSize: '12px',
                color: 'rgba(5,10,68,0.55)', lineHeight: '1.4',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '480px',
              }}>
                {competitor.oneLineDescription}
              </p>
              {/* CTA buttons */}
              <div style={{ display: 'flex', gap: '7px' }}>
                <button
                  onClick={() => toggleWatch(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px',
                    background: isWatched ? '#050A44' : 'transparent',
                    color: isWatched ? '#FFFFFF' : 'rgba(5,10,68,0.65)',
                    border: `1.5px solid ${isWatched ? '#050A44' : 'rgba(5,10,68,0.20)'}`,
                    borderRadius: '9999px',
                    fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  {isWatched
                    ? <><BookmarkCheck size={13} /> Watching</>
                    : <><Bookmark size={13} /> Watch</>
                  }
                </button>
                <AIButton source={`competitor-profile-${id}-summarize-for-me`}>
                  Summarize for me
                </AIButton>
              </div>
            </div>
          </div>

          {/* Right — KPI items (Portal established format) */}
          <div style={{
            display: 'flex', gap: '32px',
            flexShrink: 0, alignItems: 'center',
          }}>
            {kpis.map((kpi) => (
              <KpiItem key={kpi.label} icon={kpi.icon} label={kpi.label} value={kpi.value} />
            ))}
          </div>
        </div>

        {/* AI summary card */}
        <div style={{ padding: '0 32px 10px' }}>
          <ExecutiveSummaryCard summary={competitor.executiveSummary} />
        </div>

        {/* Tab bar — no overflow scroll */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── TAB CONTENT (scrollable with page) ────────────────────────────── */}
      <div style={{ padding: '28px 32px 40px' }}>
        <div style={{ display: activeTab === 0 ? 'block' : 'none' }}>
          <WhatItMeansTab competitor={competitor} />
        </div>
        <div style={{ display: activeTab === 1 ? 'block' : 'none' }}>
          <PipelineTab competitor={competitor} />
        </div>
        <div style={{ display: activeTab === 2 ? 'block' : 'none' }}>
          <StrategicSignalsTab competitor={competitor} />
        </div>
        <div style={{ display: activeTab === 3 ? 'block' : 'none' }}>
          <KeyEventsTab competitor={competitor} />
        </div>
        <div style={{ display: activeTab === 4 ? 'block' : 'none' }}>
          <MessagingTab competitor={competitor} />
        </div>
      </div>

    </div>
  )
}
