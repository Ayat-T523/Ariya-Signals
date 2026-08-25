/**
 * upcomingMilestones.ts — Next Up V1 CT.gov read client (War Room
 * semantic-integrity checkpoint, 2026-08-25, report section 7-9).
 *
 * Talks to GET /api/landscape/upcoming-milestones on the Ariya HTTP API
 * (ariya-lightci-python/signals.py's query_upcoming_ctgov_milestones() +
 * api_server.py's own `_handle_upcoming_milestones()`). Same client
 * conventions as marketWeather.ts: PRESENTATION/interpretation read only,
 * no mutation, no AI, no prediction -- every date returned is a real
 * ESTIMATED value CT.gov's own sponsor already published.
 */
import { apiGet } from './client'

export type CtgovMilestoneType = 'PRIMARY_COMPLETION' | 'STUDY_COMPLETION' | 'PRIMARY_AND_STUDY_COMPLETION'

export interface CtgovUpcomingMilestone {
  nctId: string | null
  assetId: string
  assetName: string
  companyId: string | null
  companyName: string | null
  milestoneType: CtgovMilestoneType
  date: string
  /** Always 'ESTIMATED' -- see the backend's own docstring on why an
   *  ACTUAL-typed date is never returned by this route (it already became
   *  a landscape Signal instead, via a completed-event path). */
  dateType: 'ESTIMATED'
  sourceUrl: string | null
}

function toMilestone(raw: any): CtgovUpcomingMilestone {
  return {
    nctId: raw.nct_id ?? null,
    assetId: raw.asset_id,
    assetName: raw.asset_name ?? raw.asset_id,
    companyId: raw.company_id ?? null,
    companyName: raw.company_name ?? null,
    milestoneType: raw.milestone_type,
    date: raw.date,
    dateType: 'ESTIMATED',
    sourceUrl: raw.source_url ?? null,
  }
}

/**
 * `companyIds` must be canonical backend company keys -- same contract as
 * fetchLandscapeSignals()/fetchMarketWeather(). Returns [] (no network
 * call) when the caller has no real scope to ask about yet.
 */
export async function fetchUpcomingCtgovMilestones(
  companyIds: string[],
  indication: string | null | undefined,
  indicationId: string | null | undefined,
): Promise<CtgovUpcomingMilestone[]> {
  if (companyIds.length === 0) return []
  if (!indication && !indicationId) return []
  const params: Record<string, string> = { companies: companyIds.join(',') }
  if (indication) params.indication = indication
  if (indicationId) params.indication_id = indicationId
  const raw = await apiGet<any>('/api/landscape/upcoming-milestones', params)
  return ((raw.items ?? []) as any[]).map(toMilestone)
}
