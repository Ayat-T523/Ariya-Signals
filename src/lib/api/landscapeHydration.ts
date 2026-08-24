/**
 * landscapeHydration.ts — write side of historical evidence hydration
 * (Step 1, 2026-08-24).
 *
 * Talks to POST /api/landscape/hydrate on the Ariya HTTP API
 * (ariya-lightci-python/api_server.py's run_hydration()), which itself
 * calls run_discovery() unmodified -- the SAME discovery -> identity ->
 * persistence pipeline discovery.ts's fetchDiscoveredCompetitors() already
 * triggers. This is deliberately NOT a second discovery client: it exists
 * only because the RESPONSE SHAPE differs (hydration coverage bookkeeping,
 * not a candidate list) and because callers here fire it non-blocking
 * (see AppContext.tsx's completeSetup()) rather than awaiting a UI result.
 *
 * PRODUCT BOUNDARY (do not violate): a hydration result reports SOURCE
 * COVERAGE (complete/partial/failed/already_covered) -- never a Signal
 * count, never "N new updates found". What evidence actually landed is
 * read back separately via fetchLandscapeEvidence().
 */
import { apiPost } from './client'

export interface HydrationRequest {
  homeAsset: string
  indication: string
  homeCompany?: string | null
  indicationId?: string | null
  /** Bypasses the backend's freshness-window skip -- an explicit user "refresh now" action only, never the automatic post-setup trigger. */
  force?: boolean
  /**
   * FDA V1 scope hardening (multi-source recon unit 2 follow-up): the
   * setup-selected competitor company_ids (TrackedCompetitor.companyId for
   * every `source: "discovered"` competitor), forwarded so the backend can
   * target regulatory-source enrichment at the tracked landscape instead of
   * an arbitrary disease-wide slice. Never changes discovery/identity/
   * persistence scope itself -- omitting this field entirely (or sending an
   * empty array) is byte-for-byte the same request this endpoint already
   * accepted before this field existed.
   */
  trackedCompetitorIds?: string[]
}

export interface HydrationRun {
  scopeId: string
  diseaseId: string
  homeAsset: string
  homeCompany: string | null
  status: string
  coveredFrom: string | null
  coveredTo: string | null
  lastHydratedAt: string
  sourceStatuses: unknown
}

/** CORRECTNESS GATE FIX: `partial_recent` -- a prior partial run exists but
 * is still inside the short retry-suppression window (see api_server.py's
 * own _HYDRATION_PARTIAL_RETRY_INTERVAL) -- distinct from `already_covered`
 * (a prior COMPLETE run), since the underlying coverage is still honestly
 * incomplete even though this call did not re-run discovery. */
export type HydrationStatus = 'complete' | 'partial' | 'failed' | 'already_covered' | 'partial_recent'

export interface HydrationResult {
  status: HydrationStatus
  hydration: HydrationRun | null
}

/** CORRECTNESS GATE FIX (report section 6/9, test N): the minimum shared UI
 * state War Room/Portal need to distinguish -- collapses the backend's
 * finer-grained HydrationStatus (which also encodes WHY a run was skipped)
 * down to what a compact status line actually needs to say. `already_
 * covered` and `partial_recent` both mean "we did not re-run discovery
 * this time" -- the DISPLAYED state is about coverage quality
 * (complete/partial), never about the skip reason itself. */
export type HydrationUIStatus = 'idle' | 'hydrating' | 'complete' | 'partial' | 'failed'

export function toHydrationUIStatus(status: HydrationStatus): HydrationUIStatus {
  switch (status) {
    case 'complete':
    case 'already_covered':
      return 'complete'
    case 'partial':
    case 'partial_recent':
      return 'partial'
    case 'failed':
      return 'failed'
    default:
      return 'idle'
  }
}

/**
 * Compact, one-line hydration status text for War Room/Portal's "Recent
 * evidence" header -- report section 6's own "compact" requirement, never
 * a full notification system. `null` for 'idle'/'complete': the good,
 * default state needs no banner at all -- only the exceptional states
 * (still working, or something's wrong) warrant a line of text.
 */
export function hydrationStatusLabel(status: HydrationUIStatus): string | null {
  switch (status) {
    case 'hydrating':
      return 'Updating evidence…'
    case 'partial':
      return 'Some sources unavailable'
    case 'failed':
      return "Couldn't refresh evidence"
    default:
      return null
  }
}

function toHydrationRun(raw: any): HydrationRun | null {
  if (!raw) return null
  return {
    scopeId: raw.scope_id,
    diseaseId: raw.disease_id,
    homeAsset: raw.home_asset,
    homeCompany: raw.home_company ?? null,
    status: raw.status,
    coveredFrom: raw.covered_from ?? null,
    coveredTo: raw.covered_to ?? null,
    lastHydratedAt: raw.last_hydrated_at,
    sourceStatuses: raw.source_statuses ?? null,
  }
}

// Same in-flight de-duplication discipline as discovery.ts's own
// fetchDiscoveredCompetitors() -- see that module's own docstring for why
// (React 18 StrictMode double-invoked mount effects). Request identity here
// additionally includes `force`, since a forced call is a deliberately
// DIFFERENT request from the automatic one even for the same landscape.
const _inFlightHydrationRequests = new Map<string, Promise<HydrationResult>>()

function _hydrationRequestKey(request: HydrationRequest): string {
  return JSON.stringify([
    request.homeAsset, request.indication, request.homeCompany ?? null, request.indicationId ?? null, !!request.force,
    // A different tracked-competitor scope is a genuinely different
    // enrichment request, even for the same home_asset/indication -- sorted
    // so the SAME set in a different array order never misses the in-flight
    // dedup cache for no reason.
    [...(request.trackedCompetitorIds ?? [])].sort(),
  ])
}

export async function triggerLandscapeHydration(request: HydrationRequest): Promise<HydrationResult> {
  const key = _hydrationRequestKey(request)
  const existing = _inFlightHydrationRequests.get(key)
  if (existing) return existing

  const inFlight = (async () => {
    const raw = await apiPost<any>('/api/landscape/hydrate', {
      home_asset: request.homeAsset,
      indication: request.indication,
      ...(request.homeCompany ? { home_company: request.homeCompany } : {}),
      ...(request.indicationId ? { indication_id: request.indicationId } : {}),
      ...(request.force ? { force: true } : {}),
      ...(request.trackedCompetitorIds?.length ? { tracked_company_ids: request.trackedCompetitorIds } : {}),
    })
    return { status: raw.status, hydration: toHydrationRun(raw.hydration) } as HydrationResult
  })()

  _inFlightHydrationRequests.set(key, inFlight)
  try {
    return await inFlight
  } finally {
    _inFlightHydrationRequests.delete(key)
  }
}
