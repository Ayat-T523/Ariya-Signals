import { useState, useEffect } from 'react'
import { REDUCED_MOTION } from '../lib/motion'

const DELAY_MIN = 400
const DELAY_MAX = 700

/**
 * Returns `true` once the page is ready to show data.
 *
 * First visit this session: waits 400–700 ms (simulated data load).
 * Repeat visits within the same session: returns `true` immediately.
 * prefers-reduced-motion: always returns `true` immediately (no shimmer).
 */
export function usePageLoad(key: string): boolean {
  const storageKey = `ariya-loaded-${key}`

  const [loaded, setLoaded] = useState<boolean>(() => {
    if (REDUCED_MOTION) return true
    try { return sessionStorage.getItem(storageKey) === '1' } catch { return true }
  })

  useEffect(() => {
    if (loaded) return
    const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN)
    const timer = setTimeout(() => {
      try { sessionStorage.setItem(storageKey, '1') } catch { /* private browsing */ }
      setLoaded(true)
    }, delay)
    return () => clearTimeout(timer)
  }, []) // mount-once intentional — key is stable

  return loaded
}
