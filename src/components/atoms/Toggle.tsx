/**
 * Toggle.tsx — Ariya v2 atom
 * Figma nodes:
 *   Active Off  → 1689:11129
 *   Active On   → 1689:11128
 *   Disabled Off → 1689:11127
 *   Disabled On  → 1689:11126  (Figma typo: "Dsiabled On" — corrected in code)
 *
 * Track: 32 × 16 px, border-radius: var(--radius-xxlg) = 36 px
 * Thumb: 14 × 14 px, border-radius: var(--radius-round) = 999 px
 *
 * Accessibility:
 *   role="switch"  aria-checked="true|false"
 *   Space or Enter to toggle.
 *   Disabled: button disabled attr removes from tab order.
 *   Focus: 4 px grey ring via ariya-focus class (:focus-visible).
 *
 * Rules:
 *   - No raw hex — colours via CSS custom property or RGBA exemption.
 *   - No <div onClick> — uses <button role="switch">.
 *   - aria-label required (no visible label on this atom).
 *   - No console.log.
 */

import type { CSSProperties } from 'react'

// ── Box-shadow values from Figma ─────────────────────────────────────────────
// RGBA strings are exempt from the no-raw-hex rule.
const TRACK_SHADOW_OFF =
  'inset -0.2px -0.2px 1px rgba(0,0,0,0.12), inset 2px 2px 2px rgba(0,0,0,0.12)'
const TRACK_SHADOW_ON = 'inset 2px 2px 2px rgba(0,0,0,0.25)'
const THUMB_SHADOW =
  '0.5px 1px 1px rgba(0,0,0,0.25), inset 0 0 2px rgba(0,0,0,0.4)'

// ── Component ────────────────────────────────────────────────────────────────
export interface ToggleProps {
  /** Current on/off state */
  checked: boolean
  /** Called when the user toggles the switch */
  onChange: (checked: boolean) => void
  /** Visible label ID that describes this switch (for aria-labelledby), OR
   *  provide aria-label directly when no visible label element exists. */
  'aria-label'?: string
  'aria-labelledby'?: string
  disabled?: boolean
  id?: string
  className?: string
  style?: CSSProperties
}

export default function Toggle({
  checked,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  disabled = false,
  id,
  className,
  style,
}: ToggleProps) {
  function handleClick() {
    if (!disabled) onChange(!checked)
  }

  // Wrapper opacity 0.5 when disabled (matches Figma Disabled Off / Disabled On)
  const wrapperOpacity = disabled ? 0.5 : 1

  // Track background changes between Off (--bg-2) and On (--blue-primary)
  const trackBg = checked ? 'var(--blue-primary)' : 'var(--bg-2)'
  const trackShadow = checked ? TRACK_SHADOW_ON : TRACK_SHADOW_OFF

  // Thumb travels: Off = 1 px from left, On = 32 - 14 - 1 = 17 px from left
  const thumbLeft = checked ? 17 : 1

  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      disabled={disabled}
      onClick={handleClick}
      // ariya-focus drives :focus-visible ring (see index.css)
      className={`ariya-focus${className ? ' ' + className : ''}`}
      style={{
        // Reset button defaults
        appearance: 'none',
        WebkitAppearance: 'none',
        border: 'none',
        background: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--radius-round)',
        opacity: wrapperOpacity,
        // Focus ring from .ariya-focus applies via CSS :focus-visible
        ...style,
      }}
    >
      {/* Track */}
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'block',
          width: 32,
          height: 16,
          borderRadius: 'var(--radius-xxlg)',   // 36 px
          background: trackBg,
          boxShadow: trackShadow,
          transition: 'background 150ms ease, box-shadow 150ms ease',
        }}
      >
        {/* Thumb */}
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: thumbLeft,
            width: 14,
            height: 14,
            borderRadius: 'var(--radius-round)', // 999 px
            background: 'var(--bg-1)',            // white
            boxShadow: THUMB_SHADOW,
            transition: 'left 150ms ease',
          }}
        />
      </span>
    </button>
  )
}
