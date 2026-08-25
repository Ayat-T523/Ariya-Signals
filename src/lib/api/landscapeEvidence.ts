/**
 * landscapeEvidence.ts — read side of the ingestion -> persistence ->
 * landscape bridge (V1).
 *
 * Talks to GET /api/landscape/evidence on the Ariya HTTP API
 * (ariya-lightci-python/evidence_store.py + api_server.py), which reads
 * durably persisted, source-backed evidence for a set of CANONICAL company
 * ids -- the exact same company_grouping_key() values already sitting in
 * TrackedCompetitor.companyId for every `source: "discovered"` competitor
 * (see setup-draft.ts / AppContext.tsx). No new identity mapping, no fuzzy
 * company-name matching -- see activeLandscape.ts's own module docstring
 * for why that helper is a DIFFERENT, legacy-content-only adapter and must
 * never be reused as the primary identity mechanism for this evidence.
 *
 * PRODUCT BOUNDARY (do not violate): an EvidenceItem is a durably-recorded,
 * source-backed OBSERVATION -- never a Signal, a narrative, or a
 * significance judgment. Nothing here compares it against a prior
 * observation or interprets what changed; that is later, separate,
 * explicitly deferred work (see the bridge task's own scope fence).
 */
import { apiGet } from './client'

export interface LandscapeEvidenceItem {
  id: string
  entityType: 'company' | 'asset' | 'company_asset'
  companyId: string | null
  companyName: string | null
  assetId: string | null
  assetName: string | null
  sourceType: string | null
  sourceLocator: string
  sourcePublishedDate: string | null
  /** When this exact evidence version was first durably recorded -- never advances on a re-observation of the same fact. */
  firstObservedAt: string
  /** When this exact evidence version was most recently re-confirmed still true -- advances on every re-observation of the SAME fact; a materially different fact gets its own new version/id instead of moving this field. */
  lastObservedAt: string
  provenance: string | null
  verificationStatus: string | null
  /**
   * The raw source-specific payload dict the backend already attaches to
   * every evidence row (evidence_store.py's query_landscape_evidence(), e.g.
   * `trial_phases`, `overall_status`, `candidate_disposition`,
   * `original_approval_date`, `marketing_authorisation_date`,
   * `semantic_event_type`) -- widened onto this type (Competitors Pipeline
   * tab restoration, 2026-08-25) instead of adding a new backend endpoint,
   * per that checkpoint's own "prefer frontend implementation... verify data
   * cannot already be derived from existing APIs" instruction. Shape varies
   * by sourceType; callers (see pipelineStage.ts) read specific keys
   * defensively and never assume every key is present.
   */
  payload: Record<string, unknown> | null
}

function toLandscapeEvidenceItem(raw: any): LandscapeEvidenceItem {
  return {
    id: raw.id,
    entityType: raw.entity_type,
    companyId: raw.company_id ?? null,
    companyName: raw.company_name ?? null,
    assetId: raw.asset_id ?? null,
    assetName: raw.asset_name ?? null,
    sourceType: raw.source_type ?? null,
    sourceLocator: raw.source_locator,
    sourcePublishedDate: raw.source_published_date ?? null,
    firstObservedAt: raw.first_observed_at,
    lastObservedAt: raw.last_observed_at,
    provenance: raw.provenance ?? null,
    verificationStatus: raw.verification_status ?? null,
    payload: raw.payload ?? null,
  }
}

/**
 * `companyIds` must be canonical backend company keys (TrackedCompetitor.companyId
 * for `source: "discovered"` competitors) -- a manually-added competitor's
 * companyId is a locally-generated id with no durable evidence to match, and
 * is honestly excluded by the caller before this function is ever invoked
 * (see WarRoom.tsx/Portal.tsx's own filtering). An empty `companyIds` array
 * short-circuits to an empty result without a network call -- there is
 * nothing a canonical-id query could honestly return for zero ids.
 *
 * `indicationId`, when supplied, is the SAME canonical Disease Area id
 * (ResolvedDiseaseArea.id, e.g. a real MONDO term) DiscoveryRequest.indicationId
 * already forwards on the write side -- see that field's own docstring.
 * Regression fix: evidence persisted under a canonical disease id was
 * invisible to a read that only ever filtered on the plain `indication`
 * label, since the two are normalized into different storage keys. Passing
 * `indicationId` through here (backend precedence: canonical id first, the
 * plain label only as a fallback -- never both required to match) is what
 * makes previously-persisted canonical evidence actually retrievable again.
 *
 * `lookbackDays`, when supplied, is the ONE shared Month(30)/Quarter(90)/
 * Year(365) time-horizon contract (see src/lib/timeHorizon.ts) forwarded
 * verbatim to the backend's own `lookback_days` pure read-side filter --
 * see evidence_store.query_landscape_evidence()'s own docstring. Omitted
 * entirely (not even sent as a param) when absent, so an existing caller
 * that never passes it is completely unaffected -- every persisted item,
 * no horizon applied, byte-for-byte the pre-existing behavior.
 */
export async function fetchLandscapeEvidence(
  companyIds: string[],
  indication?: string | null,
  indicationId?: string | null,
  lookbackDays?: number | null,
): Promise<LandscapeEvidenceItem[]> {
  if (companyIds.length === 0) return []
  const params: Record<string, string> = { companies: companyIds.join(',') }
  if (indication) params.indication = indication
  if (indicationId) params.indication_id = indicationId
  if (lookbackDays) params.lookback_days = String(lookbackDays)
  const raw = await apiGet<{ items: any[] }>('/api/landscape/evidence', params)
  return (raw.items ?? []).map(toLandscapeEvidenceItem)
}
