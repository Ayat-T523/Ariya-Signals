import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { analytics } from './lib/analytics'
import { AppProvider } from './context/AppContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Loader from './components/atoms/Loader'
import Layout from './components/layout/Layout'
import NotFoundState from './components/ui/NotFoundState'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import SignInPage from './pages/SignIn'
import { useAuth } from '@clerk/clerk-react'

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()

// ── Lazy page chunks — each page loads only when first visited ────────────────
const WarRoom           = lazy(() => import('./pages/WarRoom'))
const Competitors       = lazy(() => import('./pages/Competitors'))
const CompetitorProfile = lazy(() => import('./pages/CompetitorProfile'))
const Portal            = lazy(() => import('./pages/Portal'))
const AlertsPage        = lazy(() => import('./pages/AlertsPage'))
const Ask               = lazy(() => import('./pages/Ask'))
const AdminPage         = lazy(() => import('./pages/AdminPage'))
const MarketPerformance = lazy(() => import('./pages/MarketPerformance'))
const PricingAndAccess  = lazy(() => import('./pages/PricingAndAccess'))
const MySpace           = lazy(() => import('./pages/MySpace'))
const MyAlerts          = lazy(() => import('./pages/MyAlerts'))
const MyDocuments       = lazy(() => import('./pages/MyDocuments'))

// ── Per-route document title ──────────────────────────────────────────────────
function RouteTitle({ title }: { title: string }) {
  useDocumentTitle(title)
  return null
}

// ── PostHog page-view tracker + session-route persistence ─────────────────────
function PostHogPageTracker() {
  const location = useLocation()
  const prevPathRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    analytics.page_viewed(location.pathname, prevPathRef.current)
    prevPathRef.current = location.pathname
    sessionStorage.setItem('ariya-last-route', location.pathname)
  }, [location.pathname])
  return null
}

// ── Full-page loading fallback ────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
    }}>
      <Loader size="lg" label="Loading page…" />
    </div>
  )
}

// ── Auth guard ────────────────────────────────────────────────────────────────
// ClerkAuthGuard uses useAuth() — only rendered when ClerkProvider is in the tree.
// AuthGuard passes through without Clerk so local dev works without credentials.
function ClerkAuthGuard() {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return <PageLoader />
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return <Outlet />
}

function AuthGuard() {
  if (!CLERK_CONFIGURED) return <Outlet />
  return <ClerkAuthGuard />
}

// ── Resets onboarding when a new Clerk user signs in ─────────────────────────
function ClerkOnboardingSyncInner() {
  const { userId } = useAuth()
  useEffect(() => {
    if (!userId) return
    const lastId = localStorage.getItem('ariya-last-clerk-user')
    if (lastId !== userId) {
      localStorage.removeItem('onboardingComplete')
      localStorage.setItem('ariya-last-clerk-user', userId)
    }
  }, [userId])
  return null
}

function ClerkOnboardingSync() {
  if (!CLERK_CONFIGURED) return null
  return <ClerkOnboardingSyncInner />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <PostHogPageTracker />
      <AppProvider>
        <ClerkOnboardingSync />
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public — sign-in page (Clerk handles its own sub-routing with /*) */}
              <Route path="/sign-in/*" element={<SignInPage />} />

              {/* Protected — all app routes require sign-in when Clerk is active */}
              <Route element={<AuthGuard />}>
                <Route element={<Layout />}>
                  <Route path="/"                   element={<><RouteTitle title="War Room" /><WarRoom /></>} />
                  <Route path="/competitors"          element={<><RouteTitle title="Competitors" /><Competitors /></>} />
                  <Route path="/competitors/timeline" element={<Navigate to="/competitors" replace />} />
                  <Route path="/competitors/:id"      element={<CompetitorProfile />} />
                  <Route path="/market-performance"   element={<><RouteTitle title="Market Performance" /><MarketPerformance /></>} />
                  <Route path="/intelligence"         element={<><RouteTitle title="Intelligence Feed" /><Portal /></>} />
                  <Route path="/portal"               element={<Navigate to="/intelligence" replace />} />
                  <Route path="/pricing"              element={<><RouteTitle title="Pricing & Access" /><PricingAndAccess /></>} />
                  <Route path="/alerts"               element={<><RouteTitle title="Alerts" /><AlertsPage /></>} />
                  <Route path="/myspace"              element={<><RouteTitle title="My Space" /><MySpace /></>} />
                  <Route path="/myspace/alerts"       element={<><RouteTitle title="Alert Preferences" /><MyAlerts /></>} />
                  <Route path="/myspace/documents"    element={<><RouteTitle title="My Documents" /><MyDocuments /></>} />
                  <Route path="/ask"                  element={<><RouteTitle title="Ask Ariya" /><Ask /></>} />
                  <Route path="/admin"                element={<><RouteTitle title="Admin" /><AdminPage /></>} />
                  <Route path="*"                     element={<NotFoundState />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppProvider>
    </BrowserRouter>
  )
}
