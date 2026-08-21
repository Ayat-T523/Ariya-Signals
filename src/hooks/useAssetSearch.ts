import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, ApiUnreachableError } from '../lib/api/client'
import { searchAssets, type ResolvedAssetIdentity } from '../lib/api/assetSearch'

/**
 * useAssetSearch.ts — debounced Home Asset search (Landscape Input
 * Resolution milestone, Step 19/20/22).
 *
 * Deliberately separate from useDiscovery.ts's request lifecycle: asset
 * identity lookup must feel interactive (idle -> searching -> results on
 * every meaningful keystroke, debounced), while competitor discovery is a
 * heavier, explicit, once-per-stage-visit operation. Running the full
 * discovery pipeline on every keystroke here would violate Step 19's own
 * requirement -- this hook never imports useDiscovery/discovery.ts.
 *
 * idle/searching/results/no_results/error states (Step 22) -- results and
 * no_results are kept distinct so the UI can render "no verified asset
 * found for X" only once a real completed search says so, never merely
 * because the debounce hasn't fired yet.
 */

const DEBOUNCE_MS = 350

export type AssetSearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'results'; results: ResolvedAssetIdentity[] }
  | { status: 'no_results' }
  | { status: 'error'; message: string }

export function useAssetSearch() {
  const [state, setState] = useState<AssetSearchState>({ status: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    const trimmed = query.trim()
    if (!trimmed) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'searching' })
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const response = await searchAssets(trimmed, controller.signal)
        if (controller.signal.aborted) return
        setState(response.results.length === 0 ? { status: 'no_results' } : { status: 'results', results: response.results })
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof ApiError) {
          setState({ status: 'error', message: err.message })
        } else if (err instanceof ApiUnreachableError) {
          setState({ status: 'error', message: 'Asset search is currently unavailable.' })
        } else {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
        }
      }
    }, DEBOUNCE_MS)
  }, [])

  const reset = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    setState({ status: 'idle' })
  }, [])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [])

  return { state, search, reset }
}
