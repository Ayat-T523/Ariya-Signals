/**
 * assetSearch.ts — asset (drug) search/resolution API boundary (Landscape
 * Input Resolution milestone).
 *
 * Talks to GET /api/assets/search on the Ariya HTTP API
 * (ariya-lightci-python/api_server.py -> asset_resolution.search_assets()).
 * Types here mirror asset_resolution.asset_search_result_to_dict() exactly —
 * every field the backend actually returns, none invented, none renamed for
 * aesthetics.
 *
 * PRODUCT BOUNDARY (do not violate): this is asset IDENTITY search, not
 * competitor discovery -- see useAssetSearch.ts's own docstring for why it
 * is a completely separate request/debounce lifecycle from useDiscovery().
 */
import { apiGet } from './client'

export interface ResolvedAssetIdentity {
  id: string
  preferredName: string
  brandNames: string[]
  innNames: string[]
  developmentCodes: string[]
  aliases: string[]
  ownerCompanies: string[]
  mechanismOfAction: string[]
  indicationContexts: string[]
  /** 'known_catalog' (Ariya's own small hand-verified registry) or 'clinicaltrials_gov' (live-discovered). Never shown to the user as a quality signal — internal provenance only. */
  source: string
  evidenceRefs: string[]
}

export interface AssetSearchDiagnostics {
  knownCatalogCount: number
  liveDiscoveredCount: number
  sourceRunState: string | null
}

export interface AssetSearchResponse {
  query: string
  results: ResolvedAssetIdentity[]
  diagnostics: AssetSearchDiagnostics
}

function toResolvedAssetIdentity(raw: any): ResolvedAssetIdentity {
  return {
    id: raw.id,
    preferredName: raw.preferred_name,
    brandNames: raw.brand_names ?? [],
    innNames: raw.inn_names ?? [],
    developmentCodes: raw.development_codes ?? [],
    aliases: raw.aliases ?? [],
    ownerCompanies: raw.owner_companies ?? [],
    mechanismOfAction: raw.mechanism_of_action ?? [],
    indicationContexts: raw.indication_contexts ?? [],
    source: raw.source,
    evidenceRefs: raw.evidence_refs ?? [],
  }
}

/** Pure -- exported for testing the response mapping without a network call. */
export function mapAssetSearchResponse(raw: any): AssetSearchResponse {
  return {
    query: raw.query,
    results: (raw.results ?? []).map(toResolvedAssetIdentity),
    diagnostics: {
      knownCatalogCount: raw.diagnostics?.known_catalog_count ?? 0,
      liveDiscoveredCount: raw.diagnostics?.live_discovered_count ?? 0,
      sourceRunState: raw.diagnostics?.source_run_state ?? null,
    },
  }
}

export async function searchAssets(query: string, signal?: AbortSignal): Promise<AssetSearchResponse> {
  const raw = await apiGet<any>('/api/assets/search', { q: query }, signal)
  return mapAssetSearchResponse(raw)
}
