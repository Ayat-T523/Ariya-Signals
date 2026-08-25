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
import {
  type TrackedCompetitor, type ManualAssetIdentity, type ManualDiseaseArea,
  type DiseaseAreaDisplay, resolveDiseaseAreaDisplayFrom,
  type HomeAssetDisplay, resolveHomeAssetDisplayFrom,
  resolveCanonicalIndicationId,
} from '../config/setup-draft'
import type { ResolvedDiseaseArea } from '../lib/api/diseaseSearch'
import type { ResolvedAssetIdentity } from '../lib/api/assetSearch'
import { expandLexiconInns } from '../lib/lexicon'
import { getAssetLexicon, type HandlingState } from '../lib/db'
import { useAuth } from './AuthContext'
import { type TimeHorizon, DEFAULT_TIME_HORIZON, isTimeHorizon } from '../lib/timeHorizon'
import { triggerLandscapeHydration, toHydrationUIStatus, type HydrationUIStatus } from '../lib/api/landscapeHydration'

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
  /**
   * A manually entered Home Asset's display identity (brand/INN/company).
   * `landscapeConfiguration.homeAssetId` alone is opaque for a manual asset
   * (it never resolves via getAssetById) -- this is what lets the shell
   * header show "RYSTIGGO" instead of nothing once setup completes. null
   * whenever the configured Home Asset is a catalogued AssetConfig instead.
   */
  manualHomeAsset: ManualAssetIdentity | null
  /**
   * Targeted Implementation 4 — the equivalent persistence path for a Home
   * Asset selected from live asset search (Step 20/28's ResolvedAssetIdentity),
   * mirroring manualHomeAsset above exactly the same way resolvedDiseaseArea
   * mirrors manualDiseaseArea below. `landscapeConfiguration.homeAssetId`
   * alone is opaque for a resolved asset too (it never resolves via
   * getAssetById) -- before this task, completeSetup() never even received
   * this identity, so it was silently discarded the moment setup completed.
   * Mutually exclusive with manualHomeAsset in practice, both kept
   * independently persisted.
   */
  resolvedHomeAsset: ResolvedAssetIdentity | null
  /**
   * Targeted Implementation 2 — the equivalent persistence path for a
   * non-static Disease Area, mirroring manualHomeAsset above exactly.
   * `landscapeConfiguration.diseaseAreaId` alone is opaque for a manual or
   * MONDO-resolved Disease Area (it never resolves via getDiseaseAreaById) --
   * these two are what let the main app still know "Non-Small Cell Lung
   * Cancer" (or a live MONDO result) once setup completes, instead of
   * falling back to "Disease Area not set". Mutually exclusive in practice
   * (see setup-draft.ts's own mutual-exclusion discipline for
   * manualDiseaseArea/resolvedDiseaseArea) but both kept independently
   * persisted, same as the SetupDraft shape they're carried forward from.
   */
  manualDiseaseArea: ManualDiseaseArea | null
  resolvedDiseaseArea: ResolvedDiseaseArea | null
  completeSetup: (
    competitors: TrackedCompetitor[],
    manualHomeAsset: ManualAssetIdentity | null,
    resolvedHomeAsset: ResolvedAssetIdentity | null,
    manualDiseaseArea: ManualDiseaseArea | null,
    resolvedDiseaseArea: ResolvedDiseaseArea | null,
  ) => void
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
  /**
   * Historical evidence hydration (Step 1, 2026-08-24) — the ONE shared
   * Month/Quarter/Year time-horizon selection, read/written identically by
   * WarRoom.tsx and Portal.tsx (see src/lib/timeHorizon.ts). Living here,
   * not as independent per-page state, is what makes it genuinely "one
   * shared contract" rather than two components that happen to default to
   * the same value today and can silently drift apart later.
   */
  timeHorizon: TimeHorizon
  setTimeHorizon: (horizon: TimeHorizon) => void
  /**
   * CORRECTNESS GATE FIX (report section 5/6) — the ONE shared hydration
   * coverage-status indicator, read/written identically by WarRoom.tsx and
   * Portal.tsx. 'idle' before any hydration attempt has been made this
   * session; never blanked back to 'idle' by a later attempt failing --
   * see ensureHydration()'s own docstring on why persisted evidence, and
   * the last-known status, both survive a subsequent hydration outcome.
   */
  hydrationStatus: HydrationUIStatus
  /**
   * Idempotent, safe to call from multiple mount effects (WarRoom.tsx AND
   * Portal.tsx) without duplicating logic or double-triggering an
   * expensive live discovery run — see this function's own docstring in
   * AppProvider for the full contract (shared with completeSetup()'s own
   * post-setup trigger).
   */
  ensureHydration: () => void
  /**
   * NEW LANDSCAPE SIGNAL BOOTSTRAP (2026-08-24) — the awaitable counterpart
   * to ensureHydration() above, for the ONE call site that must NOT be
   * fire-and-forget: SetupPage.tsx's own handleEnterAriya/handleStartTour,
   * called with the freshly-completed draft's own values (never read from
   * context state, which has not re-rendered with this draft yet -- same
   * "must use the freshly-passed values" contract _runEnsureHydration()'s
   * own docstring already documents). Awaiting this before navigating into
   * the workspace closes the real, proven gap: a brand-new landscape's
   * hydration (discovery + evidence enrichment + Signal derivation) is a
   * real backend call that can take real time, and ensureHydration()'s own
   * fire-and-forget mount-effect trigger races War Room/Intelligence
   * Feed's OWN first Signal fetch -- the exact same underlying hydration
   * call, just awaited here instead of backgrounded.
   */
  hydrateNewLandscape: (
    homeAssetId: string | null,
    diseaseAreaId: string | null,
    manualAsset: ManualAssetIdentity | null,
    resolvedAsset: ResolvedAssetIdentity | null,
    manualDisease: ManualDiseaseArea | null,
    resolvedDisease: ResolvedDiseaseArea | null,
    trackedCompetitorIds: string[],
  ) => Promise<void>
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

  const MANUAL_HOME_ASSET_KEY = 'ariya-manual-home-asset'
  const [manualHomeAsset, setManualHomeAssetState] = useState<ManualAssetIdentity | null>(() => {
    try {
      const raw = localStorage.getItem(MANUAL_HOME_ASSET_KEY)
      return raw ? (JSON.parse(raw) as ManualAssetIdentity) : null
    } catch { return null }
  })

  // Targeted Implementation 4 -- same persistence shape as manualHomeAsset
  // above, for a Home Asset selected via live asset search instead. Before
  // this task, completeSetup() had no parameter for it at all, so it was
  // silently discarded on setup completion (see this field's own doc
  // comment on AppContextValue).
  const RESOLVED_HOME_ASSET_KEY = 'ariya-resolved-home-asset'
  const [resolvedHomeAsset, setResolvedHomeAssetState] = useState<ResolvedAssetIdentity | null>(() => {
    try {
      const raw = localStorage.getItem(RESOLVED_HOME_ASSET_KEY)
      return raw ? (JSON.parse(raw) as ResolvedAssetIdentity) : null
    } catch { return null }
  })

  // Targeted Implementation 2 -- same persistence shape as manualHomeAsset
  // above, one key per source since a landscape carries at most one of the
  // two (never both; see setup-draft.ts's mutual exclusion).
  const MANUAL_DISEASE_AREA_KEY = 'ariya-manual-disease-area'
  const RESOLVED_DISEASE_AREA_KEY = 'ariya-resolved-disease-area'
  const [manualDiseaseArea, setManualDiseaseAreaState] = useState<ManualDiseaseArea | null>(() => {
    try {
      const raw = localStorage.getItem(MANUAL_DISEASE_AREA_KEY)
      return raw ? (JSON.parse(raw) as ManualDiseaseArea) : null
    } catch { return null }
  })
  const [resolvedDiseaseArea, setResolvedDiseaseAreaState] = useState<ResolvedDiseaseArea | null>(() => {
    try {
      const raw = localStorage.getItem(RESOLVED_DISEASE_AREA_KEY)
      return raw ? (JSON.parse(raw) as ResolvedDiseaseArea) : null
    } catch { return null }
  })

  // ── Historical evidence hydration coverage (Step 1, 2026-08-24) ──────────
  // CORRECTNESS GATE FIX (report section 5/6/8): ONE shared implementation
  // for BOTH the post-setup automatic trigger and the "existing configured
  // workspace opens" trigger -- never two independently-drifting copies of
  // the identity-derivation + hydration-request logic. `idle` until the
  // first attempt this session; a later attempt's outcome always overwrites
  // it (never silently reset back to `idle`), so a compact status line can
  // always show the LAST KNOWN coverage quality, not just "nothing has
  // happened yet."
  const [hydrationStatus, setHydrationStatus] = useState<HydrationUIStatus>('idle')

  async function _runEnsureHydration(
    homeAssetId: string | null,
    diseaseAreaId: string | null,
    manualAsset: ManualAssetIdentity | null,
    resolvedAsset: ResolvedAssetIdentity | null,
    manualDisease: ManualDiseaseArea | null,
    resolvedDisease: ResolvedDiseaseArea | null,
    trackedCompetitorIds: string[],
  ): Promise<void> {
    // SAME resolvers (resolveHomeAssetDisplayFrom/resolveDiseaseAreaDisplayFrom/
    // resolveCanonicalIndicationId) every other write call site already
    // uses -- never a second, competing identity derivation.
    const homeAssetDisplay = resolveHomeAssetDisplayFrom(homeAssetId, manualAsset, resolvedAsset)
    const catalogAsset = homeAssetId ? getAssetById(homeAssetId) : undefined
    const homeAssetName = homeAssetDisplay?.displayName ?? catalogAsset?.brandName ?? null
    const homeCompanyName = homeAssetDisplay?.companyName ?? catalogAsset?.company ?? null

    const diseaseAreaDisplay = resolveDiseaseAreaDisplayFrom(diseaseAreaId, manualDisease, resolvedDisease)
    const catalogDisease = diseaseAreaId ? getDiseaseAreaById(diseaseAreaId) : undefined
    const indicationName = diseaseAreaDisplay?.name ?? catalogDisease?.name ?? null
    const canonicalIndicationId = resolveCanonicalIndicationId(diseaseAreaId, resolvedDisease)

    if (!homeAssetName || !indicationName) return  // No real landscape configured yet -- nothing to hydrate.

    setHydrationStatus('hydrating')
    try {
      const result = await triggerLandscapeHydration({
        homeAsset: homeAssetName, indication: indicationName,
        homeCompany: homeCompanyName, indicationId: canonicalIndicationId,
        trackedCompetitorIds,
      })
      setHydrationStatus(toHydrationUIStatus(result.status))
    } catch {
      // A genuine backend/network failure (e.g. 502 discovery_source_
      // unavailable) -- honestly surfaced as 'failed', never silently
      // swallowed back to 'idle': existing persisted evidence (fetched
      // completely independently by WarRoom.tsx/Portal.tsx) remains
      // visible regardless of this outcome.
      setHydrationStatus('failed')
    }
  }

  /**
   * The "existing configured workspace opens" trigger (report section 5) --
   * called from WarRoom.tsx/Portal.tsx's own mount effect. Reads CURRENT
   * state (unlike completeSetup() below, which must use the freshly-passed
   * values before this render's state update lands). Fire-and-forget by
   * design: the backend's own freshness/retry-suppression policy (see
   * run_hydration()'s docstring) is what actually prevents redundant
   * re-hydration on every page visit -- this function does not need its
   * own separate "have I already fired this session" guard beyond that.
   */
  function ensureHydration() {
    _runEnsureHydration(
      landscapeConfiguration.homeAssetId, landscapeConfiguration.diseaseAreaId,
      manualHomeAsset, resolvedHomeAsset, manualDiseaseArea, resolvedDiseaseArea,
      trackedCompetitors.filter((c) => c.source === 'discovered').map((c) => c.companyId),
    ).catch(() => { /* noop -- already handled inside _runEnsureHydration */ })
  }

  function completeSetup(
    competitors: TrackedCompetitor[],
    nextManualHomeAsset: ManualAssetIdentity | null,
    nextResolvedHomeAsset: ResolvedAssetIdentity | null,
    nextManualDiseaseArea: ManualDiseaseArea | null,
    nextResolvedDiseaseArea: ResolvedDiseaseArea | null,
  ) {
    setTrackedCompetitorsState(competitors)
    setManualHomeAssetState(nextManualHomeAsset)
    setResolvedHomeAssetState(nextResolvedHomeAsset)
    setManualDiseaseAreaState(nextManualDiseaseArea)
    setResolvedDiseaseAreaState(nextResolvedDiseaseArea)
    try {
      localStorage.setItem(TRACKED_COMPETITORS_KEY, JSON.stringify(competitors))
      if (nextManualHomeAsset) localStorage.setItem(MANUAL_HOME_ASSET_KEY, JSON.stringify(nextManualHomeAsset))
      else localStorage.removeItem(MANUAL_HOME_ASSET_KEY)
      if (nextResolvedHomeAsset) localStorage.setItem(RESOLVED_HOME_ASSET_KEY, JSON.stringify(nextResolvedHomeAsset))
      else localStorage.removeItem(RESOLVED_HOME_ASSET_KEY)
      if (nextManualDiseaseArea) localStorage.setItem(MANUAL_DISEASE_AREA_KEY, JSON.stringify(nextManualDiseaseArea))
      else localStorage.removeItem(MANUAL_DISEASE_AREA_KEY)
      if (nextResolvedDiseaseArea) localStorage.setItem(RESOLVED_DISEASE_AREA_KEY, JSON.stringify(nextResolvedDiseaseArea))
      else localStorage.removeItem(RESOLVED_DISEASE_AREA_KEY)
    } catch { /* noop */ }
    localStorage.setItem('onboardingComplete', 'true')
    localStorage.setItem('onboardingVersion', ONBOARDING_VERSION)
    setOnboardingComplete(true)

    // Historical evidence hydration (Step 1, 2026-08-24) — automatic,
    // NON-BLOCKING trigger fired right after setup persists a real
    // landscape, via the SAME _runEnsureHydration() the workspace-open
    // trigger uses (see ensureHydration()'s own docstring) -- passes the
    // freshly-provided identities directly, since this render's own state
    // update for them has not landed yet.
    _runEnsureHydration(
      landscapeConfiguration.homeAssetId, landscapeConfiguration.diseaseAreaId,
      nextManualHomeAsset, nextResolvedHomeAsset, nextManualDiseaseArea, nextResolvedDiseaseArea,
      // The freshly-provided `competitors` param, not `trackedCompetitors`
      // state -- this render's own state update for it has not landed yet
      // (same discipline this function already applies to every other
      // freshly-provided identity above).
      competitors.filter((c) => c.source === 'discovered').map((c) => c.companyId),
    ).catch(() => { /* noop -- already handled inside _runEnsureHydration */ })
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

  // ── AI modal state ────────────────────────────────────────────────────────
  // `question`, when present, is the literal text the user asked (typed into
  // Ask Ariya's chat input, or a specific question card) -- AskModal answers
  // that exact question via Ollama instead of the generic recent-activity
  // briefing it falls back to when a trigger has no specific question (e.g.
  // War Room's header "Ask Ariya" button).
  const [askModal, setAskModal] = useState<{ open: boolean; source: string | null; question: string | null }>(
    { open: false, source: null, question: null }
  )

  // Track which AI buttons were clicked (valuable feedback signal per §5)
  const [aiClickLog, setAiClickLog] = useState<{ source: string | null; question: string | null; timestamp: string }[]>([])

  // ── Historical evidence hydration time horizon (Step 1, 2026-08-24) ────────
  // ONE shared Month/Quarter/Year selection -- see src/lib/timeHorizon.ts and
  // this field's own docstring on AppContextValue for why this lives here
  // rather than as independent per-page state.
  const TIME_HORIZON_KEY = 'ariya-time-horizon'
  const [timeHorizon, setTimeHorizonState] = useState<TimeHorizon>(() => {
    try {
      const stored = localStorage.getItem(TIME_HORIZON_KEY)
      return isTimeHorizon(stored) ? stored : DEFAULT_TIME_HORIZON
    } catch { return DEFAULT_TIME_HORIZON }
  })
  function setTimeHorizon(horizon: TimeHorizon) {
    setTimeHorizonState(horizon)
    try { localStorage.setItem(TIME_HORIZON_KEY, horizon) } catch { /* noop */ }
  }

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
        manualHomeAsset,
        resolvedHomeAsset,
        manualDiseaseArea,
        resolvedDiseaseArea,
        completeSetup,
        userRole,
        setUserRole,
        tourActive,
        startTour,
        endTour,
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
        timeHorizon,
        setTimeHorizon,
        hydrationStatus,
        ensureHydration,
        hydrateNewLandscape: _runEnsureHydration,
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
  const {
    userIndication, userAssetName, userAssetId, landscapeConfiguration, expandedLexiconInns,
    manualHomeAsset, resolvedHomeAsset, manualDiseaseArea, resolvedDiseaseArea,
  } = useApp()
  const asset = userAssetId ? getAssetById(userAssetId) : undefined
  // Targeted Implementation 4 — Home Asset resolution priority: persisted
  // manual/resolved identity first, legacy getAssetById() only as part of
  // the SAME shared resolver's own third branch (never a second, competing
  // implementation) so an existing landscape carrying only a legacy
  // homeAssetId keeps working exactly as before. Same shared
  // resolveHomeAssetDisplayFrom() Stage 1/2/3 already use via
  // resolveHomeAssetDisplay(draft).
  const homeAssetDisplay: HomeAssetDisplay | null = resolveHomeAssetDisplayFrom(
    landscapeConfiguration.homeAssetId, manualHomeAsset, resolvedHomeAsset,
  )
  // Canonical-preferred: Disease Area -> legacy indication/indicationFull
  // projection (product contract Step 4 — never the reverse direction).
  const legacyCompat = getLegacyIndicationCompat(landscapeConfiguration.diseaseAreaId)
  // Targeted Implementation 2 — Disease Area resolution priority: persisted
  // manual/MONDO-resolved identity first, legacy getDiseaseAreaById() only as
  // the fallback (below, on the unchanged `diseaseArea` field) so an existing
  // landscape carrying only a legacy diseaseAreaId keeps working exactly as
  // before. Same shared resolveDiseaseAreaDisplayFrom() Stage 1/2/3 already
  // use via resolveDiseaseAreaDisplay(draft) — never a second, competing
  // resolution implementation.
  const diseaseAreaDisplay: DiseaseAreaDisplay | null = resolveDiseaseAreaDisplayFrom(
    landscapeConfiguration.diseaseAreaId, manualDiseaseArea, resolvedDiseaseArea,
  )
  // Targeted Implementation 2A — indication/indicationFull compatibility for
  // a manual or MONDO-resolved Disease Area (legacyCompat is null for both,
  // since getLegacyIndicationCompat() only ever understands a catalog id).
  // Reuses diseaseAreaDisplay directly -- never a second Disease Area
  // resolver -- and never fabricates a short code that doesn't exist for
  // these two sources: both indication/indicationFull surface the SAME
  // verbatim name (manual) or preferredName (mondo, already what
  // diseaseAreaDisplay.name holds for that source per Implementation 2's own
  // mapping), exactly as this task's own rule states. Only used when
  // legacyCompat itself is null -- a catalog Disease Area's existing
  // shortCode/name split is preserved completely unchanged.
  const diseaseAreaCompat = !legacyCompat && diseaseAreaDisplay
    ? { indication: diseaseAreaDisplay.name, indicationFull: diseaseAreaDisplay.name }
    : null
  return {
    // Targeted Implementation 4 — homeAssetDisplay first (manual -> resolved
    // -> catalog, all three already reconciled by the ONE shared resolver
    // above), legacy userAssetName only as a fallback for a landscape that
    // predates this task's own persistence, DEMO last. asset?.brandName is
    // kept as a redundant extra layer for defense-in-depth (homeAssetDisplay's
    // own third branch already covers the catalog case via the identical
    // getAssetById lookup) -- never removed, since it costs nothing and
    // preserves the exact pre-existing fallback shape for anything relying on
    // it.
    assetName:            homeAssetDisplay?.displayName ?? asset?.brandName ?? userAssetName  ?? DEMO.assetName,
    // innName mirrors assetName's own priority -- a manual asset's INN is
    // genuinely optional (never fabricated when absent; see
    // resolveHomeAssetDisplayFrom's own HomeAssetDisplay contract), so this
    // still correctly falls through to DEMO when homeAssetDisplay.innName
    // itself is null, exactly the existing "leave it absent" semantics.
    innName:              homeAssetDisplay?.innName ?? asset?.innName ?? DEMO.assetGenericName,
    indication:           legacyCompat?.indication      ?? diseaseAreaCompat?.indication      ?? asset?.indication      ?? userIndication ?? DEMO.therapeuticArea,
    indicationFull:       legacyCompat?.indicationFull  ?? diseaseAreaCompat?.indicationFull  ?? asset?.indicationFull  ?? userIndication ?? DEMO.therapeuticAreaFull,
    // Catalog-only enrichment with no manual/resolved equivalent to
    // substitute -- left completely untouched (never fabricated for a
    // manual/resolved asset, which simply has no such data).
    suggestedCompetitors: asset?.suggestedCompetitors  ?? ['takeda', 'biocryst', 'pharvaris'],
    // Expanded list when the lexicon fetch has landed; the config landscape
    // until then. Both are landscape lists, so relevance matching never narrows.
    lexiconInns:          expandedLexiconInns ?? asset?.lexiconInns ?? ASSETS_CONFIG[0].lexiconInns,
    lexiconTaTerms:       asset?.lexiconTaTerms        ?? ASSETS_CONFIG[0].lexiconTaTerms,
    assetGenericName:     homeAssetDisplay?.innName ?? asset?.innName ?? DEMO.assetGenericName,
    // Canonical Frontend Step 2 fields — the seam future onboarding/discovery UI
    // and War Room/Competitors/Intelligence should read from once they're wired
    // to be landscape-aware (not done this step; pages are unchanged).
    therapeuticArea:      landscapeConfiguration.therapeuticAreaId ? getTherapeuticAreaById(landscapeConfiguration.therapeuticAreaId) : undefined,
    // Legacy field, UNCHANGED (static catalog lookup only) -- existing
    // consumers expecting a catalog DiseaseArea (id/shortCode/etc.) keep
    // working; undefined for a manual/MONDO Disease Area, exactly as before
    // this task. New code should prefer diseaseAreaDisplay below instead.
    diseaseArea:          landscapeConfiguration.diseaseAreaId ? getDiseaseAreaById(landscapeConfiguration.diseaseAreaId) : undefined,
    // Targeted Implementation 2 — the non-static-aware Disease Area
    // resolution: manual -> MONDO-resolved -> legacy catalog, in that order.
    // Prefer this over `diseaseArea` for any display that must also work for
    // a manually entered or MONDO-resolved Disease Area.
    diseaseAreaDisplay,
    // Targeted Implementation 4 — the non-static-aware Home Asset resolution:
    // manual -> resolved -> legacy catalog, in that order. The single shared
    // source AppSidebar also consumes -- never a second, competing
    // resolution implementation.
    homeAssetDisplay,
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
