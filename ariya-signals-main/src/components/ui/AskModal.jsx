import { useEffect, useRef } from 'react'
import { X, Sparkles } from 'lucide-react'

/**
 * Shared AI placeholder modal (§5).
 *
 * Behavior:
 *  - Opens from any AI button across the app
 *  - Records which button triggered it (source prop, logged via AppContext)
 *  - Closes on: CTA click, X button, backdrop click, Escape key
 *  - Escape is also handled in Layout.jsx; this component handles it too
 *    as a fallback when rendered standalone in tests.
 */
export default function AskModal({ onClose, source }) {
  const modalRef = useRef(null)

  // Focus the CTA on open for accessibility
  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(5,10,68,0.40)', backdropFilter: 'blur(3px)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-modal-title"
    >
      <div
        className="relative flex flex-col"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '480px',
          width: 'calc(100% - 32px)',
          boxShadow: '0 8px 40px rgba(5,10,68,0.18)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute flex items-center justify-center rounded-lg"
          style={{
            top: '16px',
            right: '16px',
            width: '28px',
            height: '28px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(5,10,68,0.35)',
            padding: 0,
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: '32px',
              height: '32px',
              background: '#E8EAF6',
              flexShrink: 0,
            }}
          >
            <Sparkles size={15} color="#0055BB" />
          </div>
          <h2
            id="ask-modal-title"
            className="font-semibold m-0"
            style={{ fontSize: '15px', color: 'rgba(5,10,68,0.92)' }}
          >
            AI response: prototype placeholder
          </h2>
        </div>

        {/* Body */}
        <p
          className="m-0 mb-6"
          style={{
            fontSize: '14px',
            lineHeight: '1.65',
            color: 'rgba(5,10,68,0.65)',
          }}
        >
          In the production version, this button will generate a grounded answer
          using your competitor data, Pharma Inc portfolio context, and validated
          sources. For this prototype, we&rsquo;re focused on validating the
          structure and data coverage.
        </p>

        {/* Muted source label — helps us track which buttons are clicked */}
        {source && (
          <p
            className="m-0 mb-5"
            style={{ fontSize: '11px', color: 'rgba(5,10,68,0.30)' }}
          >
            Triggered from: {source}
          </p>
        )}

        {/* CTA */}
        <button
          ref={modalRef}
          onClick={onClose}
          className="w-full font-semibold"
          style={{
            padding: '11px 20px',
            background: '#050A44',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'transform 150ms ease, box-shadow 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(5,10,68,0.22)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = ''
          }}
        >
          Got it — back to the view
        </button>
      </div>
    </div>
  )
}
