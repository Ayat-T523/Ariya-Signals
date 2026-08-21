import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, ApiUnreachableError } from '../lib/api/client'
import { searchDiseases, type ResolvedDiseaseArea } from '../lib/api/diseaseSearch'

/**
 * useDiseaseSearch.ts — debounced Disease Area search (Root-Cause Recon
 * implementation, Part A5). Same debounce/cancellation shape as
 * useAssetSearch.ts, deliberately -- a second, independent request
 * lifecycle, never sharing state with asset search or discovery.
 */

const DEBOUNCE_MS = 350

export type DiseaseSearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'results'; results: ResolvedDiseaseArea[] }
  | { status: 'no_results' }
  | { status: 'error'; message: string }

export function useDiseaseSearch() {
  const [state, setState] = useState<DiseaseSearchState>({ status: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback((query: string, therapeuticAreaId?: string | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    const trimmed = query.trim()
    // Root-Cause Recon implementation, Part A4/B2: a blank query is still a
    // valid request when a category is known -- that's "show curated
    // suggestions for this category," not "search for nothing." Only a
    // genuinely blank query with no category resets to idle.
    if (!trimmed && !therapeuticAreaId) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'searching' })
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const response = await searchDiseases(trimmed, therapeuticAreaId, controller.signal)
        if (controller.signal.aborted) return
        setState(response.results.length === 0 ? { status: 'no_results' } : { status: 'results', results: response.results })
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof ApiError) {
          setState({ status: 'error', message: err.message })
        } else if (err instanceof ApiUnreachableError) {
          setState({ status: 'error', message: 'Disease search is currently unavailable.' })
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
