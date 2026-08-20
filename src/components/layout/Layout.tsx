import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { fadeUp } from '../../lib/motion'
import NavPanel from '../shell/NavPanel'
import TopBar from '../shell/TopBar'
import ContentColumn from '../shell/ContentColumn'
import AskModal from '../ui/AskModal'
import FeedbackWidget from '../ui/FeedbackWidget'
import TourBanner from '../TourBanner'
import { useApp } from '../../context/AppContext'
import { useTour } from '../../hooks/useTour'
import { ErrorBoundary, PageErrorFallback } from '../ErrorBoundary'

export default function Layout() {
  const { askModal, closeAskModal, openAskModal } = useApp()
  useTour()
  const location = useLocation()

  /**
   * Keyboard shortcuts:
   *   /     → open Ask modal (if not already typing in an input)
   *   Esc   → close Ask modal
   */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        openAskModal('keyboard-shortcut-/')
      }
      if (e.key === 'Escape' && askModal.open) {
        closeAskModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [askModal.open, closeAskModal, openAskModal])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--white)' }}>
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
            background: 'var(--neutral-50)',
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

      {/* Ask InForm modal — shared across all pages */}
      <AskModal
        open={askModal.open}
        onOpenChange={(open) => { if (!open) closeAskModal() }}
        source={askModal.source}
        question={askModal.question}
      />

      {/* Feedback pill — fixed bottom-right, all pages */}
      <FeedbackWidget />

      {/* Guided tour banner — fixed bottom, shown during tour */}
      <TourBanner />

    </div>
  )
}
