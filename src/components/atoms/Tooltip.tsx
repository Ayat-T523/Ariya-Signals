/**
 * Tooltip.tsx — Ariya v2 atom
 * Figma nodes:
 *   Standard tooltip  → 1689:11098
 *   Citation tooltip  → 1689:11090
 *   General tooltip   → 1689:11098 (overflow variant)
 *
 * Exports three components:
 *   StandardTooltip  — hover + focus trigger, role="tooltip", 118 px wide
 *   CitationTooltip  — click trigger, role="dialog", 258 px wide, pagination
 *   GeneralTooltip   — click on "+N more" trigger, table cell overflow only
 *
 * ── Standard Tooltip ─────────────────────────────────────────────────────────
 *   Width: 118 px (content inner 112 px)
 *   Trigger: hover + :focus-visible
 *   Dismiss: mouseout + blur
 *   Arrow variants: none | up | down | left | right | left-down | right-down
 *   Shadow: drop-shadow(0px 12px 8px rgba(10,13,18,0.08)) drop-shadow(...)
 *   Radius: var(--radius-sm) = 8 px
 *
 * ⚠️  STANDARD TOOLTIP FONT FLAG:
 *   Figma spec: Inter Semi Bold 12px/18px, #414651.
 *   Inter is not the Ariya design system font — only this one Figma component
 *   was confirmed to use Inter. Using Satoshi in this build.
 *   Flag for design system alignment: Standard tooltip should specify Satoshi.
 *
 * ── Citation Tooltip ─────────────────────────────────────────────────────────
 *   Width: 258 px
 *   Trigger: click (NOT hover)
 *   Dismiss: outside click or Escape
 *   Role: role="dialog" (not role="tooltip" — it is interactive / paginated)
 *   Typography: BR Segma Regular 12 px (title quote), 10 px (attribution)
 *   Pagination: dots 8×8 px, 4 px radius. Active #6161FF, Inactive #C2DBFF
 *   Shadow: 0px 1px 3px rgba(10,13,18,0.1) + 0px-spread #f4ebff purple ring
 *   Radius: var(--radius-sm) = 8 px
 *   Design-system cross-cutting rule: Citation chip and Citation Tooltip are
 *   always paired — Citation tooltip must never be rendered without a chip.
 *
 * ── General Tooltip ──────────────────────────────────────────────────────────
 *   Width: 175 px
 *   Border: 1 px solid var(--blue-light) = #C2DBFF
 *   Trigger: click on "+N more" button
 *   Dismiss: outside click or Escape
 *   Use ONLY for table cell overflow — not general content.
 *
 * Rules:
 *   - No raw hex — colours via CSS custom property or RGBA exemption.
 *   - No console.log.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ══════════════════════════════════════════════════════════════════════════════
// STANDARD TOOLTIP
// ══════════════════════════════════════════════════════════════════════════════

export type TooltipArrow = 'none' | 'up' | 'down' | 'left' | 'right' | 'left-down' | 'right-down'
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

// Arrow CSS per direction — rendered as a small CSS triangle on the tooltip box
const ARROW_STYLES: Record<TooltipArrow, CSSProperties | null> = {
  none: null,
  up: {
    position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
    borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
    borderBottom: '6px solid var(--font-bold)',
  },
  down: {
    position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
    borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
    borderTop: '6px solid var(--font-bold)',
  },
  left: {
    position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
    borderRight: '6px solid var(--font-bold)',
  },
  right: {
    position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
    borderLeft: '6px solid var(--font-bold)',
  },
  'left-down': {
    position: 'absolute', left: -6, bottom: 8,
    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
    borderRight: '6px solid var(--font-bold)',
  },
  'right-down': {
    position: 'absolute', right: -6, bottom: 8,
    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
    borderLeft: '6px solid var(--font-bold)',
  },
}

export interface StandardTooltipProps {
  /** Tooltip text content */
  content: string
  /** The element that triggers the tooltip on hover/focus */
  children: ReactElement
  arrow?: TooltipArrow
  placement?: TooltipPlacement
  /** Unique id — auto-generated if omitted */
  id?: string
}

let _tooltipIdCounter = 0

