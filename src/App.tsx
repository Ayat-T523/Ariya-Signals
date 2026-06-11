import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Loader from './components/atoms/Loader'
import Layout from './components/layout/Layout'
import NotFoundState from './components/ui/NotFoundState'

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

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/"                   element={<WarRoom />} />
                <Route path="/competitors"          element={<Competitors />} />
                <Route path="/competitors/timeline" element={<Navigate to="/competitors" replace />} />
                <Route path="/competitors/:id"      element={<CompetitorProfile />} />
                <Route path="/market-performance"   element={<MarketPerformance />} />
                <Route path="/intelligence"         element={<Portal />} />
                <Route path="/portal"               element={<Navigate to="/intelligence" replace />} />
                <Route path="/pricing"              element={<PricingAndAccess />} />
                <Route path="/alerts"               element={<AlertsPage />} />
                <Route path="/myspace"              element={<MySpace />} />
                <Route path="/myspace/alerts"       element={<MyAlerts />} />
                <Route path="/myspace/documents"    element={<MyDocuments />} />
                <Route path="/ask"                  element={<Ask />} />
                <Route path="/admin"                element={<AdminPage />} />
                <Route path="*"                     element={<NotFoundState />} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppProvider>
    </BrowserRouter>
  )
}
