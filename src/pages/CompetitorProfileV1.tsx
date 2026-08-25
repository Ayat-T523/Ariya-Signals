/**
 * CompetitorProfileV1.tsx — restored Competitor profile for a REAL tracked
 * V1 company (2026-08-25, "RESTORE COMPETITORS PAGES" checkpoint, report
 * sections 6-16). Rendered by CompetitorProfile.tsx ONLY when a real active
 * landscape exists and `id` matches a real TrackedCompetitor.companyId --
 * the legacy competitors.json-backed profile (CompetitorProfile.tsx's own
 * pre-existing body) is completely untouched for every other case.
 *
 * PRODUCT BOUNDARY: no "Summarize for me" button -- no real current
 * endpoint backs it (see report section 6). The summary panel below the
 * header is a deterministic factual template (competitorOverview.ts), never
 * a new AI synthesis pipeline.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Eye } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../components/animate-ui/components/radix/tabs'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { analytics } from '../lib/analytics'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import { Badge } from '../components/shadcn/ui/badge'
import PipelineTabV1 from '../components/competitor/tabs/PipelineTabV1'
import CompanyTabV1 from '../components/competitor/tabs/CompanyTabV1'
import MessagingTabV1 from '../components/competitor/tabs/MessagingTabV1'
import { useApp, useConfig } from '../context/AppContext'
import { resolveCanonicalIndicationId, type TrackedCompetitor } from '../config/setup-draft'
import { fetchLandscapeSignals, type LandscapeSignal } from '../lib/api/landscapeSignals'
import { fetchLandscapeEvidence, type LandscapeEvidenceItem } from '../lib/api/landscapeEvidence'
import { fetchUpcomingCtgovMilestones, type CtgovUpcomingMilestone } from '../lib/api/upcomingMilestones'
import { computeCompanyOverviewStats, buildFactualCompanySummary } from '../lib/competitorOverview'

const RELATIONSHIP_LABEL: Record<'direct' | 'indirect', string> = { direct: 'Direct', indirect: 'Indirect' }

const TABS = [
  { label: 'Pipeline', id: 'tab-pipeline', panelId: 'panel-pipeline' },
  { label: 'Company',  id: 'tab-company',  panelId: 'panel-company'  },
  { label: 'Messaging', id: 'tab-messaging', panelId: 'panel-messaging' },
]

function TabBar({ activeTab, onChange, competitorId }: { activeTab: number; onChange: (i: number) => void; competitorId: string }) {
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

export default function CompetitorProfileV1({ competitor }: { competitor: TrackedCompetitor }) {
  const [activeTab, setActiveTab] = useState(0)
  const { indication } = useConfig()
  const { landscapeConfiguration, resolvedDiseaseArea } = useApp()
  const canonicalIndicationId = resolveCanonicalIndicationId(landscapeConfiguration.diseaseAreaId, resolvedDiseaseArea)

  useDocumentTitle(competitor.companyName)

  const [signals, setSignals] = useState<LandscapeSignal[]>([])
  const [evidence, setEvidence] = useState<LandscapeEvidenceItem[]>([])
  const [milestones, setMilestones] = useState<CtgovUpcomingMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchLandscapeSignals([competitor.companyId], indication, canonicalIndicationId),
      fetchLandscapeEvidence([competitor.companyId], indication, canonicalIndicationId),
      fetchUpcomingCtgovMilestones([competitor.companyId], indication, canonicalIndicationId),
    ])
      .then(([s, e, m]) => {
        if (cancelled) return
        setSignals(s); setEvidence(e); setMilestones(m); setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [competitor.companyId, indication, canonicalIndicationId])

  const stats = useMemo(() => computeCompanyOverviewStats(signals), [signals])
  const summary = useMemo(
    () => buildFactualCompanySummary(competitor.companyName, stats, indication),
    [competitor.companyName, stats, indication],
  )

  return (
    <div>
      {/* ── STICKY HEADER ─────────────────────────────────────────────── */}
      <div data-tour="competitor-profile" style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--white)', boxShadow: '0 1px 0 var(--indigo-100)',
        borderBottom: '1px solid var(--indigo-100)',
      }}>
        <div style={{ padding: '12px 36px 0' }}>
          <Link
            to="/competitors"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '14px', fontWeight: 600, color: 'var(--navy-700)',
              fontFamily: 'var(--font-ui)', textDecoration: 'none',
            }}
          >
            <ChevronLeft size={16} />
            Competitors
          </Link>
        </div>

        <div style={{ padding: '8px 36px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <CompetitorBadge name={competitor.companyName} size={36} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, lineHeight: '1.2', color: 'var(--ink-900)', fontFamily: 'var(--font-display)' }}>
                {competitor.companyName}
              </h1>
              <Badge
                variant={competitor.userRelationship === 'direct' ? 'default' : 'outline'}
                style={{ alignSelf: 'flex-start' }}
              >
                {RELATIONSHIP_LABEL[competitor.userRelationship]}
              </Badge>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Being a TrackedCompetitor IS the watch state -- no separate
                fetch/flag needed, and no "Summarize for me" button: no real
                current endpoint backs one for this profile (report section 6). */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 16px', background: 'var(--navy-700)', color: 'var(--white)',
              border: 'none', borderRadius: 'var(--r-pill)',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
            }}>
              <Eye size={13} />
              Watching
            </span>
          </div>
        </div>

        <TabBar activeTab={activeTab} onChange={setActiveTab} competitorId={competitor.companyId} />
      </div>

      {/* ── SCROLLABLE CONTENT ───────────────────────────────────────────── */}
      <div style={{ padding: '20px 36px 36px', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            background: 'rgba(247,242,234,0.80)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '60px', backdropFilter: 'blur(2px)',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--ink-500)', fontFamily: 'var(--font-ui)' }}>Loading live data…</p>
          </div>
        )}

        {/* Summary panel (Section 7): pale-blue, deterministic factual text --
            visible above every tab, never a new AI synthesis pipeline. */}
        <div style={{
          background: 'var(--indigo-050)', border: '1px solid var(--indigo-100)',
          borderRadius: 'var(--r-lg)', padding: '18px 22px', marginBottom: '20px',
        }}>
          <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--indigo-600)' }}>
            Summary
          </p>
          <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: '1.55', color: 'var(--ink-900)' }}>
            {summary}
          </p>
        </div>

        <div id={TABS[0].panelId} role="tabpanel" aria-labelledby={TABS[0].id} tabIndex={0} style={{ display: activeTab === 0 ? 'block' : 'none', outline: 'none' }}>
          <PipelineTabV1 signals={signals} evidence={evidence} milestones={milestones} />
        </div>
        <div id={TABS[1].panelId} role="tabpanel" aria-labelledby={TABS[1].id} tabIndex={0} style={{ display: activeTab === 1 ? 'block' : 'none', outline: 'none' }}>
          <CompanyTabV1 companyName={competitor.companyName} signals={signals} diseaseAreaLabel={indication} />
        </div>
        <div id={TABS[2].panelId} role="tabpanel" aria-labelledby={TABS[2].id} tabIndex={0} style={{ display: activeTab === 2 ? 'block' : 'none', outline: 'none' }}>
          <MessagingTabV1 companyName={competitor.companyName} />
        </div>
      </div>
    </div>
  )
}
