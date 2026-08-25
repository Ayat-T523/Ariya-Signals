import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { REDUCED_MOTION } from '../../lib/motion'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: number
}

const EASE: [number, number, number, number] = [0.25, 0.0, 0.25, 1.0]

export default function SlideOver({ open, onClose, title, children, width = 480 }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape closes; focus moves into the panel on open (WCAG 2.4.3) and is
  // trapped there while open, matching the pattern already established in
  // NavPanel.tsx's HelpModal -- this drawer previously had neither.
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const el = panelRef.current
      if (!el) return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus() } }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
        >
          {/* Backdrop — fades in/out */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: REDUCED_MOTION ? 0 : 0.15 }}
            onClick={onClose}
            style={{
              position: 'absolute', inset: 0,
              background: 'var(--scrim)',
              backdropFilter: 'blur(3px)',
            }}
          />

          {/* Panel — slides in from right. Glass chrome frame around a cream content layer,
              per the two-layer Ariya Signals rule: chrome is glass, the workspace underneath is
              neumorphic cream (never glass-on-glass, never neumorphic-as-chrome). */}
          <motion.div
            key="panel"
            ref={panelRef}
            tabIndex={-1}
            initial={{ x: REDUCED_MOTION ? 0 : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: REDUCED_MOTION ? 0 : '100%' }}
            transition={{ duration: REDUCED_MOTION ? 0 : 0.22, ease: EASE }}
            style={{
              position: 'relative',
              width: `${width}px`, maxWidth: '100vw',
              height: '100%',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px) saturate(1.1)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
              borderLeft: '1px solid var(--glass-border)',
              boxShadow: 'var(--glass-shadow), -20px 0 48px -12px rgba(20,40,58,0.28)',
              display: 'flex', flexDirection: 'column',
              zIndex: 1,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid var(--glass-border)',
              flexShrink: 0,
            }}>
              <h2 style={{
                margin: 0, fontSize: '16px', fontWeight: 600,
                fontFamily: 'var(--font-display)', color: 'var(--ink-900)',
              }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  width: '28px', height: '28px', borderRadius: 'var(--r-sm)',
                  color: 'var(--ink-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body — cream content layer inside the glass frame */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '24px',
              background: 'var(--cream-100)',
            }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
