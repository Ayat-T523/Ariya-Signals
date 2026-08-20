/**
 * discoveryAdapter.ts — competitor discovery seam for the staged setup flow.
 *
 * NOT YET CONNECTED to ariya-lightci-python. This module exists so
 * Stage2Discover.tsx never talks to a concrete backend directly -- a future
 * step swaps discoverCompetitors()'s body for a real call (see
 * src/lib/api/discovery.ts's fetchDiscoveredCompetitors(), which already
 * exists and already works against a real running backend for the separate
 * /competitors/discover page -- intentionally NOT reused here yet, per this
 * phase's own explicit instruction to build Stage 2's UI decoupled from that
 * wiring). Swapping the implementation later requires no change to
 * Stage2Discover.tsx's own state machine.
 *
 * NEVER returns fabricated candidates, the old suggestedCompetitors list, or
 * discovered-candidates.json data -- only a real result or an explicit
 * "not connected" outcome.
 */
import type { CandidateEntry } from '../../config/setup-draft'

export interface DiscoveryRequest {
  homeAssetDisplayName: string
  diseaseAreaName: string
}

export type DiscoveryOutcome =
  | { status: 'success'; candidates: CandidateEntry[] }
  | { status: 'not_connected' }

/**
 * Always resolves to `not_connected` today -- there is no real backend call
 * in this phase. Still asynchronous (a real `fetch` will be too) so
 * Stage2Discover.tsx's loading state is exercised honestly rather than
 * resolving synchronously.
 */
export async function discoverCompetitors(_request: DiscoveryRequest): Promise<DiscoveryOutcome> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return { status: 'not_connected' }
}
