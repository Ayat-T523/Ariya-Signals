import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AskModal from '../ui/AskModal'
import OnboardingModal from '../OnboardingModal'
import GuidedTour from '../GuidedTour'
import { useApp } from '../../context/AppContext'

export default function Layout() {
  const { askModal, closeAskModal, openAskModal, showOnboarding, tourActive } = useApp()

  /**
   * Keyboard shortcuts (§8):
   *   /     → open Ask modal (if not already typing in an input)
   *   Esc   → close Ask modal
   */
  useEffect(() => {
    function handleKeyDown(e) {
      const isTyping =
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable

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
    <div className="flex min-h-screen" style={{ background: '#F7F8FC' }}>
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content: pushed right of sidebar */}
      <div
        className="flex flex-col flex-1 min-h-screen"
        style={{ marginLeft: '240px' }}
      >
        <Header />

        {/* Page content — add bottom padding when guided tour banner is visible */}
        <main className="flex-1" style={{ paddingBottom: tourActive ? '132px' : 0 }}>
          <Outlet />
        </main>
      </div>

      {/* AI placeholder modal — shared across all pages (§5) */}
      {askModal.open && (
        <AskModal onClose={closeAskModal} source={askModal.source} />
      )}

      {/* Onboarding modal — shown on first visit or triggered from Admin */}
      {showOnboarding && <OnboardingModal />}

      {/* Guided tour banner — persistent across pages while active */}
      <GuidedTour />
    </div>
  )
}
