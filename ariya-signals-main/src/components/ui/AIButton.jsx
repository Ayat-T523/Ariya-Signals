import { Sparkles } from 'lucide-react'
import { useApp } from '../../context/AppContext'

/**
 * Shared AI action button (§5, §7.6).
 * Secondary style + blue sparkle icon + optional lavender tint.
 * Every click is logged via AppContext for feedback tracking.
 */
export default function AIButton({ children, source, className = '' }) {
  const { openAskModal } = useApp()

  return (
    <button
      onClick={() => openAskModal(source)}
      className={`flex items-center gap-1.5 font-semibold ${className}`}
      style={{
        padding: '7px 14px',
        background: '#E8EAF6',
        border: '1px solid rgba(5,10,68,0.10)',
        borderRadius: '9999px',
        fontSize: '13px',
        color: '#0055BB',
        cursor: 'pointer',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,85,187,0.12)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <Sparkles size={13} />
      {children}
    </button>
  )
}
