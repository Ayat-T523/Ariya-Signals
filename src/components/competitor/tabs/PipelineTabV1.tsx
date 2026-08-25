/**
 * PipelineTabV1.tsx — restored Competitors Pipeline tab for a REAL tracked
 * V1 company (2026-08-25, "RESTORE COMPETITORS PAGES" checkpoint, report
 * sections 9-13; asset universe hardened to canonical company+disease scope
 * in the pre-freeze unit 1 checkpoint, same date). Reproduces the
 * historical reference's lifecycle band + asset-card structure, but every
 * field is real: the asset CARD LIST is seeded from the canonical
 * company+disease asset universe (fetchLandscapeCanonicalAssets() --
 * PipelineTabV1's own CandidateDisposition.ELIGIBLE_CANDIDATE gate, never
 * distinct assetIds appearing in Signals), then each card is ENRICHED from
 * the SAME scoped LandscapeSignal/LandscapeEvidenceItem universe already
 * fetched by CompetitorProfileV1. Stage is inferred conservatively (see
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
import type { LandscapeCanonicalAsset } from '../../../lib/api/landscapeAssets'
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
  canonicalAssets: LandscapeCanonicalAsset[],
  signals: LandscapeSignal[],
  evidence: LandscapeEvidenceItem[],
  milestones: CtgovUpcomingMilestone[],
): PipelineAssetGroup[] {
  // Pre-freeze unit 1 (2026-08-25): seeded from the CANONICAL company+
  // disease asset universe (fetchLandscapeCanonicalAssets()), never from
  // Signals. Signals only ENRICH an asset that already exists canonically
  // -- they never decide whether it exists. A canonical asset with zero
  // qualifying Signals still renders (Latest/Next expected/Trial ID all
  // honestly "-"), never hidden merely because nothing has happened yet.
  //
  // A Signal whose assetId falls OUTSIDE the canonical set is a scoping/
  // identity integrity concern, not a reason to fabricate a fallback asset
  // card from a raw Signal/Evidence name -- reported to the console, never
  // silently appended as its own card.
  const canonicalIds = new Set(canonicalAssets.map((a) => a.assetId))
  const unknownSignalAssetIds = new Set(
    signals.map((s) => s.assetId).filter((id): id is string => id != null && !canonicalIds.has(id)),
  )
  if (unknownSignalAssetIds.size > 0 && typeof console !== 'undefined') {
    console.warn(
      '[PipelineTabV1] Signal(s) reference asset id(s) outside the canonical company+disease scope -- ' +
      'not rendered as Pipeline assets (scoping/identity integrity concern):',
      Array.from(unknownSignalAssetIds),
    )
  }

  return canonicalAssets.map(({ assetId, assetName }) => {
    const assetSignals = signals.filter((s) => s.assetId === assetId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    const assetEvidence = evidence.filter((e) => e.assetId === assetId)
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

// ── Lifecycle tracker ─────────────────────────────────────────────────────
// Screenshot-authority pass (pre-freeze unit 2, 2026-08-26): the reference
// product shows each asset as its OWN horizontal track with a positioned
// stage marker, not one shared band lit up by whichever stage ANY asset
// happens to have reached. Same real per-asset stage value as before
// (inferPipelineStage(), never re-inferred here) -- every canonical asset
// gets a row, including 'Unknown / Not established' ones, which render an
// honest text label instead of a fabricated marker position (never guess
// a stage just to have something to plot).
function LifecycleTracker({ groups }: { groups: PipelineAssetGroup[] }) {
  const stages = PIPELINE_LIFECYCLE_BAND
  const NAME_COL = 168
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', paddingLeft: NAME_COL + 12 }}>
        {stages.map((stage) => (
          <span key={stage} style={{
            flex: 1, fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-500)', textAlign: 'center',
          }}>
            {stage}
          </span>
        ))}
      </div>
      {groups.map((g) => {
        const rank = pipelineStageRank(g.stage)
        const pct = ((rank + 0.5) / stages.length) * 100
        return (
          <div key={g.assetId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              title={g.assetName}
              style={{
                width: NAME_COL, flexShrink: 0, fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
                color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {g.assetName}
            </span>
            {rank >= 0 ? (
              <div style={{ flex: 1, position: 'relative', height: 16 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'var(--cream-300)', transform: 'translateY(-50%)' }} />
                <div style={{ position: 'absolute', left: 0, width: `${pct}%`, top: '50%', height: 2, background: 'var(--navy-700)', transform: 'translateY(-50%)' }} />
                <div style={{
                  position: 'absolute', left: `${pct}%`, top: '50%', width: 12, height: 12, borderRadius: '50%',
                  background: 'var(--navy-700)', border: '2px solid var(--white)', boxShadow: '0 0 0 1px var(--navy-700)',
                  transform: 'translate(-50%, -50%)',
                }} />
              </div>
            ) : (
              <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 12, fontStyle: 'italic', color: 'var(--ink-500)' }}>
                Unknown / Not established
              </span>
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

export default function PipelineTabV1({ canonicalAssets, signals, evidence, milestones }: {
  canonicalAssets: LandscapeCanonicalAsset[]
  signals: LandscapeSignal[]
  evidence: LandscapeEvidenceItem[]
  milestones: CtgovUpcomingMilestone[]
}) {
  const groups = buildAssetGroups(canonicalAssets, signals, evidence, milestones)

  if (groups.length === 0) {
    return <EmptyState message="No canonical pipeline assets recorded yet for this competitor in the active disease area." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--white)', border: '1px solid var(--indigo-100)', borderRadius: 'var(--r-lg)', padding: '20px 24px' }}>
        <LifecycleTracker groups={groups} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((g) => <AssetCardV1 key={g.assetId} group={g} />)}
      </div>
    </div>
  )
}