export function StandardTooltip({
  content,
  children,
  arrow = 'none',
  placement = 'top',
  id: idProp,
}: StandardTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLElement>(null)
  const tooltipId = useRef(idProp ?? `ariya-tooltip-${++_tooltipIdCounter}`).current

  function updatePosition() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const TW = 118 // tooltip width
    const PAD = 8  // gap from trigger

    switch (placement) {
      case 'top':
        setPosition({ top: rect.top + scrollY - PAD - 36, left: rect.left + scrollX + rect.width / 2 - TW / 2 })
        break
      case 'bottom':
        setPosition({ top: rect.bottom + scrollY + PAD, left: rect.left + scrollX + rect.width / 2 - TW / 2 })
        break
      case 'left':
        setPosition({ top: rect.top + scrollY + rect.height / 2 - 18, left: rect.left + scrollX - TW - PAD })
        break
      case 'right':
        setPosition({ top: rect.top + scrollY + rect.height / 2 - 18, left: rect.right + scrollX + PAD })
        break
    }
  }

  function show() {
    updatePosition()
    setVisible(true)
  }
  function hide() { setVisible(false) }

  const arrowStyle = ARROW_STYLES[arrow]

  // Clone child to inject aria-describedby + event handlers
  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    'aria-describedby': tooltipId,
    onMouseEnter: (e: MouseEvent) => {
      show()
      children.props.onMouseEnter?.(e)
    },
    onMouseLeave: (e: MouseEvent) => {
      hide()
      children.props.onMouseLeave?.(e)
    },
    onFocus: (e: FocusEvent) => {
      show()
      children.props.onFocus?.(e)
    },
    onBlur: (e: FocusEvent) => {
      hide()
      children.props.onBlur?.(e)
    },
  })

  return (
    <>
      {trigger}
      {visible &&
        createPortal(
          <div
            role="tooltip"
            id={tooltipId}
            style={{
              position: 'absolute',
              top: position.top,
              left: position.left,
              zIndex: 9999,
              width: 118,
              padding: '6px 8px',
              background: 'var(--font-bold)',  // dark bg per Figma
              borderRadius: 'var(--radius-sm)',
              // ⚠️ FONT FLAG: Figma spec uses Inter Semi Bold 12 px / 18 px.
              // Inter is not the Ariya design system typeface. Using Satoshi.
              // Flag for design system alignment.
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 600,
              lineHeight: '18px',
              color: 'var(--bg-1)',
              // Shadow from Figma (RGBA exempt)
              filter:
                'drop-shadow(0px 12px 8px rgba(10,13,18,0.08)) drop-shadow(0px 4px 3px rgba(10,13,18,0.03))',
              pointerEvents: 'none',
            }}
          >
            {arrowStyle && <span aria-hidden="true" style={arrowStyle} />}
            {content}
          </div>,
          document.body
        )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CITATION TOOLTIP
// ══════════════════════════════════════════════════════════════════════════════

export interface CitationSource {
  /** Short source title — truncated to fit 258 px */
  title: string
  /** Optional attribution: "Author, Journal, Year" */
  attribution?: string
}

export interface CitationTooltipProps {
  sources: CitationSource[]
  /** The element that triggers the tooltip on click */
  children: ReactElement
  /** Called when the tooltip is closed */
  onClose?: () => void
  /** Unique id — auto-generated if omitted */
  id?: string
}

let _citationIdCounter = 0

export function CitationTooltip({
  sources,
  children,
  onClose,
  id: idProp,
}: CitationTooltipProps) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dialogId = useRef(idProp ?? `ariya-citation-${++_citationIdCounter}`).current

  function updatePosition() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
    })
  }

  function toggle() {
    if (open) {
      close()
    } else {
      updatePosition()
      setOpen(true)
      setPage(0)
    }
  }

  const close = useCallback(() => {
    setOpen(false)
    onClose?.()
  }, [onClose])

  // Dismiss on outside click or Escape
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, close])

  // Move focus into dialog when it opens
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [open])

  const hasMultiple = sources.length > 1
  const current = sources[page] ?? sources[0]

  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    'aria-expanded': open,
    'aria-controls': open ? dialogId : undefined,
    onClick: (e: MouseEvent) => {
      toggle()
      children.props.onClick?.(e)
    },
  })

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={dialogRef}
            role="dialog"
            id={dialogId}
            aria-label={`Citation source${sources.length > 1 ? 's' : ''}`}
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: position.top,
              left: position.left,
              zIndex: 9999,
              width: 258,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-1)',
              // Purple focus-ring shadow from Figma (RGBA exempt)
              boxShadow:
                '0px 1px 3px rgba(10,13,18,0.1), 0px 1px 2px rgba(10,13,18,0.06), 0 0 0 3px var(--purple-50)',
              outline: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Source content */}
            <div style={{ padding: '12px 16px' }}>
              {/* Title — Figma: BR Segma Regular 12 px. Using Satoshi in build. */}
              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: '12px',
                  fontWeight: 400,
                  lineHeight: '18px',
                  color: 'var(--font-bold)',
                  wordBreak: 'break-word',
                }}
              >
                "{current.title}"
              </p>
              {current.attribution && (
                /* Attribution — Figma: BR Segma Regular 10 px */
                <p
                  style={{
                    margin: 0,
                    fontSize: '10px',
                    fontWeight: 400,
                    lineHeight: '14px',
                    color: 'var(--font-secondary)',
                  }}
                >
                  {current.attribution}
                </p>
              )}
            </div>

            {/* Pagination (only when multiple sources) */}
            {hasMultiple && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                {/* Prev */}
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous source"
                  className="ariya-focus"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: page === 0 ? 'default' : 'pointer',
                    opacity: page === 0 ? 0.3 : 1,
                    color: 'var(--font-secondary)',
                    display: 'flex',
                    padding: 4,
                    borderRadius: 'var(--radius-xxs)',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                {/* Pagination dots */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {sources.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      aria-label={`Source ${i + 1} of ${sources.length}`}
                      aria-current={i === page ? 'true' : undefined}
                      className="ariya-focus"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 'var(--radius-xxs)',   // 4 px per Figma
                        // ⚠️ FLAG: #6161FF (active dot) and #C2DBFF (inactive dot) are
                        // Figma-specified values not yet in the token system.
                        // Active  → needs Colors/Purple/Citation/Active token
                        // Inactive → needs Colors/Purple/Citation/Inactive token
                        background: i === page ? '#6161FF' : '#C2DBFF',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>

                {/* Next */}
                <button
                  onClick={() => setPage((p) => Math.min(sources.length - 1, p + 1))}
                  disabled={page === sources.length - 1}
                  aria-label="Next source"
                  className="ariya-focus"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: page === sources.length - 1 ? 'default' : 'pointer',
                    opacity: page === sources.length - 1 ? 0.3 : 1,
                    color: 'var(--font-secondary)',
                    display: 'flex',
                    padding: 4,
                    borderRadius: 'var(--radius-xxs)',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERAL TOOLTIP  (table cell overflow — "+N more" trigger)
// ══════════════════════════════════════════════════════════════════════════════

export interface GeneralTooltipProps {
  /** All items in the cell */
  items: string[]
  /** How many items are visible before the "+N more" trigger */
  visibleCount: number
  /** Called when the tooltip is closed */
  onClose?: () => void
}

let _generalIdCounter = 0

export function GeneralTooltip({ items, visibleCount, onClose }: GeneralTooltipProps) {
  const overflowCount = items.length - visibleCount
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dialogId = useRef(`ariya-general-tooltip-${++_generalIdCounter}`).current

  if (overflowCount <= 0) return null

  function updatePosition() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    })
  }

  function toggle() {
    if (open) { setOpen(false); onClose?.() }
    else { updatePosition(); setOpen(true) }
  }

  function close() { setOpen(false); onClose?.() }

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        dialogRef.current && !dialogRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <>
      {/* Trigger: "+N more" button */}
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={toggle}
        className="ariya-focus"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--blue-primary)',
          fontSize: 'var(--text-sub)',
          fontWeight: 500,
          fontFamily: 'inherit',
          padding: '0 2px',
          borderRadius: 'var(--radius-xxs)',
        }}
      >
        +{overflowCount} more
      </button>

      {/* Overflow panel */}
      {open &&
        createPortal(
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-label="Additional items"
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: position.top,
              left: position.left,
              zIndex: 9999,
              width: 175,
              border: '1px solid var(--blue-light)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-1)',
              boxShadow: 'var(--shadow-floating)',
              outline: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Items list — scrollable up to 263 px per Figma */}
            <ul
              style={{
                margin: 0,
                padding: '8px 0',
                listStyle: 'none',
                maxHeight: 263,
                overflowY: 'auto',
              }}
            >
              {items.slice(visibleCount).map((item, i) => (
                <li
                  key={i}
                  style={{
                    padding: '4px 12px',
                    fontSize: 'var(--text-sub)',
                    color: 'var(--font-primary)',
                    lineHeight: '1.5',
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>

            {/* Footer: total count */}
            <div
              style={{
                borderTop: '1px solid var(--blue-light)',
                padding: '6px 12px',
                fontSize: 'var(--text-sub)',
                fontWeight: 500,
                color: 'var(--font-secondary)',
                // tabular-nums on the count per design-system rule
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Total: {items.length}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
