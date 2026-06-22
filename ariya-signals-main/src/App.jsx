import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/layout/Layout'
import WarRoom from './pages/WarRoom'
import Competitors from './pages/Competitors'
import CompetitorProfile from './pages/CompetitorProfile'
import Portal from './pages/Portal'
import AlertsPage from './pages/AlertsPage'
import Ask from './pages/Ask'
import AdminPage from './pages/AdminPage'
import MarketPerformance from './pages/MarketPerformance'
import PricingAndAccess from './pages/PricingAndAccess'
import MySpace from './pages/MySpace'
import MyAlerts from './pages/MyAlerts'
import MyDocuments from './pages/MyDocuments'

function NotFound() {
  return (
    <div style={{ padding: '80px 32px', textAlign: 'center' }}>
      <p style={{ fontSize: '48px', margin: '0 0 12px' }}>404</p>
      <p style={{ fontSize: '16px', color: 'rgba(5,10,68,0.55)', margin: '0 0 20px' }}>
        Page not found.
      </p>
      <Link to="/" style={{ fontSize: '14px', fontWeight: 600, color: '#0055BB', textDecoration: 'none' }}>
        ← Back to War Room
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"                  element={<WarRoom />} />
            <Route path="/competitors"       element={<Competitors />} />
            <Route path="/competitors/:id"   element={<CompetitorProfile />} />
            <Route path="/market-performance" element={<MarketPerformance />} />
            <Route path="/intelligence"      element={<Portal />} />
            <Route path="/portal"            element={<Navigate to="/intelligence" replace />} />
            <Route path="/pricing"           element={<PricingAndAccess />} />
            <Route path="/alerts"            element={<AlertsPage />} />
            <Route path="/myspace"           element={<MySpace />} />
            <Route path="/myspace/alerts"    element={<MyAlerts />} />
            <Route path="/myspace/documents" element={<MyDocuments />} />
            <Route path="/ask"               element={<Ask />} />
            <Route path="/admin"             element={<AdminPage />} />
            <Route path="*"                  element={<NotFound />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
