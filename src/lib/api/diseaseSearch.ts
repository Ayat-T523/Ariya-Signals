/**
 * diseaseSearch.ts — canonical Disease Area search API boundary
 * (Root-Cause Recon implementation, Part A5).
 *
 * Talks to GET /api/diseases/search on the Ariya HTTP API
 * (ariya-lightci-python/api_server.py -> disease_resolution.search_diseases()).
 * The backend already merges curated + live MONDO results into ONE list
 * (Part A4) — this client does not re-split or re-group them.
 */
import { apiGet } from './client'

export interface ResolvedDiseaseArea {
  id: string
  preferredName: string
  aliases: string[]
  /** 'mondo' (curated or live-resolved) — never shown to the user as a quality signal, internal provenance only. */
  source: string
  sourceId: string | null
}

export interface DiseaseSearchResponse {
  query: string
  results: ResolvedDiseaseArea[]
}

function toResolvedDiseaseArea(raw: any): ResolvedDiseaseArea {
  return {
    id: raw.id,
    preferredName: raw.preferred_name,
    aliases: raw.aliases ?? [],
    source: raw.source,
    sourceId: raw.source_id ?? null,
  }
}

export function mapDiseaseSearchResponse(raw: any): DiseaseSearchResponse {
  return {
    query: raw.query,
    results: (raw.results ?? []).map(toResolvedDiseaseArea),
  }
}

export async function searchDiseases(query: string, therapeuticAreaId?: string | null, signal?: AbortSignal): Promise<DiseaseSearchResponse> {
  const params: Record<string, string> = { q: query }
  if (therapeuticAreaId) params.ta = therapeuticAreaId
  const raw = await apiGet<any>('/api/diseases/search', params, signal)
  return mapDiseaseSearchResponse(raw)
}
