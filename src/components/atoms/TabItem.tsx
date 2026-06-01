/**
 * TabItem.tsx — Ariya v2 atom
 * Figma node: 1689:11046
 *
 * Exports two components:
 *   TabList  — role="tablist" container with keyboard navigation
 *   TabPanel — role="tabpanel" content region (lightweight wrapper)
 *
 * Tab anatomy:
 *   Active:   border-bottom 4 px --blue-primary, label --blue-primary,
 *             count badge rgba(42,118,244,0.15) bg / --blue-primary text
 *   Inactive: no border, label --font-primary,
 *             count badge rgba(112,128,144,0.3) bg / --font-primary text
 *
 * Gap between tabs: 12 px (--gap-sm)
 * Tab padding: 12 px H / 6 px V
 * Container bottom border: 1 px solid var(--blue-light)
 * Count badge: Satoshi Medium 12 px, border-radius 4 px (--radius-xxs), tabular-nums
 *
 * ARIA pattern (WCAG 2.2 §3.5, APG Tabs):
 *   role="tablist" on container
 *   role="tab"     on each tab, aria-selected, aria-controls → panel id
 *   role="tabpanel" on content, aria-labelledby → tab id
 *
 * Keyboard:
 *   Tab      → enters tablist at active tab (roving tabindex: active=0, rest=-1)
 *   ← / →   → move between tabs (loops)
 *   Home     → jump to first tab
 *   End      → jump to last tab
 *
 * Rules:
 *   - No raw hex — colours via CSS custom property or RGBA exemption.
 *   - font-variant-numeric: tabular-nums on count badge.
 *   - No console.log.
 */

import {
  forwardRef,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

// ── Shared tab definition ─────────────────────────────────────────────────────
export interface TabDef {
  id: string
  label: string
  /** Optional numeric badge (e.g. alert count). Renders as tabular-nums. */
  count?: number
  /** ID of the tabpanel this tab controls */
  panelId: string
}

// ── TabList ───────────────────────────────────────────────────────────────────
export interface TabListProps {
  tabs: TabDef[]
  activeId: string
  onSelect: (id: string) => void
  className?: string
  style?: CSSProperties
}

export function TabList({ tabs, activeId, onSelect, className, style }: TabListProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>, index: number) {
    const count = tabs.length
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (index + 1) % count
      tabRefs.current[next]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (index - 1 + count) % count
      tabRefs.current[prev]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      tabRefs.current[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      tabRefs.current[count - 1]?.focus()
    }
  }

  return (
    <div
      role="tablist"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 'var(--gap-sm)',            // 12 px
        borderBottom: '1px solid var(--blue-light)',
        ...style,
      }}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeId
        return (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={isActive}
            onSelect={onSelect}
            onKeyDown={(e) => handleKeyDown(e, i)}
            ref={(el) => { tabRefs.current[i] = el }}
            // Roving tabindex: only active tab is keyboard-reachable via Tab key
            tabIndex={isActive ? 0 : -1}
          />
        )
      })}
    </div>
  )
}

// ── TabButton (internal) ──────────────────────────────────────────────────────
interface TabButtonProps {
  tab: TabDef
  isActive: boolean
  onSelect: (id: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
  tabIndex: number
}

const TabButton = forwardRef<HTMLButtonElement, TabButtonProps>(
  function TabButton({ tab, isActive, onSelect, onKeyDown, tabIndex }, ref) {
    // Active styles
    const borderBottom = isActive
      ? '4px solid var(--blue-primary)'
      : '4px solid transparent'
    const labelColor = isActive ? 'var(--blue-primary)' : 'var(--font-primary)'

    // Count badge
    const badgeBg = isActive
      ? 'rgba(42,118,244,0.15)'     // RGBA exempt
      : 'rgba(112,128,144,0.3)'     // RGBA exempt (--scrim)
    const badgeColor = isActive ? 'var(--blue-primary)' : 'var(--font-primary)'

    return (
      <button
        ref={ref}
        role="tab"
        id={`tab-${tab.id}`}
        aria-selected={isActive}
        aria-controls={tab.panelId}
        tabIndex={tabIndex}
        onClick={() => onSelect(tab.id)}
        onKeyDown={onKeyDown}
        // ariya-focus drives :focus-visible ring (see index.css)
        className="ariya-focus"
        style={{
          // Reset
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'none',
          padding: '6px 12px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          // Typography: Satoshi Regular 14 px
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 'var(--lh-body)',
          color: labelColor,
          border: 'none',
          // Bottom border for active indicator (inside the borderBottom container)
          borderBottom,
          // No outline — ariya-focus handles :focus-visible
          outline: 'none',
          // Align tab bottom to overlap container border
          marginBottom: '-1px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-xxs)',   // 6 px
          transition: 'color 120ms ease, border-color 120ms ease',
          whiteSpace: 'nowrap',
        }}
      >
        {tab.label}

        {tab.count !== undefined && (
          <span
            aria-label={`${tab.count} items`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 4px',
              borderRadius: 'var(--radius-xxs)',   // 4 px
              background: badgeBg,
              color: badgeColor,
              // Satoshi Medium 12 px, tabular-nums (spec requirement)
              fontSize: 'var(--text-sub)',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {tab.count}
          </span>
        )}
      </button>
    )
  }
)

// ── TabPanel ──────────────────────────────────────────────────────────────────
export interface TabPanelProps {
  id: string
  /** ID of the tab that labels this panel */
  labelledBy: string
  /** Hidden from screen readers when not active */
  hidden?: boolean
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function TabPanel({
  id,
  labelledBy,
  hidden = false,
  children,
  className,
  style,
}: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={`tab-${labelledBy}`}
      hidden={hidden}
      tabIndex={0}
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}
