/**
 * Loader.tsx — Ariya v2 atom
 * Figma node: 1689:11121
 *
 * 8-tick stepped spinner. One tick active (blue) at a time;
 * the SVG rotates in 45 ° discrete steps via CSS steps(8, end).
 *
 * Sizes (not in Figma variants — specified by design brief):
 *   sm  → 16 × 16 px   (inline / tight contexts)
 *   md  → 24 × 24 px   (card / panel — Figma base size)
 *   lg  → 32 × 32 px   (full-page overlay)
 *
 * Accessibility:
 *   role="status" on wrapper, aria-label for SR announcement.
 *   prefers-reduced-motion: animation paused, static spinner visible.
 *
 * Rules:
 *   - No raw hex — all colours via CSS custom property.
 *   - RGBA strings are exempt per design-system rule.
 *   - No console.log.
 */

import type { CSSProperties } from 'react'

// ── Size map ────────────────────────────────────────────────────────────────
const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = {
  sm: 16,
  md: 24,
  lg: 32,
}

// ── Tick positions (degrees from 12 o'clock, clockwise) ─────────────────────
// Index 0 is the active tick (blue). The SVG rotates so the blue tick appears
// to step clockwise every frame.
const TICK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const

// ── Component ────────────────────────────────────────────────────────────────
export interface LoaderProps {
  /** Visual size variant. Default: 'md' */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Screen-reader announcement text.
   * Provide context-specific label when possible ("Loading search results").
   * Default: 'Loading'
   */
  label?: string
  className?: string
  style?: CSSProperties
}

export default function Loader({
  size = 'md',
  label = 'Loading',
  className,
  style,
}: LoaderProps) {
  const px = SIZE_PX[size]

  return (
    <span
      role="status"
      aria-label={label}
      className={className}
      style={{
        display: 'inline-flex',
        width: px,
        height: px,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* aria-hidden: the role/label on the wrapper handles SR. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={px}
        height={px}
        // CSS class drives the stepped rotation animation (see index.css).
        // prefers-reduced-motion pauses it via .ariya-loader-svg selector.
        className="ariya-loader-svg"
        style={{ display: 'block' }}
      >
        {TICK_ANGLES.map((deg, i) => (
          <rect
            key={deg}
            // Tick geometry at 24 × 24 base:
            //   width  0.923 px  height 6.154 px  centred on x=12, top at y=2
            x="11.538"
            y="2"
            width="0.923"
            height="6.154"
            rx="0.46"
            // Index 0 = active tick = brand blue; all others = muted grey.
            // RGBA string is exempt from the no-raw-hex rule.
            fill={i === 0 ? 'var(--blue-primary)' : 'rgba(112,128,144,0.5)'}
            transform={`rotate(${deg}, 12, 12)`}
          />
        ))}
      </svg>
    </span>
  )
}
