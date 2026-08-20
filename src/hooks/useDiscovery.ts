import { useCallback, useState } from 'react'
import { ApiError, ApiUnreachableError } from '../lib/api/client'
import { fetchDiscoveredCompetitors, type DiscoveryRequest, type DiscoveryResult } from '../lib/api/discovery'

/**
 * useDiscovery.ts — competitor discovery request state (Frontend Step 4B).
 *
 * idle/loading/success/empty/error only, matching the product contract's own
 * boundary for this step -- no Redux, plain useState, same pattern already
 * used throughout this app (e.g. useTimelineData.ts). Discovery results are
 * held ONLY in this hook's own component-local state -- never written into
 * AppContext/localStorage -- because a candidate list is non-authoritative,
 * refetchable, provisional data, not tracked user state (see this step's own
 * PRODUCT AUTHORITY CONTRACT: a candidate is not a tracked competitor).
 */

export type DiscoveryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: DiscoveryResult }
  | { status: 'empty'; result: DiscoveryResult }
  | { status: 'error'; message: string; errorCode: string | null }

export function useDiscovery() {
  const [state, setState] = useState<DiscoveryState>({ status: 'idle' })

  const run = useCallback(async (request: DiscoveryRequest) => {
    setState({ status: 'loading' })
    try {
      const result = await fetchDiscoveredCompetitors(request)
      setState(result.candidates.length === 0 ? { status: 'empty', result } : { status: 'success', result })
    } catch (err) {
      if (err instanceof ApiError) {
        setState({ status: 'error', message: err.message, errorCode: err.errorCode })
      } else if (err instanceof ApiUnreachableError) {
        setState({ status: 'error', message: 'Competitor discovery is currently unavailable.', errorCode: null })
      } else {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error', errorCode: null })
      }
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, run, reset }
}
