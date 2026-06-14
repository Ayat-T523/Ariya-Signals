import { useEffect } from 'react'
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
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
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
              background: 'rgba(5,10,68,0.35)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel — slides in from right */}
          <motion.div
            key="panel"
            initial={{ x: REDUCED_MOTION ? 0 : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: REDUCED_MOTION ? 0 : '100%' }}
            transition={{ duration: REDUCED_MOTION ? 0 : 0.22, ease: EASE }}
            style={{
              position: 'relative',
              width: `${width}px`, maxWidth: '100vw',
              height: '100%',
              background: '#FFFFFF',
              boxShadow: '-8px 0 40px rgba(5,10,68,0.16)',
              display: 'flex', flexDirection: 'column',
              zIndex: 1,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(5,10,68,0.08)',
              flexShrink: 0,
            }}>
              <h2 style={{
                margin: 0, fontSize: '16px', fontWeight: 600,
                fontFamily: 'Satoshi, sans-serif', color: 'rgba(5,10,68,0.90)',
              }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '6px',
                  color: 'rgba(5,10,68,0.40)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
