import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { analytics } from './lib/analytics'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import KokonutLoader from './components/kokonutui/loader'
import Layout from './components/layout/Layout'
import NotFoundState from './components/ui/NotFoundState'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import SignInPage from './pages/SignIn'
import SignUpPage from './pages/SignUp'
import ForgotPasswordPage from './pages/ForgotPassword'
import ResetPasswordPage from './pages/ResetPassword'

const SetupPage = lazy(() => import('./pages/setup/SetupPage'))

// ── Lazy page chunks — each page loads only when first visited ────────────────
const WarRoom           = lazy(() => import('./pages/WarRoom'))
const Competitors       = lazy(() => import('./pages/Competitors'))
const CompetitorProfile = lazy(() => import('./pages/CompetitorProfile'))
const Portal            = lazy(() => import('./pages/Portal'))
const AlertsPage        = lazy(() => import('./pages/AlertsPage'))
const Ask               = lazy(() => import('./pages/Ask'))
const AdminPage         = lazy(() => import('./pages/AdminPage'))
const MySpace           = lazy(() => import('./pages/MySpace'))
const MyAlerts          = lazy(() => import('./pages/MyAlerts'))
const MyDocuments       = lazy(() => import('./pages/MyDocuments'))
const DiscoverCompetitors = lazy(() => import('./pages/DiscoverCompetitors'))  // Frontend Step 4 of 7
const SignalsKit        = lazy(() => import('./pages/SignalsKit'))  // Phase 0.4 component-library scratch view

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
      <KokonutLoader size="md" />
    </div>
  )
}

// ── Auth guard ────────────────────────────────────────────────────────────────
// Reads AuthContext (provider-independent), not Supabase directly. Local mode
// grants a session via SignIn's "Enter workspace" button; http mode has no
// working login yet, so isAuthenticated simply never becomes true there.
function AuthGuard() {
  const { isAuthenticated, isLoading, isPasswordRecovery } = useAuth()
  if (isLoading) return <PageLoader />
  // A password-recovery session is real (isAuthenticated is true) but must
  // never reach the workspace -- checked BEFORE the normal isAuthenticated
  // branch so it wins no matter which protected route was requested
  // (checkpoint requirement: "A password-recovery route must not
  // accidentally expose the Ariya workspace").
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (!isAuthenticated) return <Navigate to="/sign-in" replace />
  return <Outlet />
}

// ── Setup guard ───────────────────────────────────────────────────────────────
// A first-time (or reset, or pre-v7) authenticated user is routed to the
// dedicated /setup page instead of the normal workspace. Once setup is
// complete, /setup itself stays reachable (NAV 4 — reopening to edit).
function SetupGuard() {
  const { onboardingComplete, isUserScopeReady } = useApp()
  // Reload-race fix (2026-08-28): onboardingComplete reads the pre-
  // correction default (see AppContextValue.isUserScopeReady's own
  // docstring) until this user's own scoped state has actually landed --
  // deciding on it before then can send an already-onboarded user back to
  // /setup on every reload. Same isLoading-gate pattern AuthGuard already
  // uses above, for the same reason.
  if (!isUserScopeReady) return <PageLoader />
  if (!onboardingComplete) return <Navigate to="/setup" replace />
  return <Outlet />
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
      <AuthProvider>
      <AppProvider>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public — auth routes (V1 final auth requirements checkpoint, 2026-08-27) */}
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/sign-up" element={<SignUpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              {/* Public so an unauthenticated browser following the email link can still reach it -- Supabase's own recovery-link exchange establishes the temporary session client-side. Renders an honest "invalid or expired" state when there is no real recovery session (see ResetPassword.tsx). */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Signals component-library scratch view — public, standalone (no shell/auth) */}
              <Route path="/signals-kit" element={<><RouteTitle title="Signals Kit" /><SignalsKit /></>} />

              {/* Protected — all app routes require an authenticated AuthContext session */}
              <Route element={<AuthGuard />}>
                {/* Dedicated full-page staged setup — no workspace chrome, reachable whether or not setup is complete */}
                <Route path="/setup" element={<><RouteTitle title="Set Up Your Landscape" /><SetupPage /></>} />

                <Route element={<SetupGuard />}>
                <Route element={<Layout />}>
                  <Route path="/"                   element={<><RouteTitle title="War Room" /><WarRoom /></>} />
                  <Route path="/competitors"          element={<><RouteTitle title="Competitors" /><Competitors /></>} />
                  <Route path="/competitors/discover" element={<><RouteTitle title="Discover Competitors" /><DiscoverCompetitors /></>} />
                  <Route path="/competitors/timeline" element={<Navigate to="/competitors" replace />} />
                  <Route path="/competitors/:id"      element={<CompetitorProfile />} />
                  <Route path="/intelligence"         element={<><RouteTitle title="Intelligence Feed" /><Portal /></>} />
                  <Route path="/portal"               element={<Navigate to="/intelligence" replace />} />
                  <Route path="/alerts"               element={<><RouteTitle title="Alerts" /><AlertsPage /></>} />
                  <Route path="/myspace"              element={<><RouteTitle title="My Space" /><MySpace /></>} />
                  <Route path="/myspace/alerts"       element={<><RouteTitle title="Alert Preferences" /><MyAlerts /></>} />
                  <Route path="/myspace/documents"    element={<><RouteTitle title="My Documents" /><MyDocuments /></>} />
                  <Route path="/ask"                  element={<><RouteTitle title="Ask Ariya" /><Ask /></>} />
                  <Route path="/admin"                element={<><RouteTitle title="Admin" /><AdminPage /></>} />
                  <Route path="*"                     element={<NotFoundState />} />
                </Route>
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppProvider>
      </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
