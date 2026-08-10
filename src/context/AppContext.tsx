import { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { DEMO } from '../config/demo-config'
import { ASSETS_CONFIG, getAssetById } from '../config/assets-config'
import { expandLexiconInns } from '../lib/deterministic/lexicon'
import {
  getAssetLexicon,
  getUserProfile,
  upsertUserProfile,
  getWatchedCompetitorIds,
  upsertWatchedCompetitors,
  addWatchedCompetitor,
  removeWatchedCompetitor,
  getReadAlertIds,
  markAlertReadDb,
  markAlertUnreadDb,
  markAllAlertsReadDb,
} from '../lib/db'
import { supabase } from '../lib/supabase'

/**
 * Everything the provider supplies.
 *
 * This exists because `createContext(null)` gave the context the type `null`, so
 * every field destructured from useApp() inferred as `never` and any use of it
 * ("watchedCompetitors.has(...)") was reported as an error. That single omission
 * accounted for 32 false errors across 10 files. TypeScript checks this interface
 * against the actual Provider value, so it cannot silently drift.
 */
export interface AppContextValue {
  authUser: User | null
  authLoading: boolean
  watchedCompetitors: Set<string>
  toggleWatch: (competitorId: string) => void
  readAlerts: Set<string>
  markAlertRead: (alertId: string) => void
  markAlertUnread: (alertId: string) => void
  markAllRead: (ids: string[]) => void
  unreadCount: number
  syncUnreadCount: (n: number) => void
  onboardingComplete: boolean
  showOnboarding: boolean
  openOnboarding: () => void
  closeOnboarding: () => void
  completeOnboarding: (selectedAssets: any) => void
  // Read from localStorage, which returns null when unset.
  userRole: string | null
  setUserRole: (role: string) => void
  tourActive: boolean
  startTour: () => void
  endTour: (isComplete?: boolean, step?: number) => void
  mobileNavOpen: boolean
  openMobileNav: () => void
  closeMobileNav: () => void
  // Also localStorage-backed, so null until onboarding sets them. useConfig()
  // already falls back to DEMO defaults, which is why this was never noticed.
  userIndication: string | null
  setUserIndication: (indication: string) => void
  userAssetName: string | null
  setUserAssetName: (name: string) => void
  userAssetId: string | null
  setUserAssetId: (id: string | null) => void
  /**
   * The tracked asset's config landscape, expanded with live asset_lexicon
   * synonyms. Always a superset of the config list, never a replacement for it.
   */
  expandedLexiconInns: string[] | null
  resetWatchedCompetitors: (ids: string[]) => void
}

const AppContext = createContext<AppContextValue | null>(null)

/** Cache key for the expanded lexicon. Stores { assetId, inns }. */
const LEXICON_CACHE_KEY = 'ariya-lexicon-expanded'


// Copies localStorage onboarding/watchlist/read-state into Supabase on first sign-in.
// Fire-and-forget; localStorage remains the live cache until Phase 3.
async function migrateLocalStorageToSupabase(userId: string): Promise<void> {
  if (!supabase) return
  // Skip if already migrated for this user
  if (localStorage.getItem('ariya-migrated-v2') === userId) return

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .single()
  if (existing) {
    localStorage.setItem('ariya-migrated-v2', userId)
    return
  }

  const { error: profileErr } = await supabase.from('user_profiles').upsert({
    user_id:             userId,
    indication:          localStorage.getItem('ariya-user-indication'),
    asset_id:            localStorage.getItem('ariya-user-asset-id'),
    asset_name:          localStorage.getItem('ariya-user-asset'),
    onboarding_complete: localStorage.getItem('onboardingComplete') === 'true',
    onboarding_version:  localStorage.getItem('onboardingVersion'),
  })
  if (profileErr) console.warn('[AppContext] profile migration:', profileErr.message)

  try {
    const raw = localStorage.getItem('pharma-inc-ciwarroom-watched')
    if (raw) {
      const ids: string[] = JSON.parse(raw)
      if (ids.length) {
        const { error } = await supabase
          .from('watched_assets')
          .upsert(ids.map(id => ({ user_id: userId, competitor_id: id })))
        if (error) console.warn('[AppContext] watched_assets migration:', error.message)
      }
    }
  } catch { /* noop */ }

  try {
    const raw = localStorage.getItem('pharma-inc-ciwarroom-read-alerts')
    if (raw) {
      const ids: string[] = JSON.parse(raw)
      if (ids.length) {
        const { error } = await supabase
          .from('read_alerts')
          .upsert(ids.map(id => ({ user_id: userId, alert_id: id })))
        if (error) console.warn('[AppContext] read_alerts migration:', error.message)
      }
    }
  } catch { /* noop */ }

  localStorage.setItem('ariya-migrated-v2', userId)
}

export function AppProvider({ children }) {
  const navigate = useNavigate()

  // ── Supabase auth state ───────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null)
      setAuthLoading(false)
      // A recovery link authenticates the user; force them to the reset-password
      // page to set a new password rather than dropping them straight into the app.
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
        return
      }
      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id
        void (async () => {
          // Load profile + watchlist + read state in parallel; Supabase is source of truth.
          const [profile, watchedIds, readIds] = await Promise.all([
            getUserProfile(userId),
            getWatchedCompetitorIds(userId),
            getReadAlertIds(userId),
          ])

          // New / incomplete users need the onboarding flow.
          if (!profile || !profile.onboarding_complete || profile.onboarding_version !== ONBOARDING_VERSION) {
            localStorage.removeItem('onboardingComplete')
            localStorage.removeItem('onboardingVersion')
            setShowOnboarding(true)
            setOnboardingComplete(false)
          }

          // Hydrate asset/indication from Supabase (wins over stale localStorage).
          if (profile) {
            if (profile.indication) {
              setUserIndicationState(profile.indication)
              localStorage.setItem('ariya-user-indication', profile.indication)
            }
            if (profile.asset_id) {
              setUserAssetIdState(profile.asset_id)
              localStorage.setItem('ariya-user-asset-id', profile.asset_id)
            }
            if (profile.asset_name) {
              setUserAssetNameState(profile.asset_name)
              localStorage.setItem('ariya-user-asset', profile.asset_name)
            }
          }

          // Hydrate competitor watchlist from Supabase.
          if (watchedIds.length > 0) {
            setWatchedCompetitors(new Set(watchedIds))
            localStorage.setItem('pharma-inc-ciwarroom-watched', JSON.stringify(watchedIds))
          }

          // Hydrate read-state from Supabase.
          if (readIds.length > 0) {
            setReadAlerts(new Set(readIds))
          }

          // Migration: seed Supabase from localStorage for users who pre-date auth.
          void migrateLocalStorageToSupabase(userId)
        })()
      }
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Competitor watch state ────────────────────────────────────────────────
  // Default: all three competitors are watched
  const [watchedCompetitors, setWatchedCompetitors] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pharma-inc-ciwarroom-watched')
      // JSON.parse returns any, so the Set inferred as Set<unknown> without this.
      return stored
        ? new Set(JSON.parse(stored) as string[])
        : new Set(['takeda', 'biocryst', 'pharvaris'])
    } catch {
      return new Set(['takeda', 'biocryst', 'pharvaris'])
    }
  })

  // ── Alert read state ──────────────────────────────────────────────────────
  // Source of truth is read_alerts table in Supabase. Seeded on SIGNED_IN.
  // localStorage is no longer the source of truth (kept only for migration).
  const [readAlerts, setReadAlerts] = useState<Set<string>>(() => new Set())

  // Unread count is pushed here by AlertsPage after it loads the live feed.
  const [unreadCount, setUnreadCount] = useState(0)
  function syncUnreadCount(n: number) { setUnreadCount(n) }

  // ── Onboarding state ─────────────────────────────────────────────────────
  // Version stamp: bump this string whenever onboarding content changes so
  // returning visitors see the updated flow instead of being skipped over.
  // v5: role step removed (Light is single-view, no per-role tailoring)
  const ONBOARDING_VERSION = 'v5'
  const onboardingDone = (() => {
    try {
      return (
        localStorage.getItem('onboardingComplete') === 'true' &&
        localStorage.getItem('onboardingVersion') === ONBOARDING_VERSION
      )
    } catch { return false }
  })()
  const [onboardingComplete, setOnboardingComplete] = useState(() => onboardingDone)
  const [showOnboarding, setShowOnboarding] = useState(() => !onboardingDone)

  // ── User role ────────────────────────────────────────────────────────────
  const [userRole, setUserRoleState] = useState(() => {
    return localStorage.getItem('ariya-user-role') || null
  })

  function setUserRole(role) {
    setUserRoleState(role)
    if (role) {
      localStorage.setItem('ariya-user-role', role)
    } else {
      localStorage.removeItem('ariya-user-role')
    }
  }

  // ── User preferences: indication + asset name ─────────────────────────
  const [userIndication, setUserIndicationState] = useState(() => {
    return localStorage.getItem('ariya-user-indication') || null
  })

  const [userAssetName, setUserAssetNameState] = useState(() => {
    return localStorage.getItem('ariya-user-asset') || null
  })

  function setUserIndication(val: string | null) {
    setUserIndicationState(val)
    if (val) {
      localStorage.setItem('ariya-user-indication', val)
      if (authUser) void upsertUserProfile(authUser.id, { indication: val })
    } else {
      localStorage.removeItem('ariya-user-indication')
    }
  }

  function setUserAssetName(val: string | null) {
    setUserAssetNameState(val)
    if (val) {
      localStorage.setItem('ariya-user-asset', val)
      if (authUser) void upsertUserProfile(authUser.id, { asset_name: val })
    } else {
      localStorage.removeItem('ariya-user-asset')
    }
  }

  const [userAssetId, setUserAssetIdState] = useState(() => {
    return localStorage.getItem('ariya-user-asset-id') || null
  })

  function setUserAssetId(val: string | null) {
    setUserAssetIdState(val)
    if (val) {
      localStorage.setItem('ariya-user-asset-id', val)
      if (authUser) void upsertUserProfile(authUser.id, { asset_id: val })
    } else {
      localStorage.removeItem('ariya-user-asset-id')
    }
  }

  // ── Config landscape expanded with live asset_lexicon synonyms ─────────────
  // The live lexicon ADDS alternate drug names to the config landscape; it does
  // not replace it. See lib/deterministic/lexicon.ts for why substituting one
  // for the other silently narrows the feed.
  //
  // Cached under its own key alongside the asset it was expanded for, so a
  // refresh needs no Supabase round-trip and a cache built for a different
  // asset is never reused. It deliberately does not share the `trackedAssets`
  // key, which onboarding overwrites with an array.
  const [expandedLexiconInns, setExpandedLexiconInns] = useState<string[] | null>(() => {
    try {
      const stored = localStorage.getItem(LEXICON_CACHE_KEY)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      if (parsed?.assetId !== localStorage.getItem('ariya-user-asset-id')) return null
      return Array.isArray(parsed.inns) ? parsed.inns : null
    } catch { return null }
  })

  useEffect(() => {
    if (!userAssetId) return
    const asset = getAssetById(userAssetId)
    if (!asset) return

    getAssetLexicon()
      .then(rows => {
        // Always a superset of asset.lexiconInns, including when rows is empty,
        // so there is no fallback branch and no way for a failed or empty fetch
        // to shrink relevance matching.
        const inns = expandLexiconInns(asset.lexiconInns, rows)
        setExpandedLexiconInns(inns)
        try {
          localStorage.setItem(LEXICON_CACHE_KEY, JSON.stringify({ assetId: userAssetId, inns }))
        } catch { /* cache is an optimisation; failing to write it is not an error */ }
      })
      .catch(err => {
        // Config landscape stays in force via the ?? in useConfig.
        console.warn('[AppContext] asset_lexicon fetch failed, using config landscape only:', err)
      })
  }, [userAssetId])

  useEffect(() => { analytics.identify(userRole) }, [userRole])

  function openOnboarding() {
    setShowOnboarding(true)
  }

  function closeOnboarding() {
    setShowOnboarding(false)
  }

  function completeOnboarding(selectedAssets) {
    localStorage.setItem('onboardingComplete', 'true')
    localStorage.setItem('onboardingVersion', ONBOARDING_VERSION)
    localStorage.setItem('trackedAssets', JSON.stringify(selectedAssets))
    setOnboardingComplete(true)
    setShowOnboarding(false)
    if (authUser) {
      void upsertUserProfile(authUser.id, {
        onboarding_complete: true,
        onboarding_version: ONBOARDING_VERSION,
      })
    }
  }

  // ── Guided tour ──────────────────────────────────────────────────────────
  const [tourActive, setTourActive] = useState(false)

  function startTour() {
    analytics.tour_started()
    setTourActive(true)
    setShowOnboarding(false)
    navigate('/')
  }

  function endTour(isComplete = false, step = 0) {
    if (isComplete) {
      analytics.tour_completed()
    } else {
      analytics.tour_skipped(step)
    }
    setTourActive(false)
    setOnboardingComplete(true)
    setShowOnboarding(false)
    try {
      localStorage.setItem('onboardingComplete', 'true')
      localStorage.setItem('onboardingVersion', ONBOARDING_VERSION)
    } catch { /* noop */ }
    if (authUser) {
      void upsertUserProfile(authUser.id, {
        onboarding_complete: true,
        onboarding_version: ONBOARDING_VERSION,
      })
    }
  }

  // ── Mobile nav overlay ───────────────────────────────────────────────────
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // The Ask modal state and the AI-click log lived here. Both are removed with
  // the RAG chat feature (handoff index §2, frontend §2). The click log had no
  // consumer beyond the modal it tracked.

  // ── Persistence ───────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(
      'pharma-inc-ciwarroom-watched',
      JSON.stringify([...watchedCompetitors])
    )
  }, [watchedCompetitors])

  // ── Actions ───────────────────────────────────────────────────────────────
  function toggleWatch(competitorId) {
    const willRemove = watchedCompetitors.has(competitorId)
    setWatchedCompetitors((prev) => {
      const next = new Set(prev)
      if (prev.has(competitorId)) next.delete(competitorId)
      else next.add(competitorId)
      return next
    })
    if (authUser) {
      if (willRemove) void removeWatchedCompetitor(authUser.id, competitorId)
      else void addWatchedCompetitor(authUser.id, competitorId)
    }
  }

  function resetWatchedCompetitors(ids: string[]) {
    setWatchedCompetitors(new Set(ids))
    if (authUser) void upsertWatchedCompetitors(authUser.id, ids)
  }

  function markAlertRead(alertId: string) {
    setReadAlerts((prev) => new Set([...prev, alertId]))
    if (authUser) void markAlertReadDb(authUser.id, alertId)
  }

  function markAlertUnread(alertId: string) {
    setReadAlerts((prev) => {
      const next = new Set(prev)
      next.delete(alertId)
      return next
    })
    if (authUser) void markAlertUnreadDb(authUser.id, alertId)
  }

  function markAllRead(ids: string[]) {
    analytics.alerts_marked_all_read(ids.length)
    setReadAlerts((prev) => new Set([...prev, ...ids]))
    if (authUser) void markAllAlertsReadDb(authUser.id, ids)
  }

  return (
    <AppContext.Provider
      value={{
        authUser,
        authLoading,
        watchedCompetitors,
        toggleWatch,
        readAlerts,
        markAlertRead,
        markAlertUnread,
        markAllRead,
        unreadCount,
        syncUnreadCount,
        onboardingComplete,
        showOnboarding,
        openOnboarding,
        closeOnboarding,
        completeOnboarding,
        userRole,
        setUserRole,
        tourActive,
        startTour,
        endTour,
        mobileNavOpen,
        openMobileNav: () => setMobileNavOpen(true),
        closeMobileNav: () => setMobileNavOpen(false),
        userIndication,
        setUserIndication,
        userAssetName,
        setUserAssetName,
        userAssetId,
        setUserAssetId,
        expandedLexiconInns,
        resetWatchedCompetitors,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

/**
 * Returns the user's saved preferences, falling back to DEMO defaults.
 * When the user has selected an asset via onboarding, fields are resolved
 * from the full AssetConfig record (assets-config.ts).
 * Lexicon arrays are exposed here but not yet consumed by WarRoom — that
 * wiring is deferred to 1-WIRE (backbone Phase 5).
 */
export function useConfig() {
  const { userIndication, userAssetName, userAssetId, expandedLexiconInns } = useApp()
  const asset = userAssetId ? getAssetById(userAssetId) : undefined
  return {
    assetName:            asset?.brandName            ?? userAssetName  ?? DEMO.assetName,
    innName:              asset?.innName               ?? DEMO.assetGenericName,
    indication:           asset?.indication            ?? userIndication ?? DEMO.therapeuticArea,
    indicationFull:       asset?.indicationFull        ?? userIndication ?? DEMO.therapeuticAreaFull,
    suggestedCompetitors: asset?.suggestedCompetitors  ?? ['takeda', 'biocryst', 'pharvaris'],
    // Expanded list when the lexicon fetch has landed; the config landscape
    // until then. Both are landscape lists, so relevance matching never narrows.
    lexiconInns:          expandedLexiconInns ?? asset?.lexiconInns ?? ASSETS_CONFIG[0].lexiconInns,
    lexiconTaTerms:       asset?.lexiconTaTerms        ?? ASSETS_CONFIG[0].lexiconTaTerms,
    assetGenericName:     asset?.innName               ?? DEMO.assetGenericName,
  }
}

/**
 * Display identity for the signed-in account.
 *
 * Ariya Light is one self-serve multi-tenant app, so the person's name and
 * organisation belong to their account, not to configuration. The UI previously
 * read both from src/data/user.json, which meant every visitor was greeted as
 * "David" from "Pharma Inc" regardless of who they were.
 *
 * `organisation` is deliberately absent rather than defaulted. Nothing in the
 * schema stores one: user_profiles carries indication, asset_id, asset_name and
 * onboarding state, and no company. Printing a company we do not hold would be a
 * plausible-looking placeholder, which is exactly what this product forbids.
 */
export interface AccountIdentity {
  /** Name to greet by, or null when the account carries none. Never invented. */
  displayName: string | null
  email: string | null
  /** True when nobody is signed in, e.g. VITE_BYPASS_AUTH in local development. */
  anonymous: boolean
}

export function useAccountIdentity(): AccountIdentity {
  const { authUser } = useApp()
  if (!authUser) return { displayName: null, email: null, anonymous: true }

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>
  const fromMetadata = [meta.full_name, meta.name, meta.display_name]
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .find(v => v.length > 0)

  const email = authUser.email ?? null
  // Fall back to the address's local part: it is the account's own identifier,
  // not a guess about the person. No prettifying, because turning "a.tayebulla"
  // into "A Tayebulla" would be inventing a name.
  const fromEmail = email ? email.split('@')[0] : ''

  return {
    displayName: fromMetadata || fromEmail || null,
    email,
    anonymous: false,
  }
}
