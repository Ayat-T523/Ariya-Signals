import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { fadeUp } from '../../lib/motion'
import NavPanel from '../shell/NavPanel'
import TopBar from '../shell/TopBar'
import ContentColumn from '../shell/ContentColumn'
import AskModal from '../ui/AskModal'
import FeedbackWidget from '../ui/FeedbackWidget'
import OnboardingModal from '../OnboardingModal'
import { useApp } from '../../context/AppContext'
import { useTour } from '../../hooks/useTour'

export default function Layout() {
  const { askModal, closeAskModal, openAskModal, showOnboarding } = useApp()
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#152d61' }}>
      {/* Nav panel — in-flow so resizing pushes/pulls content column */}
      <NavPanel />

      {/* Main content column — flex:1 so it fills remaining width */}
      <ContentColumn>
        <TopBar />

        {/* Page content — scrollable area */}
        <main
          className="flex-1"
          style={{
            background: 'var(--bg-1)',
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
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
        </main>
      </ContentColumn>

      {/* Ask Ariya modal — shared across all pages */}
      {askModal.open && (
        <AskModal onClose={closeAskModal} source={askModal.source} />
      )}

      {/* Onboarding modal — shown on first visit or triggered from Admin */}
      {showOnboarding && <OnboardingModal />}

      {/* Feedback pill — fixed bottom-right, all pages */}
      <FeedbackWidget />

    </div>
  )
}
