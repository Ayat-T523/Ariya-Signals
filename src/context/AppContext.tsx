import { createContext, useContext, useState, useEffect } from 'react'
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
import { type TrackedCompetitor } from '../config/setup-draft'
import { expandLexiconInns } from '../lib/lexicon'
import { getAssetLexicon, type HandlingState } from '../lib/db'
import { useAuth } from './AuthContext'

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
  /**
   * Staged setup completion (Frontend "Build Full-Page Staged Landscape
   * Setup"). Persists the final tracked-competitor list produced by Stage 3
   * -- kept entirely separate from watchedCompetitors (the legacy HAE
   * default) and from LandscapeConfiguration (what market/home asset is
   * being analysed, not who the competitors are). See setup-draft.ts.
   */
  trackedCompetitors: TrackedCompetitor[]
  completeSetup: (competitors: TrackedCompetitor[]) => void
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


export function AppProvider({ children }) {
  const navigate = useNavigate()

  // ── Competitor watch state ────────────────────────────────────────────────
  // LEGACY DEMO DATA (Frontend Step 3.5): this HAE-specific default predates
  // the canonical LandscapeConfiguration and is not derived from it. Setting a
  // new landscape (any Therapeutic Area/Disease Area) never touches this --
  // see landscapeConfiguration below. Real discovered + explicitly-selected
  // competitors, scoped to the configured landscape, are Frontend Steps 4-6.
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
  // Frontend Step 3.5: local-only persistence, no Supabase read_alerts table.
  // Reuses the pre-auth-era localStorage key (the same one the old Supabase
  // migration path used to read from once, on first sign-in).
  const [readAlerts, setReadAlerts] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('pharma-inc-ciwarroom-read-alerts')
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })
  useEffect(() => {
    try { localStorage.setItem('pharma-inc-ciwarroom-read-alerts', JSON.stringify([...readAlerts])) } catch { /* noop */ }
  }, [readAlerts])

  // ── Alert triage/handling state ───────────────────────────────────────────
  // Frontend Step 3.5: local-only persistence, no Supabase alert_handling_state
  // table. Absence of a key means 'needs_triage' (the default); see
  // getHandlingState below.
  const HANDLING_STATES_KEY = 'ariya-handling-states'
  const [handlingStates, setHandlingStates] = useState<Record<string, HandlingState>>(() => {
    try {
      const raw = localStorage.getItem(HANDLING_STATES_KEY)
      return raw ? (JSON.parse(raw) as Record<string, HandlingState>) : {}
    } catch { return {} }
  })

  function getHandlingState(alertId: string): HandlingState {
    return handlingStates[alertId] ?? 'needs_triage'
  }

  function setHandlingState(alertId: string, state: HandlingState) {
    setHandlingStates((prev) => {
      let next: Record<string, HandlingState>
      if (state === 'needs_triage') {
        if (!(alertId in prev)) return prev
        next = { ...prev }
        delete next[alertId]
      } else {
        next = { ...prev, [alertId]: state }
      }
      try { localStorage.setItem(HANDLING_STATES_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
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
  // v7: modal onboarding retired in favor of the dedicated full-page staged
  // setup (/setup) -- no existing user has ever completed Stage 2/3 (they
  // didn't exist), so every returning user is routed through setup once more.
  const ONBOARDING_VERSION = 'v7'
  const onboardingDone = (() => {
    try {
      return (
        localStorage.getItem('onboardingComplete') === 'true' &&
        localStorage.getItem('onboardingVersion') === ONBOARDING_VERSION
      )
    } catch { return false }
  })()
  const [onboardingComplete, setOnboardingComplete] = useState(() => onboardingDone)

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
    } else {
      localStorage.removeItem('ariya-user-indication')
    }
  }

  function setUserAssetName(val: string | null) {
    setUserAssetNameState(val)
    if (val) {
      localStorage.setItem('ariya-user-asset', val)
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

  // ── Tracked competitors (Stage 3 output) ────────────────────────────────
  // Separate key from 'pharma-inc-ciwarroom-watched' (watchedCompetitors,
  // the legacy HAE default above) -- completing setup never touches that
  // key, so the Takeda/BioCryst/Pharvaris default can never overwrite it.
  const TRACKED_COMPETITORS_KEY = 'ariya-tracked-competitors'
  const [trackedCompetitors, setTrackedCompetitorsState] = useState<TrackedCompetitor[]>(() => {
    try {
      const raw = localStorage.getItem(TRACKED_COMPETITORS_KEY)
      return raw ? (JSON.parse(raw) as TrackedCompetitor[]) : []
    } catch { return [] }
  })

  function completeSetup(competitors: TrackedCompetitor[]) {
    setTrackedCompetitorsState(competitors)
    try { localStorage.setItem(TRACKED_COMPETITORS_KEY, JSON.stringify(competitors)) } catch { /* noop */ }
    localStorage.setItem('onboardingComplete', 'true')
    localStorage.setItem('onboardingVersion', ONBOARDING_VERSION)
    setOnboardingComplete(true)
  }

  // ── Guided tour ──────────────────────────────────────────────────────────
  const [tourActive, setTourActive] = useState(false)

  function startTour() {
    analytics.tour_started()
    setTourActive(true)
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
    try {
      localStorage.setItem('onboardingComplete', 'true')
      localStorage.setItem('onboardingVersion', ONBOARDING_VERSION)
    } catch { /* noop */ }
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
    setWatchedCompetitors((prev) => {
      const next = new Set(prev)
      if (prev.has(competitorId)) next.delete(competitorId)
      else next.add(competitorId)
      return next
    })
  }

  function resetWatchedCompetitors(ids: string[]) {
    setWatchedCompetitors(new Set(ids))
  }

  function markAlertRead(alertId: string) {
    setReadAlerts((prev) => new Set([...prev, alertId]))
  }

  function markAlertUnread(alertId: string) {
    setReadAlerts((prev) => {
      const next = new Set(prev)
      next.delete(alertId)
      return next
    })
  }

  function markAllRead(ids: string[]) {
    analytics.alerts_marked_all_read(ids.length)
    setReadAlerts((prev) => new Set([...prev, ...ids]))
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
        trackedCompetitors,
        completeSetup,
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
 * Frontend Step 3.5: source is now AuthContext (provider-independent), not
 * Supabase. Ariya Light is one self-serve multi-tenant app, so the person's
 * name and organisation belong to their account, not to configuration --
 * nothing here should read from DEMO.personaName/personaEmail or
 * src/data/user.json's static fixture. In local auth mode the account is the
 * explicit "Local Developer" identity from AuthContext, never "David".
 *
 * `organisation` is deliberately absent rather than defaulted -- printing a
 * company we do not hold would be a plausible-looking placeholder, which is
 * exactly what this product forbids.
 */
export interface AccountIdentity {
  /** Name to greet by, or null when the account carries none. Never invented. */
  displayName: string | null
  email: string | null
  /** True when nobody is signed in. */
  anonymous: boolean
}

export function useAccountIdentity(): AccountIdentity {
  const { user } = useAuth()
  if (!user) return { displayName: null, email: null, anonymous: true }

  return {
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    anonymous: false,
  }
}
