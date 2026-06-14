import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

import { ChevronLeft, ChevronDown, Eye } from 'lucide-react'
import { ExportButton } from '../components/ui/ExportButton'
import NotFoundState from '../components/ui/NotFoundState'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import AIButton from '../components/ui/AIButton'
import ConfidenceIndicator from '../components/ui/ConfidenceIndicator'
import PipelineTab from '../components/competitor/tabs/PipelineTab'
import CompanyTab from '../components/competitor/tabs/CompanyTab'
import MessagingTab from '../components/competitor/tabs/MessagingTab'
import competitors from '../data/competitors.json'

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { label: 'Pipeline',  id: 'tab-pipeline',  panelId: 'panel-pipeline'  },
  { label: 'Company',   id: 'tab-company',   panelId: 'panel-company'   },
  { label: 'Messaging', id: 'tab-messaging', panelId: 'panel-messaging' },
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
  function handleKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange((i + 1) % TABS.length) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); onChange((i - 1 + TABS.length) % TABS.length) }
    if (e.key === 'Home')       { e.preventDefault(); onChange(0) }
    if (e.key === 'End')        { e.preventDefault(); onChange(TABS.length - 1) }
  }
  return (
    <div
      role="tablist"
      aria-label="Competitor profile sections"
      style={{
        display: 'flex',
        padding: '0 36px',
        borderBottom: '2px solid rgba(5,10,68,0.06)',
      }}
    >
      {TABS.map((tab, i) => {
        const isActive = activeTab === i
        return (
          <button
            key={tab.label}
            id={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={tab.panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              onChange(i)
              analytics.competitor_tab_viewed(tab.label, competitorId)
            }}
            onKeyDown={(e) => handleKeyDown(e, i)}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontFamily: 'Satoshi, sans-serif',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#434c5b' : 'rgba(5,10,68,0.55)',
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
  useDocumentTitle(competitor?.name ?? 'Competitor Profile')
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

        {/* Company badge + name + buttons */}
        <div style={{ padding: '8px 36px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <CompetitorBadge name={competitor.name} id={competitor.id} size={36} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, lineHeight: '1.2', color: '#434c5b', fontFamily: 'Satoshi, sans-serif' }}>
                {competitor.name}
              </h1>
              {(competitor as any).strategicPosture && (
                <span style={{
                  display: 'inline-block', alignSelf: 'flex-start',
                  padding: '2px 10px', borderRadius: '9999px',
                  fontSize: '11px', fontWeight: 600,
                  background: 'rgba(5,10,68,0.07)', color: 'rgba(5,10,68,0.65)',
                  fontFamily: 'Satoshi, sans-serif',
                }}>
                  {(competitor as any).strategicPosture}
                </span>
              )}
              {(competitor as any).oneLineDescription && (
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.5', fontFamily: 'Satoshi, sans-serif', maxWidth: '480px' }}>
                  {(competitor as any).oneLineDescription}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <ExportButton label="Export" />
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 16px',
              background: '#10224A', color: '#ffffff',
              border: 'none', borderRadius: '9999px',
              fontSize: '13px', fontWeight: 600,
              fontFamily: 'Satoshi, sans-serif',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <Eye size={13} />
              Watching
            </button>
            <AIButton source={`competitor-profile-${id}-summarize-for-me`}>
              Summarise for me
            </AIButton>
          </div>
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
        <div
          id={TABS[0].panelId} role="tabpanel" aria-labelledby={TABS[0].id} tabIndex={0}
          style={{ display: activeTab === 0 ? 'block' : 'none', outline: 'none' }}
        >
          <PipelineTab competitor={competitor} />
        </div>
        <div
          id={TABS[1].panelId} role="tabpanel" aria-labelledby={TABS[1].id} tabIndex={0}
          style={{ display: activeTab === 1 ? 'block' : 'none', outline: 'none' }}
        >
          <CompanyTab competitor={competitor} />
        </div>
        <div
          id={TABS[2].panelId} role="tabpanel" aria-labelledby={TABS[2].id} tabIndex={0}
          style={{ display: activeTab === 2 ? 'block' : 'none', outline: 'none' }}
        >
          <MessagingTab competitor={competitor} />
        </div>
      </div>

    </div>
  )
}
