import { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import { DEMO } from '../config/demo-config'
import { ASSETS_CONFIG, getAssetById } from '../config/assets-config'
import {
  type LandscapeConfiguration,
  deriveLandscapeConfigurationFromAsset,
  migrateLegacyToLandscapeConfiguration,
  getLegacyIndicationCompat,
} from '../config/landscape-configuration'
import { getTherapeuticAreaById, getDiseaseAreaById } from '../config/therapeutic-areas'
import { expandLexiconInns } from '../lib/lexicon'
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
  getHandlingStates,
  setHandlingStateDb,
  type HandlingState,
} from '../lib/db'
import { supabase } from '../lib/supabase'

/**
 * Everything the provider supplies.
 *
 * Ported from origin/claude/ariya-lightci-two-step-eckocz: `createContext(null)`
 * gave the context the type `null`, so every field destructured from useApp()
 * inferred as `never` and any use of it ("watchedCompetitors.has(...)") was
 * reported as an error. TypeScript checks this interface against the actual
 * Provider value, so it cannot silently drift. Extended here (relative to the
 * Claude branch's own version) with every field iteration-5 actually carries —
 * handlingStates/triage, savedAlerts, askModal, aiClickLog — none of which exist
 * on that branch.
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
  handlingStates: Record<string, HandlingState>
  getHandlingState: (alertId: string) => HandlingState
  setHandlingState: (alertId: string, state: HandlingState) => void
  savedAlerts: Set<string>
  toggleSavedAlert: (alertId: string) => void
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
  askModal: { open: boolean; source: string | null; question: string | null }
  openAskModal: (source: string, question?: string | null) => void
  closeAskModal: () => void
  aiClickLog: { source: string | null; question: string | null; timestamp: string }[]
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
   * Canonical Frontend Step 2 configuration model — Therapeutic Area, Disease
   * Area, and Home Asset kept as three distinct fields (see
   * src/config/landscape-configuration.ts). userIndication/userAssetId/
   * userAssetName above remain as compatibility values for existing consumers;
   * this is the field new/canonical code should read and write going forward.
   */
  landscapeConfiguration: LandscapeConfiguration
  setLandscapeConfiguration: (patch: Partial<LandscapeConfiguration>) => void
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

