/**
 * pipelineStage.ts — conservative Preclinical/Phase I/II/III/Filed/Approved
 * stage inference for the restored Competitors Pipeline tab (2026-08-25,
 * "RESTORE COMPETITORS PAGES" checkpoint, report sections 9-11).
 *
 * Never guesses: an asset with no real trial-phase/regulatory/approval
 * evidence is "Unknown / Not established", not a default phase. Filed is
 * deliberately NOT inferred from REGULATORY_DECISION (which can represent a
 * rejection, not an acceptance) -- only from REGULATORY_SUBMISSION/
 * REGULATORY_ACCEPTANCE, per the checkpoint task's own "do not infer Filed
 * merely from regulatory chatter" instruction. Approved requires a real FDA
 * original_approval_date / EMA marketing_authorisation_date in the evidence
 * payload, or a REGULATORY_APPROVAL/COMMERCIAL_LAUNCH Signal -- never
 * inferred from a late trial phase alone.
 */
import type { LandscapeEvidenceItem } from './api/landscapeEvidence'
import type { LandscapeSignal } from './api/landscapeSignals'

export type PipelineStage =
  | 'Preclinical' | 'Phase I' | 'Phase II' | 'Phase III' | 'Filed' | 'Approved'
  | 'Unknown / Not established'

// PHASE4 folds into the "Phase III" bucket -- the 6-stage lifecycle band has
// no separate post-marketing-study bucket (see setup-draft's own 6-step
// PHASE_STEPS convention, unchanged since checkpoint 1).
const PHASE_RANK: Record<string, number> = {
  PHASE1: 1,
  PHASE2: 2,
  PHASE3: 3,
  PHASE4: 3,
}

export function inferPipelineStage(
  evidenceForAsset: LandscapeEvidenceItem[],
  signalsForAsset: LandscapeSignal[],
): PipelineStage {
  const hasApproval =
    evidenceForAsset.some((e) => Boolean((e.payload as any)?.original_approval_date || (e.payload as any)?.marketing_authorisation_date)) ||
    signalsForAsset.some((s) => s.signalType === 'REGULATORY_APPROVAL' || s.signalType === 'COMMERCIAL_LAUNCH')
  if (hasApproval) return 'Approved'

  const hasFiled = signalsForAsset.some((s) => s.signalType === 'REGULATORY_SUBMISSION' || s.signalType === 'REGULATORY_ACCEPTANCE')
  if (hasFiled) return 'Filed'

  let highestPhaseRank = 0
  for (const e of evidenceForAsset) {
    const phases: unknown = (e.payload as any)?.trial_phases
    if (!Array.isArray(phases)) continue
    for (const p of phases) {
      const key = String(p).toUpperCase().replace(/[^A-Z0-9]/g, '')
      const rank = PHASE_RANK[key] ?? 0
      if (rank > highestPhaseRank) highestPhaseRank = rank
    }
  }
  if (highestPhaseRank === 3) return 'Phase III'
  if (highestPhaseRank === 2) return 'Phase II'
  if (highestPhaseRank === 1) return 'Phase I'

  return 'Unknown / Not established'
}

export const PIPELINE_LIFECYCLE_BAND: readonly PipelineStage[] = [
  'Preclinical', 'Phase I', 'Phase II', 'Phase III', 'Filed', 'Approved',
]

export function pipelineStageRank(stage: PipelineStage): number {
  return PIPELINE_LIFECYCLE_BAND.indexOf(stage as any)
}
