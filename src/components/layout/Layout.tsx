import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { fadeUp } from '../../lib/motion'
import NavPanel from '../shell/NavPanel'
import TopBar from '../shell/TopBar'
import ContentColumn from '../shell/ContentColumn'
import FeedbackWidget from '../ui/FeedbackWidget'
import OnboardingModal from '../OnboardingModal'
import TourBanner from '../TourBanner'
import { useApp } from '../../context/AppContext'
import { useTour } from '../../hooks/useTour'
import { ErrorBoundary, PageErrorFallback } from '../ErrorBoundary'

// The "/" keyboard shortcut and its Escape handler lived here to drive the Ask
// modal. Both are removed with the rest of the RAG chat feature (handoff index
// §2, frontend §2). OnboardingModal and TourBanner own their own Escape keys.

export default function Layout() {
  const { showOnboarding } = useApp()
  useTour()
  const location = useLocation()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#152d61' }}>
      {/* Skip to main content — visually hidden until focused (a11y) */}
      <a
        href="#main-content"
        className="ariya-focus"
        style={{
          position: 'absolute', top: '-40px', left: '8px',
          zIndex: 10000,
          padding: '6px 14px', borderRadius: '6px',
          background: '#2A76F4', color: '#fff',
          fontSize: '13px', fontWeight: 600, fontFamily: 'Satoshi, sans-serif',
          textDecoration: 'none',
          transition: 'top 150ms',
        }}
        onFocus={e => { e.currentTarget.style.top = '8px' }}
        onBlur={e => { e.currentTarget.style.top = '-40px' }}
      >
        Skip to content
      </a>

      {/* Nav panel — in-flow so resizing pushes/pulls content column */}
      <NavPanel />

      {/* Main content column — flex:1 so it fills remaining width */}
      <ContentColumn>
        <TopBar />

        {/* Page content — scrollable area */}
        <main
          id="main-content"
          className="flex-1"
          style={{
            background: '#F7F8FC',
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          <ErrorBoundary fallback={<PageErrorFallback />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.key}
                variants={fadeUp}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </ContentColumn>

      {/* Onboarding modal — shown on first visit or triggered from Admin */}
      {showOnboarding && <OnboardingModal />}

      {/* Feedback pill — fixed bottom-right, all pages */}
      <FeedbackWidget />

      {/* Guided tour banner — fixed bottom, shown during tour */}
      <TourBanner />

    </div>
  )
}
