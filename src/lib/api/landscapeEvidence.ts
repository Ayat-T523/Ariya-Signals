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
 */
export async function fetchLandscapeEvidence(
  companyIds: string[],
  indication?: string | null,
): Promise<LandscapeEvidenceItem[]> {
  if (companyIds.length === 0) return []
  const params: Record<string, string> = { companies: companyIds.join(',') }
  if (indication) params.indication = indication
  const raw = await apiGet<{ items: any[] }>('/api/landscape/evidence', params)
  return (raw.items ?? []).map(toLandscapeEvidenceItem)
}
