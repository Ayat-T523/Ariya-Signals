import { useState, useEffect, useRef } from 'react'

export interface ChemblHit {
  inn: string
  chembl_id: string
  max_phase: number | null
  drug_type: string | null
  synonyms: string[]
  research_codes: string[]
  atc_codes: string[]
  usan_stem_label: string | null
}

interface SearchState {
  hits: ChemblHit[]
  loading: boolean
  error: boolean
}

const IDLE: SearchState = { hits: [], loading: false, error: false }

export function useChemblSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>(IDLE)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
      setState(IDLE)
      return
    }

    setState(prev => ({ ...prev, loading: true, error: false }))
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()
      try {
        const res = await fetch(`/api/chembl/search?q=${encodeURIComponent(query)}`, {
          signal: abortRef.current.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as ChemblHit[]
        setState({ hits: data, loading: false, error: false })
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        setState({ hits: [], loading: false, error: true })
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [query])

  return state
}
