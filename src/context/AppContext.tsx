import { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { DEMO } from '../config/demo-config'
import { ASSETS_CONFIG, getAssetById } from '../config/assets-config'
import {
  getLexiconByInn,
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

const AppContext = createContext(null)


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
  }, [])

  // ── Competitor watch state ────────────────────────────────────────────────
  // Default: all three competitors are watched
  const [watchedCompetitors, setWatchedCompetitors] = useState(() => {
    try {
      const stored = localStorage.getItem('pharma-inc-ciwarroom-watched')
      return stored
        ? new Set(JSON.parse(stored))
        : new Set(['takeda', 'biocryst', 'pharvaris'])
    } catch {
      return new Set(['takeda', 'biocryst', 'pharvaris'])
    }
  })

  // ── Alert read state ──────────────────────────────────────────────────────
  // Source of truth is read_alerts table in Supabase. Seeded on SIGNED_IN.
  // localStorage is no longer the source of truth (kept only for migration).
  const [readAlerts, setReadAlerts] = useState<Set<string>>(() => new Set())

  // ── Saved alerts (Phase 3.1) ─────────────────────────────────────────────
  // Local-only for now, unlike readAlerts above -- there is no saved_alerts
  // table in Supabase yet, so this does not survive a browser/device switch.
  // A real per-user store (matching the readAlerts migration) is follow-up
  // work, not part of building the Alerts inbox itself.
  const [savedAlerts, setSavedAlerts] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('pharma-inc-ciwarroom-saved-alerts')
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })
  function toggleSavedAlert(alertId: string) {
    setSavedAlerts((prev) => {
      const next = new Set(prev)
      next.has(alertId) ? next.delete(alertId) : next.add(alertId)
      try { localStorage.setItem('pharma-inc-ciwarroom-saved-alerts', JSON.stringify([...next])) } catch { /* noop */ }
      return next
    })
  }

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

  // ── Live lexiconInns from asset_lexicon ───────────────────────────────────
  // Initialised from localStorage so the value survives page refresh without a
  // Supabase round-trip. Re-fetched whenever the tracked asset changes.
  const [liveLexiconInns, setLiveLexiconInns] = useState<string[] | null>(() => {
    try {
      const stored = localStorage.getItem('trackedAssets')
      if (!stored) return null
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed.lexiconInns) ? parsed.lexiconInns : null
    } catch { return null }
  })

  useEffect(() => {
    if (!userAssetId) return
    const asset = getAssetById(userAssetId)
    if (!asset) return

    getLexiconByInn(asset.innName)
      .then(synonyms => {
        if (!synonyms || synonyms.length === 0) {
          console.warn(`[AppContext] asset_lexicon: no row for "${asset.innName}" — using hardcoded lexiconInns`)
          return
        }
        setLiveLexiconInns(synonyms)
        try {
          const stored = localStorage.getItem('trackedAssets')
          const parsed = stored ? JSON.parse(stored) : {}
          localStorage.setItem('trackedAssets', JSON.stringify({ ...parsed, lexiconInns: synonyms }))
        } catch { /* noop */ }
      })
      .catch(err => {
        console.warn('[AppContext] asset_lexicon fetch failed:', err)
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

  // ── AI modal state ────────────────────────────────────────────────────────
  const [askModal, setAskModal] = useState({ open: false, source: null })

  // Track which AI buttons were clicked (valuable feedback signal per §5)
  const [aiClickLog, setAiClickLog] = useState([])

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

  function openAskModal(source) {
    const entry = { source, timestamp: new Date().toISOString() }
    setAiClickLog((prev) => [...prev, entry])
    setAskModal({ open: true, source })
  }

  function closeAskModal() {
    setAskModal({ open: false, source: null })
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
        savedAlerts,
        toggleSavedAlert,
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
        askModal,
        openAskModal,
        closeAskModal,
        aiClickLog,
        userIndication,
        setUserIndication,
        userAssetName,
        setUserAssetName,
        userAssetId,
        setUserAssetId,
        liveLexiconInns,
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
  const { userIndication, userAssetName, userAssetId, liveLexiconInns } = useApp()
  const asset = userAssetId ? getAssetById(userAssetId) : undefined
  return {
    assetName:            asset?.brandName            ?? userAssetName  ?? DEMO.assetName,
    innName:              asset?.innName               ?? DEMO.assetGenericName,
    indication:           asset?.indication            ?? userIndication ?? DEMO.therapeuticArea,
    indicationFull:       asset?.indicationFull        ?? userIndication ?? DEMO.therapeuticAreaFull,
    suggestedCompetitors: asset?.suggestedCompetitors  ?? ['takeda', 'biocryst', 'pharvaris'],
    lexiconInns:          liveLexiconInns ?? asset?.lexiconInns ?? ASSETS_CONFIG[0].lexiconInns,
    lexiconTaTerms:       asset?.lexiconTaTerms        ?? ASSETS_CONFIG[0].lexiconTaTerms,
    assetGenericName:     asset?.innName               ?? DEMO.assetGenericName,
  }
}
