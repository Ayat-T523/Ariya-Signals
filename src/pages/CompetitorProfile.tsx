import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useCompetitorSupabase } from '../hooks/useCompetitorSupabase'

import { ChevronLeft, Eye } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../components/animate-ui/components/radix/tabs'
import { ExportButton } from '../components/ui/ExportButton'
import NotFoundState from '../components/ui/NotFoundState'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import AIButton from '../components/ui/AIButton'
import PipelineTab from '../components/competitor/tabs/PipelineTab'
import CompanyTab from '../components/competitor/tabs/CompanyTab'
import MessagingTab from '../components/competitor/tabs/MessagingTab'
import KeyEventsTab from '../components/competitor/tabs/KeyEventsTab'
import CompetitorProfileV1 from './CompetitorProfileV1'
import { useApp } from '../context/AppContext'
import { activeLandscapeSignalScope } from '../lib/activeLandscape'
import competitors from '../data/competitors.json'

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { label: 'Pipeline',   id: 'tab-pipeline',  panelId: 'panel-pipeline'  },
  { label: 'Company',    id: 'tab-company',   panelId: 'panel-company'   },
  { label: 'Key Events', id: 'tab-events',    panelId: 'panel-events'    },
  { label: 'Messaging',  id: 'tab-messaging', panelId: 'panel-messaging' },
]

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ activeTab, onChange, competitorId }: { activeTab: number; onChange: (i: number) => void; competitorId?: string }) {
  return (
    <div style={{ padding: '10px 36px 12px' }}>
      <Tabs
        value={String(activeTab)}
        onValueChange={(v) => {
          const i = Number(v)
          onChange(i)
          analytics.competitor_tab_viewed(TABS[i].label, competitorId)
        }}
      >
        <TabsList aria-label="Competitor profile sections" style={{ height: '34px' }}>
          {TABS.map((tab, i) => (
            <TabsTrigger key={tab.label} value={String(i)} id={tab.id} aria-controls={tab.panelId} style={{ fontSize: '13px', padding: '0 14px' }}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompetitorProfile() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState(0)

  // RESTORED COMPETITORS EXPERIENCE (2026-08-25, report section 6): a real
  // tracked V1 company (Direct/Indirect classified via Setup, no
  // competitors.json entry) gets the new real-data profile. Every other
  // case -- no active landscape at all, or a legacy-demo id -- falls
  // through to this component's original, completely untouched body below.
  const { trackedCompetitors } = useApp()
  const { hasActiveLandscape } = useMemo(
    () => activeLandscapeSignalScope(trackedCompetitors, competitors),
    [trackedCompetitors],
  )
  const trackedCompetitor = hasActiveLandscape ? trackedCompetitors.find((tc) => tc.companyId === id) : undefined

  const stubCompetitor = competitors.find((c) => c.id === id)
  const { data: liveCompetitor, isLoading } = useCompetitorSupabase(stubCompetitor ?? {})
  // Use live data when ready; while loading show stub metadata only (name/logo/header)
  // so we never flash illustrative pipeline/events/messaging content.
  const competitor = liveCompetitor ?? stubCompetitor
  useDocumentTitle((hasActiveLandscape ? trackedCompetitor?.companyName : stubCompetitor?.name) ?? 'Competitor Profile')

  if (hasActiveLandscape) {
    if (!trackedCompetitor) {
      return (
        <NotFoundState
          heading="Competitor not found"
          subtext="This competitor may have been removed or the URL may be incorrect."
          backTo="/competitors"
          backLabel="View all competitors"
        />
      )
    }
    return <CompetitorProfileV1 competitor={trackedCompetitor} />
  }

  if (!stubCompetitor) {
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

        {/* Tab bar — no overflow scroll */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} competitorId={id} />
      </div>

      {/* ── TAB CONTENT (scrollable with page) ────────────────────────────── */}
      <div style={{ padding: '20px 36px 36px', position: 'relative' }}>
        {/* Loading overlay — shown until live data replaces stub content */}
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            background: 'rgba(244,248,254,0.80)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '60px',
            backdropFilter: 'blur(2px)',
          }}>
            <p style={{ fontSize: '14px', color: 'rgba(5,10,68,0.45)', fontFamily: 'Satoshi, sans-serif' }}>
              Loading live data…
            </p>
          </div>
        )}
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
          <KeyEventsTab competitor={competitor} />
        </div>
        <div
          id={TABS[3].panelId} role="tabpanel" aria-labelledby={TABS[3].id} tabIndex={0}
          style={{ display: activeTab === 3 ? 'block' : 'none', outline: 'none' }}
        >
          <MessagingTab competitor={competitor} />
        </div>
      </div>

    </div>
  )
}
