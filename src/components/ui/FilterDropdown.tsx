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

  // Ariya Signals styling: the trigger is a raised neumorphic pill (per fb-btn in
  // docs/design/component-references/Feed Filter Bar.html); the popover is
  // glass chrome (R7) since it's passive/overlay chrome, not workspace
  // content. Logic above (search, draft/apply/clear, click-outside) is
  // unchanged -- only the presentation changed.
  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          padding: '8px 14px', borderRadius: 'var(--r-pill)',
          fontSize: '12px', fontWeight: 600,
          background: 'var(--cream-100)',
          color: isActive ? 'var(--indigo-500)' : 'var(--ink-900)',
          border: 'none', boxShadow: 'var(--neu-raised)',
          cursor: 'pointer', transition: 'box-shadow var(--dur-fast) var(--ease-standard)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span>{label}</span>
        {isActive && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
            background: 'var(--indigo-500)', color: '#fff',
            borderRadius: 'var(--r-pill)', padding: '0 5px',
            minWidth: '17px', height: '17px',
          }}>
            {appliedCount}
          </span>
        )}
        <ChevronDown
          size={13}
          strokeWidth={2}
          style={{
            opacity: 0.75,
            transition: 'transform var(--dur-base) var(--ease-standard)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            minWidth: '280px', maxWidth: '360px',
            background: 'rgba(250,249,246,0.96)',
            backdropFilter: 'blur(20px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
            borderRadius: 'var(--r-md)',
            border: '1px solid rgba(255,255,255,0.55)',
            boxShadow: '0 4px 16px rgba(90,78,58,0.24), 0 1px 4px rgba(90,78,58,0.18)',
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
                  padding: '7px 10px', fontSize: '13px',
                  background: 'var(--cream-50)',
                  boxShadow: 'var(--neu-inset)',
                  border: 'none',
                  borderRadius: 'var(--r-sm)', outline: 'none',
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--ink-900)',
                }}
              />
            </div>
          )}

          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {filteredOpts.length === 0 ? (
              <p style={{ padding: '8px 14px', margin: 0, fontSize: '12px', color: 'var(--ink-500)', fontFamily: 'var(--font-ui)' }}>
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
                      fontSize: '13px', fontFamily: 'var(--font-ui)',
                      color: 'var(--ink-900)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,100,75,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      style={{ accentColor: 'var(--indigo-500)', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-500)',
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
              borderTop: '1px solid var(--cream-300)',
            }}
          >
            <button
              onClick={handleClear}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                fontSize: '12px', color: 'var(--ink-500)',
                fontFamily: 'var(--font-ui)',
                textDecoration: 'underline',
              }}
            >
              Clear
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '6px 14px', borderRadius: 'var(--r-pill)',
                background: 'var(--indigo-500)', color: '#fff',
                border: 'none', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
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
