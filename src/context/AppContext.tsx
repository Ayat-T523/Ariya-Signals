import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import alertsData from '../data/alerts.json'

const AppContext = createContext(null)

// ── Guided tour route plan ──────────────────────────────────────────────────
export const TOUR_ROUTES = [
  '/',                                 // Step 1 — War Room
  '/competitors',                      // Step 2 — Competitors
  '/competitors/pharvaris',            // Step 3 — Competitor profile
  '/intelligence?tab=events',          // Step 4 — Events
  '/intelligence?tab=reports',         // Step 5 — Reports & Earnings
  '/intelligence?tab=market',          // Step 6 — Market Developments
  '/alerts',                           // Step 7 — Alerts
  '/myspace',                          // Step 8 — My Space
]

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
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    return localStorage.getItem('onboardingComplete') === 'true'
  })
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('onboardingComplete') !== 'true'
  })

  // ── User role (Task 6a) ──────────────────────────────────────────────────
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

  function openOnboarding() {
    setShowOnboarding(true)
  }

  function closeOnboarding() {
    setShowOnboarding(false)
  }

  function completeOnboarding(selectedAssets) {
    localStorage.setItem('onboardingComplete', 'true')
    localStorage.setItem('trackedAssets', JSON.stringify(selectedAssets))
    setOnboardingComplete(true)
    setShowOnboarding(false)
  }

  // ── Guided tour ──────────────────────────────────────────────────────────
  const [tourActive, setTourActive] = useState(false)
  const [currentTourStep, setCurrentTourStep] = useState(0)

  function startTour() {
    setTourActive(true)
    setCurrentTourStep(0)
    setShowOnboarding(false)
    navigate(TOUR_ROUTES[0])
  }

  function endTour() {
    setTourActive(false)
    setCurrentTourStep(0)
    setOnboardingComplete(true)
    setShowOnboarding(false)
    try { localStorage.setItem('onboardingComplete', 'true') } catch { /* noop */ }
  }

  function nextTourStep() {
    if (currentTourStep < TOUR_ROUTES.length - 1) {
      const next = currentTourStep + 1
      setCurrentTourStep(next)
      navigate(TOUR_ROUTES[next])
    } else {
      // already on last step: Finish behaviour
      endTour()
      navigate('/')
    }
  }

  function prevTourStep() {
    if (currentTourStep > 0) {
      const prev = currentTourStep - 1
      setCurrentTourStep(prev)
      navigate(TOUR_ROUTES[prev])
    }
  }

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
        unreadCount,
        onboardingComplete,
        showOnboarding,
        openOnboarding,
        closeOnboarding,
        completeOnboarding,
        userRole,
        setUserRole,
        tourActive,
        currentTourStep,
        startTour,
        endTour,
        nextTourStep,
        prevTourStep,
        askModal,
        openAskModal,
        closeAskModal,
        aiClickLog,
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
