/**
 * landscapeSignals.ts — V1 Signal engine read client (2026-08-24).
 *
 * Talks to GET /api/landscape/signals on the Ariya HTTP API
 * (ariya-lightci-python/signals.py's query_landscape_signals(), fronted by
 * api_server.py -- see that route's own comment for why it derives THEN
 * reads on every call: derivation is cheap and idempotent, so callers here
 * never need a separate "derive now" trigger).
 *
 * PRODUCT BOUNDARY (do not violate): a LandscapeSignal is a durable,
 * CANONICAL, source-backed fact -- never a per-user object. `userRelationship`
 * (Direct/Indirect) is INTENTIONALLY absent from this type; it is applied
 * only at the presentation layer (see warRoomSignals.ts's own ranking
 * logic), by joining against TrackedCompetitor.userRelationship, never by
 * mutating or re-deriving the Signal itself.
 */
import { apiGet } from './client'

export type LandscapeSignalType =
  | 'CLINICAL_TRIAL_ACTIVITY'
  | 'CLINICAL_TRIAL_STATUS_CHANGE'
  | 'CLINICAL_TRIAL_PHASE_CHANGE'
  | 'CLINICAL_TRIAL_COMPLETION_OR_TERMINATION'
  | 'COMPANY_DISCLOSURE'

export type SignalImportance = 'HIGH' | 'MEDIUM' | 'LOW'

/** Plain factual labels only -- never a narrative/interpretive re-wording (report section 3's own "no invented strategic narrative" rule). */
export const SIGNAL_TYPE_LABELS: Record<LandscapeSignalType, string> = {
  CLINICAL_TRIAL_ACTIVITY: 'Clinical trial activity',
  CLINICAL_TRIAL_STATUS_CHANGE: 'Trial status change',
  CLINICAL_TRIAL_PHASE_CHANGE: 'Trial phase change',
  CLINICAL_TRIAL_COMPLETION_OR_TERMINATION: 'Trial completion/termination',
  COMPANY_DISCLOSURE: 'Company disclosure',
}

export interface LandscapeSignal {
  id: string
  signalType: LandscapeSignalType
  diseaseId: string
  companyId: string
  companyName: string | null
  assetId: string | null
  assetName: string | null
  /** The real source/event date this Signal is anchored to -- never fabricated, never discovery timing (see signals.py's own SOURCE EVENT vs DETECTED CHANGE docstring). */
  occurredAt: string
  /** When Ariya's derivation first created this Signal row -- distinct from occurredAt, never used for Month/Quarter/Year filtering. */
  detectedAt: string
  title: string
  description: string
  importance: SignalImportance
  sourceType: string
  sourceLocator: string
  evidenceId: string
  priorEvidenceId: string | null
}

function toLandscapeSignal(raw: any): LandscapeSignal {
  return {
    id: raw.id,
    signalType: raw.signal_type,
    diseaseId: raw.disease_id,
    companyId: raw.company_id,
    companyName: raw.company_name ?? null,
    assetId: raw.asset_id ?? null,
    assetName: raw.asset_name ?? null,
    occurredAt: raw.occurred_at,
    detectedAt: raw.detected_at,
    title: raw.title,
    description: raw.description,
    importance: raw.importance,
    sourceType: raw.source_type,
    sourceLocator: raw.source_locator,
    evidenceId: raw.evidence_id,
    priorEvidenceId: raw.prior_evidence_id ?? null,
  }
}

/**
 * `companyIds` must be canonical backend company keys -- SAME contract as
 * fetchLandscapeEvidence()'s own docstring (a manually-added competitor's
 * companyId has no durable evidence/Signal to match, and is honestly
 * excluded by the caller before this function is ever invoked).
 *
 * `lookbackDays`, when supplied, is the ONE shared Month(30)/Quarter(90)/
 * Year(365) contract (src/lib/timeHorizon.ts) -- forwarded verbatim to the
 * backend's own read-side filter on `occurred_at`.
 */
export async function fetchLandscapeSignals(
  companyIds: string[],
  indication?: string | null,
  indicationId?: string | null,
  lookbackDays?: number | null,
): Promise<LandscapeSignal[]> {
  if (companyIds.length === 0) return []
  if (!indication && !indicationId) return []
  const params: Record<string, string> = { companies: companyIds.join(',') }
  if (indication) params.indication = indication
  if (indicationId) params.indication_id = indicationId
  if (lookbackDays) params.lookback_days = String(lookbackDays)
  const raw = await apiGet<{ items: any[] }>('/api/landscape/signals', params)
  return (raw.items ?? []).map(toLandscapeSignal)
}
