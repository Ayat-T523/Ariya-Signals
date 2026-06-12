import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analytics } from '../lib/analytics'

import { ChevronLeft, ChevronDown } from 'lucide-react'
import NotFoundState from '../components/ui/NotFoundState'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import AIButton from '../components/ui/AIButton'
import ConfidenceIndicator from '../components/ui/ConfidenceIndicator'
import WhatItMeansTab from '../components/competitor/tabs/WhatItMeansTab'
import StrategicSignalsTab from '../components/competitor/tabs/StrategicSignalsTab'
import KeyEventsTab from '../components/competitor/tabs/KeyEventsTab'
import MessagingTab from '../components/competitor/tabs/MessagingTab'
import competitors from '../data/competitors.json'

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { label: 'What It Means' },
  { label: 'Signals'       },
  { label: 'Events'        },
  { label: 'Messaging'     },
]

// ── Executive summary card — matches Figma 104:777 ───────────────────────────
function ExecutiveSummaryCard({ summary }) {
  return (
    <div style={{
      background: 'rgba(42,118,244,0.15)',
      borderRadius: '8px',
      padding: '8px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      {/* Text block */}
      <div>
        <p style={{
          margin: '0 0 2px', fontSize: '12px', fontWeight: 500,
          fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px',
        }}>
          AI Summary (Illustrative)
        </p>
        <p style={{
          margin: 0, fontSize: '14px', fontWeight: 400,
          fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px',
        }}>
          {summary}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(5,10,68,0.10)', width: '100%' }} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b' }}>
            Summary tailored to:
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            borderBottom: '1px dashed #434343', paddingBottom: '2px',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434343' }}>
              Commercial
            </span>
            <ChevronDown size={8} color="#434343" />
          </span>
        </div>
        <ConfidenceIndicator sourceCoverage="high" dataFreshness="high" inferenceDepth="high" />
      </div>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ activeTab, onChange, competitorId }) {
  return (
    <div style={{
      display: 'flex',
      padding: '0 36px',
      borderBottom: '2px solid rgba(5,10,68,0.06)',
    }}>
      {TABS.map((tab, i) => {
        const isActive = activeTab === i
        return (
          <button
            key={tab.label}
            onClick={() => {
              onChange(i)
              analytics.competitor_tab_viewed(tab.label, competitorId)
            }}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontFamily: 'Satoshi, sans-serif',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#434c5b' : 'rgba(5,10,68,0.40)',
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid #434c5b' : '2px solid transparent',
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
  const [activeTab, setActiveTab] = useState(0)

  const competitor = competitors.find((c) => c.id === id)
  if (!competitor) {
    return (
      <NotFoundState
        heading="Competitor not found"
        subtext="This competitor may have been removed or the URL may be incorrect."
        backTo="/competitors"
        backLabel="View all competitors"
      />
    )
  }

  return (
    <div>

      {/* ── STICKY HEADER (company info + AI summary + tab bar) ───────────── */}
      <div data-tour="competitor-profile" style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-1)',
        boxShadow: '0 1px 0 rgba(5,10,68,0.08)',
        borderBottom: '1px solid #D2E2FF',
      }}>

        {/* Breadcrumb */}
        <div style={{ padding: '12px 36px 0' }}>
          <Link
            to="/competitors"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '14px', fontWeight: 600, color: '#10224A',
              fontFamily: 'Satoshi, sans-serif', textDecoration: 'none',
            }}
          >
            <ChevronLeft size={16} />
            Competitors
          </Link>
        </div>

        {/* Company badge + name + Ask Ariya */}
        <div style={{ padding: '8px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CompetitorBadge name={competitor.name} id={competitor.id} size={36} />
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, lineHeight: '1.2', color: '#434c5b', fontFamily: 'Satoshi, sans-serif' }}>
              {competitor.name}
            </h1>
          </div>
          <AIButton source={`competitor-profile-${id}-summarize-for-me`}>
            Ask Ariya
          </AIButton>
        </div>

        {/* AI summary card */}
        <div style={{ padding: '0 36px 10px' }}>
          <ExecutiveSummaryCard summary={competitor.executiveSummary} />
        </div>

        {/* Tab bar — no overflow scroll */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} competitorId={id} />
      </div>

      {/* ── TAB CONTENT (scrollable with page) ────────────────────────────── */}
      <div style={{ padding: '20px 36px 36px' }}>
        <div style={{ display: activeTab === 0 ? 'block' : 'none' }}>
          <WhatItMeansTab competitor={competitor} />
        </div>
        <div style={{ display: activeTab === 1 ? 'block' : 'none' }}>
          <StrategicSignalsTab competitor={competitor} />
        </div>
        <div style={{ display: activeTab === 2 ? 'block' : 'none' }}>
          <KeyEventsTab competitor={competitor} />
        </div>
        <div style={{ display: activeTab === 3 ? 'block' : 'none' }}>
          <MessagingTab competitor={competitor} />
        </div>
      </div>

    </div>
  )
}
