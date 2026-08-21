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

/**
 * A single relevant asset supporting a SuggestedCompanySuggestion --
 * NEVER a top-level competitor on its own (see competitor_promotion.py's
 * own module docstring on the backend side: "a competitor in Ariya is a
 * company"). Mirrors one relevant_assets[] entry from the backend's
 * /api/discovery/competitors response.
 */
export interface RelevantAssetInfo {
  identityKey: string
  candidateStatus: CandidateStatus
  aiProposedRelationship: AdvisoryRelationship
  evidenceGaps: string[]
  sourceReferences: string[]
  reasonDetail: string[]
  unresolvedQuestions: string[]
  detail: string | null
}

/**
 * The unit Stage 2 actually renders -- company-rooted, already shortlisted
 * and ranked by the backend's competitor_promotion.py. Never a raw
 * DiscoveredCandidate; never an asset/population presented as a competitor.
 */
export interface SuggestedCompanySuggestion {
  companyKey: string
  companyName: string
  relevantAssets: RelevantAssetInfo[]
  /** Ariya's own advisory read -- never a user classification. Display as "Ariya assessment", never "Relationship". */
  aiProposedRelationship: AdvisoryRelationship
  evidenceRefs: string[]
  verifiedDomains: string[]
  whySuggested: string
  rankScore: number
  rankComponents: Record<string, number>
}

export interface DiscoveryDiagnostics {
  rawCandidateCount: number
  resolvedCompanyCount: number
  suggestedCompanyCount: number
}

export interface DiscoveryResult {
  homeAsset: string
  indication: string
  discoveryExecution: SourceExecutionInfo
  homeEvidenceExecutions: SourceExecutionInfo[]
  homePopulationEvidenceCount: number
  comparatorExecution: SourceExecutionInfo
  comparatorObservationCount: number
  /** Stage 2's real contract -- company-rooted, shortlisted, ranked. */
  suggestedCompanies: SuggestedCompanySuggestion[]
  diagnostics: DiscoveryDiagnostics
  /** Raw per-candidate list -- diagnostics/tests and the standalone /competitors/discover route only. Never Stage 2's primary contract. */
  candidates: DiscoveredCandidate[]
}

export interface DiscoveryRequest {
  /** The Home/Reference Asset's brand name, e.g. AssetConfig.brandName -- the backend's own real domain identity for "home asset" (see resolve_home_asset_indication()'s docstring). Never a frontend-internal AssetConfig.id. */
  homeAsset: string
  /** A canonical indication string, e.g. DiseaseArea.name -- forwarded verbatim to the backend's explicit-indication discovery path. */
  indication: string
  /** The Home Asset's own resolved company -- the ONLY thing that makes deterministic home-company exclusion possible. Omit when genuinely unknown; never guessed. */
  homeCompany?: string | null
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

function toRelevantAssetInfo(raw: any): RelevantAssetInfo {
  return {
    identityKey: raw.identity_key,
    candidateStatus: raw.candidate_status,
    aiProposedRelationship: raw.ai_proposed_relationship ?? null,
    evidenceGaps: raw.evidence_gaps ?? [],
    sourceReferences: raw.source_references ?? [],
    reasonDetail: raw.reason_detail ?? [],
    unresolvedQuestions: raw.unresolved_questions ?? [],
    detail: raw.detail ?? null,
  }
}

function toSuggestedCompanySuggestion(raw: any): SuggestedCompanySuggestion {
  return {
    companyKey: raw.company_key,
    companyName: raw.company_name,
    relevantAssets: (raw.relevant_assets ?? []).map(toRelevantAssetInfo),
    aiProposedRelationship: raw.ai_proposed_relationship ?? null,
    evidenceRefs: raw.evidence_refs ?? [],
    verifiedDomains: raw.verified_domains ?? [],
    whySuggested: raw.why_suggested,
    rankScore: raw.rank_score ?? 0,
    rankComponents: raw.rank_components ?? {},
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
    // No filtering by rank/status here -- every company the backend already
    // decided to shortlist is kept, in the backend's own ranked order.
    suggestedCompanies: (raw.suggested_companies ?? []).map(toSuggestedCompanySuggestion),
    diagnostics: {
      rawCandidateCount: raw.diagnostics?.raw_candidate_count ?? 0,
      resolvedCompanyCount: raw.diagnostics?.resolved_company_count ?? 0,
      suggestedCompanyCount: raw.diagnostics?.suggested_company_count ?? 0,
    },
    // No filtering by candidate_status here either -- every raw candidate
    // the backend returned is kept, in order. See this module's own docstring.
    candidates: (raw.candidates ?? []).map(toDiscoveredCandidate),
  }
}

export async function fetchDiscoveredCompetitors(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const raw = await apiPost<any>('/api/discovery/competitors', {
    home_asset: request.homeAsset,
    indication: request.indication,
    ...(request.homeCompany ? { home_company: request.homeCompany } : {}),
  })
  return mapDiscoveryResponse(raw)
}
