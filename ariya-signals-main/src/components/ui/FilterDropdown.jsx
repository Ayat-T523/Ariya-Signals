import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Multi-select filter dropdown.
 * Props:
 *   label   — button label (e.g. "Competitor")
 *   options — [{ value, label, count }]
 *   applied — Set<string> of currently-applied values
 *   onApply — (Set<string>) => void; called when the user clicks Apply
 */
export default function FilterDropdown({ label, options, applied, onApply }) {
  const [open, setOpen]   = useState(false)
  const [draft, setDraft] = useState(() => new Set(applied))
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  // Reset draft + query whenever the dropdown opens
  useEffect(() => {
    if (open) {
      setDraft(new Set(applied))
      setQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Click outside closes (without applying)
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const appliedCount = applied.size
  const isActive     = appliedCount > 0
  const showSearch   = options.length > 4
  const filteredOpts = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(value) {
    const next = new Set(draft)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setDraft(next)
  }

  function handleApply() {
    onApply(new Set(draft))
    setOpen(false)
  }

  function handleClear() {
    setDraft(new Set())
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '9999px',
          fontSize: '13px', fontWeight: isActive ? 700 : 500,
          background: isActive ? '#050A44' : 'transparent',
          color: isActive ? '#FFFFFF' : 'rgba(5,10,68,0.65)',
          border: `1.5px solid ${isActive ? '#050A44' : 'rgba(5,10,68,0.15)'}`,
          cursor: 'pointer', transition: 'all 120ms ease',
          fontFamily: 'inherit',
        }}
      >
        <span>{label}</span>
        {isActive && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700,
            background: 'rgba(255,255,255,0.25)', color: '#FFFFFF',
            borderRadius: '9999px', padding: '0 6px',
            minWidth: '18px', height: '17px',
          }}>
            {appliedCount}
          </span>
        )}
        <ChevronDown
          size={13}
          strokeWidth={2}
          style={{
            opacity: 0.75,
            transition: 'transform 150ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            minWidth: '280px', maxWidth: '360px',
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid rgba(5,10,68,0.10)',
            boxShadow: '0 8px 28px rgba(5,10,68,0.15)',
            zIndex: 50,
            padding: '12px 0 8px',
          }}
        >
          {showSearch && (
            <div style={{ padding: '0 12px 10px' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter ${label.toLowerCase()}...`}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '6px 10px', fontSize: '13px',
                  border: '1px solid rgba(5,10,68,0.15)',
                  borderRadius: '6px', outline: 'none',
                  fontFamily: 'inherit',
                  color: 'rgba(5,10,68,0.85)',
                }}
              />
            </div>
          )}

          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {filteredOpts.length === 0 ? (
              <p style={{ padding: '8px 14px', margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>
                No matches.
              </p>
            ) : (
              filteredOpts.map((opt) => {
                const checked = draft.has(opt.value)
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '6px 14px',
                      fontSize: '13px',
                      color: 'rgba(5,10,68,0.85)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(5,10,68,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      style={{ accentColor: '#050A44', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    <span style={{
                      fontSize: '11px', color: 'rgba(5,10,68,0.40)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {opt.count}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 14px 4px',
              marginTop: '4px',
              borderTop: '1px solid rgba(5,10,68,0.08)',
            }}
          >
            <button
              onClick={handleClear}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                fontSize: '12px', color: 'rgba(5,10,68,0.50)',
                fontFamily: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Clear
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '5px 14px', borderRadius: '9999px',
                background: '#050A44', color: '#FFFFFF',
                border: 'none', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
