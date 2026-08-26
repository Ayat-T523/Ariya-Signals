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

// Intelligence Feed checkpoint (2026-08-25, report section 2/5): this union
// previously only listed 5 values and was missing every explicit CT.gov
// source-event type (TRIAL_FIRST_POSTED, etc.) and the full Company PR/SEC
// EDGAR taxonomy (signals.py's own _COMPANY_PR_EVENT_VERBS) -- meaning
// SIGNAL_TYPE_LABELS[signal.signalType] silently rendered `undefined` for
// every real Signal currently in the database (LandscapeSignalRow.tsx's own
// type-label span). `CLINICAL_TRIAL_ACTIVITY` is kept even though signals.py
// no longer emits it (see that module's own comment) -- existing test
// fixtures (landscapeSignals.test.ts/signalRanking.test.ts) still use it as
// an arbitrary placeholder value, unrelated to this fix's own scope.
export type LandscapeSignalType =
  | 'CLINICAL_TRIAL_ACTIVITY'
  | 'TRIAL_FIRST_POSTED'
  | 'RESULTS_FIRST_POSTED'
  | 'PRIMARY_COMPLETION_REACHED'
  | 'TRIAL_COMPLETED'
  | 'CLINICAL_TRIAL_STATUS_CHANGE'
  | 'CLINICAL_TRIAL_PHASE_CHANGE'
  | 'CLINICAL_TRIAL_COMPLETION_OR_TERMINATION'
  | 'REGULATORY_APPROVAL'
  | 'CLINICAL_RESULTS'
  | 'CLINICAL_MILESTONE'
  | 'REGULATORY_SUBMISSION'
  | 'REGULATORY_ACCEPTANCE'
  | 'REGULATORY_DECISION'
  | 'COMMERCIAL_LAUNCH'
  | 'PARTNERSHIP_OR_LICENSE'
  | 'ACQUISITION_OR_MERGER'
  | 'PROGRAM_DISCONTINUATION'
  | 'CORPORATE_STRATEGY_CHANGE'
  | 'COMPANY_DISCLOSURE'
  // V1 PubMed integration checkpoint (2026-08-26): the backend's new
  // ariya-lightci-python/signals.py PUBLICATION_RESULTS Signal type (a
  // real, NCT-attributed, RCT/Phase-III peer-reviewed publication --
  // source_type "pubmed"). Added here so this union stays the single,
  // complete mirror of the backend's own signal_type vocabulary (see this
  // union's own top-of-file comment) -- SIGNAL_TYPE_LABELS below is a
  // `Record<LandscapeSignalType, string>`, so TypeScript itself enforces
  // that no member of this union is ever missing a label.
  | 'PUBLICATION_RESULTS'

export type SignalImportance = 'HIGH' | 'MEDIUM' | 'LOW'

/** Plain factual labels only -- never a narrative/interpretive re-wording (report section 3's own "no invented strategic narrative" rule). */
export const SIGNAL_TYPE_LABELS: Record<LandscapeSignalType, string> = {
  CLINICAL_TRIAL_ACTIVITY: 'Clinical trial activity',
  TRIAL_FIRST_POSTED: 'Trial first posted',
  RESULTS_FIRST_POSTED: 'Results first posted',
  PRIMARY_COMPLETION_REACHED: 'Primary completion reached',
  TRIAL_COMPLETED: 'Trial completed',
  CLINICAL_TRIAL_STATUS_CHANGE: 'Trial status change',
  CLINICAL_TRIAL_PHASE_CHANGE: 'Trial phase change',
  CLINICAL_TRIAL_COMPLETION_OR_TERMINATION: 'Trial completion/termination',
  REGULATORY_APPROVAL: 'Regulatory approval',
  CLINICAL_RESULTS: 'Clinical results',
  CLINICAL_MILESTONE: 'Clinical milestone',
  REGULATORY_SUBMISSION: 'Regulatory submission',
  REGULATORY_ACCEPTANCE: 'Regulatory acceptance',
  REGULATORY_DECISION: 'Regulatory decision',
  COMMERCIAL_LAUNCH: 'Commercial launch',
  PARTNERSHIP_OR_LICENSE: 'Partnership or license',
  ACQUISITION_OR_MERGER: 'Acquisition or merger',
  PROGRAM_DISCONTINUATION: 'Program discontinuation',
  CORPORATE_STRATEGY_CHANGE: 'Corporate strategy change',
  COMPANY_DISCLOSURE: 'Company disclosure',
  PUBLICATION_RESULTS: 'Publication results',
}

// V1 PubMed integration checkpoint (2026-08-26): a small, additive label
// map for `LandscapeSignal.sourceType` -- that field is a plain `string`
// (not a closed union, since the backend's own evidence/signal source_type
// vocabulary is intentionally open-ended, see this file's own
// toLandscapeSignal() comment), so this is a lookup with a safe fallback
// to the raw value, never a Record requiring exhaustiveness. Covers every
// source_type ariya-lightci-python/signals.py currently emits a Signal
// for. No current renderer displays `sourceType` as raw text to a user
// (confirmed by inspection -- CompanyTabV1.tsx only counts distinct
// values today), so this is added defensively, ready for whichever
// component next needs an intelligible source label, rather than a fix to
// an already-broken display.
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  clinicaltrials_gov: 'ClinicalTrials.gov',
  fda_drugs_at_fda: 'FDA',
  ema_epar: 'EMA',
  company_disclosure: 'Company disclosure',
  sec_edgar: 'SEC EDGAR',
  pubmed: 'PubMed',
}

export function sourceTypeLabel(sourceType: string | null | undefined): string {
  if (!sourceType) return 'Unknown source'
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType
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
