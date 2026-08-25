/**
 * PipelineTabV1.tsx — restored Competitors Pipeline tab for a REAL tracked
 * V1 company (2026-08-25, "RESTORE COMPETITORS PAGES" checkpoint, report
 * sections 9-13). Reproduces the historical reference's lifecycle band +
 * asset-card structure, but every field is real: assets are grouped from
 * the SAME scoped LandscapeSignal/LandscapeEvidenceItem universe already
 * fetched by CompetitorProfileV1, stage is inferred conservatively (see
 * pipelineStage.ts -- never guessed), "Next expected" is a real CT.gov
 * ESTIMATED milestone, and Trial ID is a real NCT id extracted from a
 * source locator or omitted -- never a placeholder NCT0XXXXXXX.
 *
 * Never renders src/data/competitors.json's illustrative pipeline shape --
 * a legacy competitor's Pipeline tab still uses the original PipelineTab.tsx
 * component untouched (see CompetitorProfile.tsx's own branch).
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import EmptyState from '../../ui/EmptyState'
import { SIGNAL_TYPE_LABELS, type LandscapeSignal } from '../../../lib/api/landscapeSignals'
import type { LandscapeEvidenceItem } from '../../../lib/api/landscapeEvidence'
import type { CtgovUpcomingMilestone } from '../../../lib/api/upcomingMilestones'
import { inferPipelineStage, PIPELINE_LIFECYCLE_BAND, pipelineStageRank, type PipelineStage } from '../../../lib/pipelineStage'
import { formatDateAbs } from '../../../utils/formatDate'

const STAGE_BADGE_CFG: Record<PipelineStage, { bg: string; text: string }> = {
  'Preclinical':               { bg: 'var(--cream-200)',  text: 'var(--ink-600)'    },
  'Phase I':                   { bg: 'var(--info-100)',   text: 'var(--info-600)'   },
  'Phase II':                  { bg: 'var(--amber-100)',  text: 'var(--amber-800)'  },
  'Phase III':                 { bg: 'var(--indigo-100)', text: 'var(--indigo-600)' },
  'Filed':                     { bg: 'var(--terra-100)',  text: 'var(--terra-600)'  },
  'Approved':                  { bg: 'var(--sage-100)',   text: 'var(--sage-600)'   },
  'Unknown / Not established': { bg: 'var(--cream-200)',  text: 'var(--ink-500)'    },
}

function extractNctId(...locators: (string | null)[]): string | null {
  for (const loc of locators) {
    if (!loc) continue
    const m = /NCT\d{8}/i.exec(loc)
    if (m) return m[0].toUpperCase()
  }
  return null
}

interface PipelineAssetGroup {
  assetId: string
  assetName: string
  stage: PipelineStage
  signals: LandscapeSignal[]
  evidence: LandscapeEvidenceItem[]
  milestone: CtgovUpcomingMilestone | null
  nctId: string | null
}

function buildAssetGroups(
  signals: LandscapeSignal[],
  evidence: LandscapeEvidenceItem[],
  milestones: CtgovUpcomingMilestone[],
): PipelineAssetGroup[] {
  // Seeded from Signals ONLY (report section 4/10): a durably-persisted
  // evidence row can exist for many raw CT.gov trial arms/interventions that
  // never became a disease-scoped, qualifying Signal for this company (e.g.
  // "Placebo to match saxagliptin", "Blood samples") -- restoring those as
  // pipeline "assets" would be exactly the noisy raw CT.gov intervention
  // list section 10 forbids, and would silently diverge from the overview
  // card's own asset count (computeCompanyOverviewStats, same Signal-only
  // universe). Evidence is used only to ENRICH an asset that already
  // qualified via a real Signal -- never to introduce a new one.
  const ids = new Set<string>()
  signals.forEach((s) => { if (s.assetId) ids.add(s.assetId) })

  return Array.from(ids).map((assetId) => {
    const assetSignals = signals.filter((s) => s.assetId === assetId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    const assetEvidence = evidence.filter((e) => e.assetId === assetId)
    const assetName = assetSignals[0]?.assetName ?? assetEvidence.find((e) => e.assetName)?.assetName ?? assetId
    const milestone = milestones.find((m) => m.assetId === assetId) ?? null
    const nctId = extractNctId(
      milestone?.nctId ?? null,
      ...assetEvidence.map((e) => e.sourceLocator),
      ...assetSignals.map((s) => s.sourceLocator),
    )
    return {
      assetId, assetName,
      stage: inferPipelineStage(assetEvidence, assetSignals),
      signals: assetSignals, evidence: assetEvidence, milestone, nctId,
    }
  }).sort((a, b) => pipelineStageRank(b.stage) - pipelineStageRank(a.stage))
}

// ── Lifecycle band ────────────────────────────────────────────────────────
function LifecycleBand({ activeStages }: { activeStages: Set<PipelineStage> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {PIPELINE_LIFECYCLE_BAND.map((stage, i) => {
        const isActive = activeStages.has(stage)
        const isLast = i === PIPELINE_LIFECYCLE_BAND.length - 1
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : '1 1 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: isActive ? 'var(--navy-700)' : 'var(--cream-300)' }} />
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--navy-700)' : 'var(--ink-500)', whiteSpace: 'nowrap',
              }}>
                {stage}
              </span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, height: 2, margin: '0 6px 20px', background: isActive ? 'var(--navy-700)' : 'var(--cream-300)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Expandable disclosures (visual/interaction restored, content honest) ──
function ExpectedTimelineDisclosure({ milestone }: { milestone: CtgovUpcomingMilestone | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'var(--cream-100)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-600)',
      }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Expected timeline</span>
      </button>
      {open && (
        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--cream-300)' }}>
          {milestone ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)' }}>
                {milestone.milestoneType === 'PRIMARY_COMPLETION' ? 'Estimated primary completion'
                  : milestone.milestoneType === 'STUDY_COMPLETION' ? 'Estimated study completion'
                  : 'Estimated primary & study completion'}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-900)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {formatDateAbs(milestone.date)} (ESTIMATED · ClinicalTrials.gov)
                {milestone.sourceUrl && (
                  <a href={milestone.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink-600)', display: 'inline-flex' }}>
                    <ExternalLink size={12} />
                  </a>
                )}
              </span>
            </div>
          ) : (
            <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-500)', fontStyle: 'italic' }}>
              No additional source-backed milestone dates are currently available for this asset.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TrialDesignDisclosure({ evidence }: { evidence: LandscapeEvidenceItem[] }) {
  const [open, setOpen] = useState(false)
  const overallStatus = evidence.map((e) => (e.payload as any)?.overall_status).find(Boolean) as string | undefined
  return (
    <div style={{ background: 'var(--cream-100)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-600)',
      }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Trial design</span>
      </button>
      {open && (
        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--cream-300)' }}>
          {overallStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)' }}>Trial status</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-900)' }}>{overallStatus}</span>
            </div>
          ) : (
            <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-500)', fontStyle: 'italic' }}>
              No structured trial design details are available yet for this asset.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function AssetCardV1({ group }: { group: PipelineAssetGroup }) {
  const cfg = STAGE_BADGE_CFG[group.stage]
  const latest = group.signals[0] ?? null
  return (
    <div style={{
      background: 'var(--white)', borderRadius: 'var(--r-lg)', border: '1px solid var(--indigo-100)',
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          flexShrink: 0, marginTop: 2, padding: '4px 12px', borderRadius: 'var(--r-pill)',
          fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
          background: cfg.bg, color: cfg.text,
        }}>
          {group.stage}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', flex: 1, lineHeight: 1.4 }}>
          {group.assetName}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-500)' }}>Latest</p>
          <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-900)' }}>
            {latest ? `${SIGNAL_TYPE_LABELS[latest.signalType]} · ${formatDateAbs(latest.occurredAt)}` : '—'}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-500)' }}>Next expected</p>
          <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-900)' }}>
            {group.milestone ? `${formatDateAbs(group.milestone.date)} (ESTIMATED)` : '—'}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-500)' }}>Trial ID</p>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-900)' }}>
            {group.nctId ?? '—'}
          </p>
        </div>
      </div>

      <ExpectedTimelineDisclosure milestone={group.milestone} />
      <TrialDesignDisclosure evidence={group.evidence} />
    </div>
  )
}

export default function PipelineTabV1({ signals, evidence, milestones }: {
  signals: LandscapeSignal[]
  evidence: LandscapeEvidenceItem[]
  milestones: CtgovUpcomingMilestone[]
}) {
  const groups = buildAssetGroups(signals, evidence, milestones)

  if (groups.length === 0) {
    return <EmptyState message="No canonical pipeline assets recorded yet for this competitor in the active disease area." />
  }

  const activeStages = new Set(
    groups.map((g) => g.stage).filter((s): s is PipelineStage => s !== 'Unknown / Not established'),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--white)', border: '1px solid var(--indigo-100)', borderRadius: 'var(--r-lg)', padding: '20px 24px' }}>
        <LifecycleBand activeStages={activeStages} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((g) => <AssetCardV1 key={g.assetId} group={g} />)}
      </div>
    </div>
  )
}