/** Stores the canonical LandscapeConfiguration (Frontend Step 2) as JSON. */
const LANDSCAPE_CONFIGURATION_KEY = 'ariya-landscape-configuration'


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
          // Load profile + watchlist + read state + handling state in parallel; Supabase is source of truth.
          const [profile, watchedIds, readIds, handlingStatesRow] = await Promise.all([
            getUserProfile(userId),
            getWatchedCompetitorIds(userId),
            getReadAlertIds(userId),
            getHandlingStates(userId),
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

            // Canonical landscape fields: use them if Supabase already has them;
            // otherwise derive from asset_id via the catalog (never guessed).
            const hydrated: LandscapeConfiguration =
              profile.disease_area_id || profile.therapeutic_area_id
                ? {
                    diseaseAreaId: profile.disease_area_id,
                    therapeuticAreaId: profile.therapeutic_area_id,
                    homeAssetId: profile.asset_id,
                  }
                : deriveLandscapeConfigurationFromAsset(profile.asset_id)
            setLandscapeConfigurationState(hydrated)
            try { localStorage.setItem(LANDSCAPE_CONFIGURATION_KEY, JSON.stringify(hydrated)) } catch { /* noop */ }
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

          // Hydrate triage/handling state from Supabase.
          if (Object.keys(handlingStatesRow).length > 0) {
            setHandlingStates(handlingStatesRow)
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

  // ── Alert triage/handling state (Phase 4.1) ──────────────────────────────
  // Personal, Supabase-backed (alert_handling_state table) — same pattern as
  // readAlerts above, not localStorage. Absence of a key means 'needs_triage'
  // (the default); see getHandlingState below.
  const [handlingStates, setHandlingStates] = useState<Record<string, HandlingState>>(() => ({}))

  function getHandlingState(alertId: string): HandlingState {
    return handlingStates[alertId] ?? 'needs_triage'
  }

  function setHandlingState(alertId: string, state: HandlingState) {
    setHandlingStates((prev) => {
      if (state === 'needs_triage') {
        if (!(alertId in prev)) return prev
        const next = { ...prev }
        delete next[alertId]
        return next
      }
      return { ...prev, [alertId]: state }
    })
    if (authUser) void setHandlingStateDb(authUser.id, alertId, state)
  }

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
  // v6: replaced with the canonical Therapeutic Area -> Disease Area -> Home
  // Asset flow (Frontend Step 3) -- the old asset-first + static-competitor-
  // confirm flow is gone, so every returning user needs to see this once.
  const ONBOARDING_VERSION = 'v6'
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

  // ── Canonical landscape configuration (Frontend Step 2) ────────────────────
  // Therapeutic Area / Disease Area / Home Asset, kept distinct. Initialised
  // from its own persisted value if one exists; otherwise migrated from
  // whatever legacy asset/indication state localStorage already has (product
  // contract Step 7's fallback chain — never a guessed Therapeutic Area).
  const [landscapeConfiguration, setLandscapeConfigurationState] = useState<LandscapeConfiguration>(() => {
    let stored: LandscapeConfiguration | null = null
    try {
      const raw = localStorage.getItem(LANDSCAPE_CONFIGURATION_KEY)
      stored = raw ? (JSON.parse(raw) as LandscapeConfiguration) : null
    } catch { stored = null }
    return migrateLegacyToLandscapeConfiguration(stored, {
      assetId: localStorage.getItem('ariya-user-asset-id'),
      indication: localStorage.getItem('ariya-user-indication'),
    })
  })

  // Single source of truth for the canonical configuration (Frontend Step 3):
  // also keeps the three legacy fields in lockstep so existing consumers that
  // still read userAssetId/userAssetName/userIndication directly (not just
  // through useConfig()) see the same asset immediately, without the caller
  // having to write through three unrelated setters itself. Safe against the
  // userAssetId-watching effect below re-triggering this: once homeAssetId and
  // userAssetId agree, that effect's guard makes it a no-op.
  function setLandscapeConfiguration(patch: Partial<LandscapeConfiguration>) {
    setLandscapeConfigurationState((prev) => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(LANDSCAPE_CONFIGURATION_KEY, JSON.stringify(next)) } catch { /* noop */ }
      if (authUser) {
        void upsertUserProfile(authUser.id, {
          therapeutic_area_id: next.therapeuticAreaId,
          disease_area_id: next.diseaseAreaId,
        })
      }
      return next
    })

    if ('homeAssetId' in patch) {
      setUserAssetId(patch.homeAssetId ?? null)
      const asset = patch.homeAssetId ? getAssetById(patch.homeAssetId) : undefined
      if (asset) setUserAssetName(asset.brandName)
    }
    if ('diseaseAreaId' in patch) {
      const compat = getLegacyIndicationCompat(patch.diseaseAreaId ?? null)
      if (compat) setUserIndication(compat.indication)
    }
  }

  // Keeps landscapeConfiguration in sync when userAssetId changes through the
  // legacy setter directly (bypassing setLandscapeConfiguration above) — e.g. a
  // future/other caller that only knows about setUserAssetId. Converges to a
  // no-op once the two agree, so this and setLandscapeConfiguration's own
  // legacy-field sync never fight each other.
  useEffect(() => {
    if (userAssetId === landscapeConfiguration.homeAssetId) return
    setLandscapeConfiguration(deriveLandscapeConfigurationFromAsset(userAssetId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAssetId])

  // ── Config landscape expanded with live asset_lexicon synonyms ─────────────
  // Ported from origin/claude/ariya-lightci-two-step-eckocz. Replaces the prior
  // per-INN `getLexiconByInn` lookup, which returned one drug's synonyms and
  // measurably narrowed relevance matching when used as a landscape list (see
  // src/lib/lexicon.ts's header comment). The live lexicon now ADDS alternate
  // drug names to the config landscape; it never replaces it.
  //
  // Cached under its own key alongside the asset it was expanded for, so a
  // refresh needs no Supabase round-trip and a cache built for a different
  // asset is never reused. Deliberately does not share the `trackedAssets` key,
  // which onboarding overwrites with an array.
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

  // ── AI modal state ────────────────────────────────────────────────────────
  // `question`, when present, is the literal text the user asked (typed into
  // Ask InForm's chat input, or a specific question card) -- AskModal answers
  // that exact question via Ollama instead of the generic recent-activity
  // briefing it falls back to when a trigger has no specific question (e.g.
  // War Room's header "Ask InForm" button).
  const [askModal, setAskModal] = useState<{ open: boolean; source: string | null; question: string | null }>(
    { open: false, source: null, question: null }
  )

  // Track which AI buttons were clicked (valuable feedback signal per §5)
  const [aiClickLog, setAiClickLog] = useState<{ source: string | null; question: string | null; timestamp: string }[]>([])

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

  function openAskModal(source: string, question: string | null = null) {
    const entry = { source, question, timestamp: new Date().toISOString() }
    setAiClickLog((prev) => [...prev, entry])
    setAskModal({ open: true, source, question })
  }

  function closeAskModal() {
    setAskModal({ open: false, source: null, question: null })
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
        handlingStates,
        getHandlingState,
        setHandlingState,
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
        landscapeConfiguration,
        setLandscapeConfiguration,
        expandedLexiconInns,
        resetWatchedCompetitors,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
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
  const { userIndication, userAssetName, userAssetId, landscapeConfiguration, expandedLexiconInns } = useApp()
  const asset = userAssetId ? getAssetById(userAssetId) : undefined
  // Canonical-preferred: Disease Area -> legacy indication/indicationFull
  // projection (product contract Step 4 — never the reverse direction).
  const legacyCompat = getLegacyIndicationCompat(landscapeConfiguration.diseaseAreaId)
  return {
    assetName:            asset?.brandName            ?? userAssetName  ?? DEMO.assetName,
    innName:              asset?.innName               ?? DEMO.assetGenericName,
    indication:           legacyCompat?.indication      ?? asset?.indication      ?? userIndication ?? DEMO.therapeuticArea,
    indicationFull:       legacyCompat?.indicationFull  ?? asset?.indicationFull  ?? userIndication ?? DEMO.therapeuticAreaFull,
    suggestedCompetitors: asset?.suggestedCompetitors  ?? ['takeda', 'biocryst', 'pharvaris'],
    // Expanded list when the lexicon fetch has landed; the config landscape
    // until then. Both are landscape lists, so relevance matching never narrows.
    lexiconInns:          expandedLexiconInns ?? asset?.lexiconInns ?? ASSETS_CONFIG[0].lexiconInns,
    lexiconTaTerms:       asset?.lexiconTaTerms        ?? ASSETS_CONFIG[0].lexiconTaTerms,
    assetGenericName:     asset?.innName               ?? DEMO.assetGenericName,
    // Canonical Frontend Step 2 fields — the seam future onboarding/discovery UI
    // and War Room/Competitors/Intelligence should read from once they're wired
    // to be landscape-aware (not done this step; pages are unchanged).
    therapeuticArea:      landscapeConfiguration.therapeuticAreaId ? getTherapeuticAreaById(landscapeConfiguration.therapeuticAreaId) : undefined,
    diseaseArea:          landscapeConfiguration.diseaseAreaId ? getDiseaseAreaById(landscapeConfiguration.diseaseAreaId) : undefined,
    homeAssetId:          landscapeConfiguration.homeAssetId,
  }
}

/**
 * Display identity for the signed-in account.
 *
 * Ported from origin/claude/ariya-lightci-two-step-eckocz. Ariya Light is one
 * self-serve multi-tenant app, so the person's name and organisation belong to
 * their account, not to configuration — nothing here should read from
 * DEMO.personaName/personaEmail or src/data/user.json's static fixture.
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
