import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { analytics } from './lib/analytics'
import { AppProvider, useApp } from './context/AppContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Loader from './components/atoms/Loader'
import Layout from './components/layout/Layout'
import NotFoundState from './components/ui/NotFoundState'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import SignInPage from './pages/SignIn'

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true'

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
const InformKit         = lazy(() => import('./pages/InformKit'))  // Phase 0.4 component-library scratch view

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
function SupabaseAuthGuard() {
  const { authUser, authLoading } = useApp()
  if (authLoading) return <PageLoader />
  if (!authUser) return <Navigate to="/sign-in" replace />
  return <Outlet />
}

function AuthGuard() {
  if (BYPASS_AUTH) return <Outlet />
  return <SupabaseAuthGuard />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  },
})

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <PostHogPageTracker />
      <AppProvider>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public — sign-in page */}
              <Route path="/sign-in" element={<SignInPage />} />

              {/* InForm component-library scratch view — public, standalone (no shell/auth) */}
              <Route path="/inform-kit" element={<><RouteTitle title="InForm Kit" /><InformKit /></>} />

              {/* Protected — all app routes require a Supabase session */}
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
      </QueryClientProvider>
    </BrowserRouter>
  )
}
