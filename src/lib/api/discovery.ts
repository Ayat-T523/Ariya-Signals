/**
 * discovery.ts — competitor discovery API boundary (Frontend Step 4B).
 *
 * Talks to POST /api/discovery/competitors on the Ariya HTTP API
 * (ariya-lightci-python/api_server.py), which itself calls the existing,
 * unmodified run_relationship_landscape() pipeline. Types here mirror
 * relationship_landscape.py's landscape_relationship_result_to_dict() plus
 * api_server.py's own discovery_results join -- every field the backend
 * actually returns, none renamed for aesthetics, none invented.
 *
 * PRODUCT BOUNDARY (do not violate): a DiscoveredCandidate is NOT a tracked
 * competitor. `aiProposedRelationship`/`finalRelationship` are the backend's
 * own advisory assessment, never a user classification -- there is
 * deliberately no `userRelationship` field anywhere in this module. User
 * selection and Direct/Indirect classification are Frontend Step 5's job,
 * not this one's.
 */
import { apiPost } from './client'

export type CandidateStatus =
  | 'presentable_candidate'
  | 'needs_more_evidence'
  | 'evidence_conflict'
  | 'not_presentable_for_target'

export type RelationshipRecommendationStatus = 'success' | 'degraded' | 'unavailable' | 'skipped'

export type AdvisoryRelationship = 'direct' | 'indirect' | 'unclear' | null

export interface DurableEvidenceRef {
  localRef: string
  sourceRef: string
  sourceType: string
}

export interface DiscoveredCandidate {
  /** The backend's own deterministic identity key -- a real, human-readable raw name (e.g. a company/asset name exactly as ClinicalTrials.gov stated it), not a synthesized id. */
  identityKey: string
  candidateStatus: CandidateStatus
  relationshipStatus: RelationshipRecommendationStatus
  /** Ariya's own advisory assessment -- never a user classification. Display as "Ariya assessment", never "Relationship". */
  aiProposedRelationship: AdvisoryRelationship
  finalRelationship: AdvisoryRelationship
  finalRationale: string | null
  validationReasons: string[]
  evidenceGaps: string[]
  durableEvidenceRefs: DurableEvidenceRef[]
  detail: string | null
  /** Provenance -- from the backend's discovery_results join, when available. */
  sourceReferences: string[]
  reasonDetail: string[]
  unresolvedQuestions: string[]
  organizationName: string | null
  organizationSourceStatus: string | null
  verifiedDomains: string[]
}

export interface SourceExecutionInfo {
  sourceId: string
  entityName: string
  runState: string
  errorDetail: string | null
  documentsRetrieved: string[]
}

export interface DiscoveryResult {
  homeAsset: string
  indication: string
  discoveryExecution: SourceExecutionInfo
  homeEvidenceExecutions: SourceExecutionInfo[]
  homePopulationEvidenceCount: number
  comparatorExecution: SourceExecutionInfo
  comparatorObservationCount: number
  candidates: DiscoveredCandidate[]
}

export interface DiscoveryRequest {
  /** The Home/Reference Asset's brand name, e.g. AssetConfig.brandName -- the backend's own real domain identity for "home asset" (see resolve_home_asset_indication()'s docstring). Never a frontend-internal AssetConfig.id. */
  homeAsset: string
  /** A canonical indication string, e.g. DiseaseArea.name -- forwarded verbatim to the backend's explicit-indication discovery path. */
  indication: string
}

function toSourceExecutionInfo(raw: any): SourceExecutionInfo {
  return {
    sourceId: raw.source_id,
    entityName: raw.entity_name,
    runState: raw.run_state,
    errorDetail: raw.error_detail ?? null,
    documentsRetrieved: raw.documents_retrieved ?? [],
  }
}

function toDiscoveredCandidate(raw: any): DiscoveredCandidate {
  return {
    identityKey: raw.competitor_identity_key,
    candidateStatus: raw.candidate_status,
    relationshipStatus: raw.relationship_status,
    aiProposedRelationship: raw.ai_proposed_relationship ?? null,
    finalRelationship: raw.final_relationship ?? null,
    finalRationale: raw.final_rationale ?? null,
    validationReasons: raw.validation_reasons ?? [],
    evidenceGaps: raw.evidence_gaps ?? [],
    durableEvidenceRefs: (raw.durable_evidence_refs ?? []).map((ref: any) => ({
      localRef: ref.local_ref,
      sourceRef: ref.source_ref,
      sourceType: ref.source_type,
    })),
    detail: raw.detail ?? null,
    sourceReferences: raw.source_references ?? [],
    reasonDetail: raw.reason_detail ?? [],
    unresolvedQuestions: raw.unresolved_questions ?? [],
    organizationName: raw.organization_name ?? null,
    organizationSourceStatus: raw.organization_source_status ?? null,
    verifiedDomains: raw.verified_domains ?? [],
  }
}

/** Pure -- exported for testing the response mapping without a network call. */
export function mapDiscoveryResponse(raw: any): DiscoveryResult {
  return {
    homeAsset: raw.home_asset,
    indication: raw.indication,
    discoveryExecution: toSourceExecutionInfo(raw.discovery_execution),
    homeEvidenceExecutions: (raw.home_evidence_executions ?? []).map(toSourceExecutionInfo),
    homePopulationEvidenceCount: raw.home_population_evidence_count ?? 0,
    comparatorExecution: toSourceExecutionInfo(raw.comparator_execution),
    comparatorObservationCount: raw.comparator_observation_count ?? 0,
    // No filtering by candidate_status here -- every candidate the backend
    // returned is kept, in order. See this module's own docstring.
    candidates: (raw.candidates ?? []).map(toDiscoveredCandidate),
  }
}

export async function fetchDiscoveredCompetitors(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const raw = await apiPost<any>('/api/discovery/competitors', {
    home_asset: request.homeAsset,
    indication: request.indication,
  })
  return mapDiscoveryResponse(raw)
}
