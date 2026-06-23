import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { analytics } from '../lib/analytics'
import alertsData from '../data/alerts.json'
import { DEMO } from '../config/demo-config'
import { ASSETS_CONFIG, getAssetById } from '../config/assets-config'
import { getLexiconByInn } from '../lib/db'

const AppContext = createContext(null)


export function AppProvider({ children }) {
  const navigate = useNavigate()

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
  // Seed from: (a) localStorage and (b) alerts already marked read in the JSON
  const [readAlerts, setReadAlerts] = useState(() => {
    try {
      const stored = localStorage.getItem('pharma-inc-ciwarroom-read-alerts')
      const fromStorage = stored ? new Set(JSON.parse(stored)) : new Set()
      const fromData = new Set(alertsData.filter((a) => a.read).map((a) => a.id))
      return new Set([...fromStorage, ...fromData])
    } catch {
      return new Set(alertsData.filter((a) => a.read).map((a) => a.id))
    }
  })

  // ── Onboarding state ─────────────────────────────────────────────────────
  // Version stamp: bump this string whenever onboarding content changes so
  // returning visitors see the updated flow instead of being skipped over.
  const ONBOARDING_VERSION = 'v4'
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
    if (val) localStorage.setItem('ariya-user-indication', val)
    else localStorage.removeItem('ariya-user-indication')
  }

  function setUserAssetName(val: string | null) {
    setUserAssetNameState(val)
    if (val) localStorage.setItem('ariya-user-asset', val)
    else localStorage.removeItem('ariya-user-asset')
  }

  const [userAssetId, setUserAssetIdState] = useState(() => {
    return localStorage.getItem('ariya-user-asset-id') || null
  })

  function setUserAssetId(val: string | null) {
    setUserAssetIdState(val)
    if (val) localStorage.setItem('ariya-user-asset-id', val)
    else localStorage.removeItem('ariya-user-asset-id')
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

  useEffect(() => {
    localStorage.setItem(
      'pharma-inc-ciwarroom-read-alerts',
      JSON.stringify([...readAlerts])
    )
  }, [readAlerts])

  // ── Actions ───────────────────────────────────────────────────────────────
  function toggleWatch(competitorId) {
    setWatchedCompetitors((prev) => {
      const next = new Set(prev)
      if (next.has(competitorId)) next.delete(competitorId)
      else next.add(competitorId)
      return next
    })
  }

  function resetWatchedCompetitors(ids: string[]) {
    setWatchedCompetitors(new Set(ids))
  }

  function markAlertRead(alertId) {
    setReadAlerts((prev) => new Set([...prev, alertId]))
  }

  function markAlertUnread(alertId) {
    setReadAlerts((prev) => {
      const next = new Set(prev)
      next.delete(alertId)
      return next
    })
  }

  function markAllRead() {
    analytics.alerts_marked_all_read(alertsData.length)
    setReadAlerts(new Set(alertsData.map((a) => a.id)))
  }

  function openAskModal(source) {
    const entry = { source, timestamp: new Date().toISOString() }
    setAiClickLog((prev) => [...prev, entry])
    setAskModal({ open: true, source })
  }

  function closeAskModal() {
    setAskModal({ open: false, source: null })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const unreadCount = alertsData.filter((a) => !readAlerts.has(a.id)).length

  return (
    <AppContext.Provider
      value={{
        watchedCompetitors,
        toggleWatch,
        readAlerts,
        markAlertRead,
        markAlertUnread,
        markAllRead,
        unreadCount,
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
