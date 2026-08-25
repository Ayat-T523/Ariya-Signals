/**
 * landscapeAssets.ts — canonical company+disease Pipeline asset universe
 * read client (pre-freeze unit 1, 2026-08-25).
 *
 * Talks to GET /api/landscape/assets (ariya-lightci-python's
 * signals.query_landscape_canonical_assets(), fronted by api_server.py --
 * see that route's own comment for why it's a separate, unbounded-by-time
 * membership question, unlike /api/landscape/signals).
 *
 * PRODUCT BOUNDARY (do not violate): a LandscapeCanonicalAsset is "does
 * this asset exist for this company in this disease area" -- it says
 * nothing about activity/recency. Signals enrich a canonical asset; they
 * never decide whether it exists (see competitorOverview.ts /
 * PipelineTabV1.tsx, the two consumers of this client).
 */
import { apiGet } from './client'

export interface LandscapeCanonicalAsset {
  assetId: string
  assetName: string
  companyId: string
}

function toLandscapeCanonicalAsset(raw: any): LandscapeCanonicalAsset {
  return {
    assetId: raw.asset_id,
    assetName: raw.asset_name,
    companyId: raw.company_id,
  }
}

/**
 * `companyIds` must be canonical backend company keys -- SAME contract as
 * fetchLandscapeSignals()'s own docstring.
 */
export async function fetchLandscapeCanonicalAssets(
  companyIds: string[],
  indication?: string | null,
  indicationId?: string | null,
): Promise<LandscapeCanonicalAsset[]> {
  if (companyIds.length === 0) return []
  if (!indication && !indicationId) return []
  const params: Record<string, string> = { companies: companyIds.join(',') }
  if (indication) params.indication = indication
  if (indicationId) params.indication_id = indicationId
  const raw = await apiGet<{ items: any[] }>('/api/landscape/assets', params)
  return (raw.items ?? []).map(toLandscapeCanonicalAsset)
}
