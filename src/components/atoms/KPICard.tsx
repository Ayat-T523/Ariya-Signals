/**
 * KPICard.tsx — Ariya v2 atom
 * Figma node: 1689:11125
 *
 * Anatomy:
 *   [Leading icon]  [numeral]  [delta badge]
 *                   [label]
 *                   [period]
 *
 * Specs:
 *   Card bg:     var(--bg-2) = #f4f8fe
 *   Card border: 1 px solid var(--blue-500) = #629AF8
 *   Border-radius: var(--radius-lg) = 16 px
 *   Padding: var(--gap-xs) = 8 px
 *   Gap (icon ↔ content): 8 px
 *
 *   numeral:  Satoshi Medium 20 px, lh 21.6 px, --font-primary, tabular-nums (required)
 *   label:    Satoshi Regular 12 px, --font-primary
 *   period:   Satoshi Medium 12 px, --font-secondary ("vs. last 30 days")
 *
 * Delta badge colours:
 *   Green  → rgba(73,160,120,0.15) bg,  #49a078 text  (var(--status-green))
 *   Red    → rgba(183,63,84,0.15)  bg,  #b73f54 text  (var(--status-red))
 *   Neutral → rgba(112,128,144,0.15) bg, var(--font-primary) text
 *   Radius: var(--radius-sm) = 8 px
 *
 * Rules:
 *   - NEVER render without a delta (prop is required).
 *   - Icon-only not permitted — always render label.
 *   - font-variant-numeric: tabular-nums on numeral.
 *   - --status-yellow: fill/background only, never text.
 *   - No raw hex — colours via CSS custom property or RGBA exemption.
 *   - No console.log.
 */

import type { CSSProperties, ReactNode } from 'react'
import { BookOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ── Delta direction ───────────────────────────────────────────────────────────
export type DeltaDirection = 'up' | 'down' | 'neutral'

// Delta badge token sets
const DELTA_TOKENS: Record<
  DeltaDirection,
  { bg: string; color: string }
> = {
  up:      { bg: 'rgba(73,160,120,0.15)',  color: 'var(--status-green)' },
  down:    { bg: 'rgba(183,63,84,0.15)',   color: 'var(--status-red)'   },
  neutral: { bg: 'rgba(112,128,144,0.15)', color: 'var(--font-primary)' },
}

// Delta arrow icon mapping — RGBA strings are exempt from no-raw-hex rule
function DeltaIcon({ direction, size = 12 }: { direction: DeltaDirection; size?: number }) {
  const color = DELTA_TOKENS[direction].color
  if (direction === 'up')      return <TrendingUp  size={size} color={color} aria-hidden="true" />
  if (direction === 'down')    return <TrendingDown size={size} color={color} aria-hidden="true" />
  return <Minus size={size} color={color} aria-hidden="true" />
}

// ── Component ────────────────────────────────────────────────────────────────
export interface KPICardProps {
  /** Metric name — always required (icon-only KPIs are not permitted) */
  label: string
  /** Formatted value string, e.g. "1,240" or "87%" */
  value: string | number
  /**
   * Delta badge — REQUIRED per Figma spec: never render without a delta.
   * value: formatted change string, e.g. "+12%" or "−3.1%"
   * direction: drives colour and icon
   * ariaLabel: screen-reader label e.g. "Up 12% vs last 30 days"
   */
  delta: {
    value: string
    direction: DeltaDirection
    ariaLabel?: string
  }
  /** Comparison period label. Default: "vs. last 30 days" */
  period?: string
  /**
   * Leading icon. Defaults to BookOpen (Figma default).
   * Pass a custom lucide-react element if needed.
   */
  icon?: ReactNode
  className?: string
  style?: CSSProperties
}

export default function KPICard({
  label,
  value,
  delta,
  period = 'vs. last 30 days',
  icon,
  className,
  style,
}: KPICardProps) {
  const dt = DELTA_TOKENS[delta.direction]

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--gap-xs)',             // 8 px — icon ↔ content gap
        padding: 'var(--gap-xs)',         // 8 px all sides
        background: 'var(--bg-2)',
        border: '1px solid var(--blue-500)',
        borderRadius: 'var(--radius-lg)', // 16 px
        ...style,
      }}
    >
      {/* Leading icon */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: 24,
          height: 24,
          color: 'var(--font-secondary)',
        }}
      >
        {icon ?? <BookOpen size={20} />}
      </span>

      {/* Content column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>

        {/* Numeral row: value + delta badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xxs)' }}>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 500,
              lineHeight: '21.6px',
              color: 'var(--font-primary)',
              // tabular-nums REQUIRED per design system cross-cutting rule
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>

          {/* Delta badge */}
          <span
            aria-label={delta.ariaLabel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '0 var(--padding-xxxs)',   // 0 4 px
              borderRadius: 'var(--radius-sm)',    // 8 px
              background: dt.bg,
              color: dt.color,
              // Satoshi Regular 14 px, tabular-nums
              fontSize: 'var(--text-body)',
              fontWeight: 400,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}
          >
            <DeltaIcon direction={delta.direction} size={12} />
            {delta.value}
          </span>
        </div>

        {/* Metric label */}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sub)',    // 12 px
            fontWeight: 400,
            color: 'var(--font-primary)',
            lineHeight: 1.4,
          }}
        >
          {label}
        </p>

        {/* Comparison period */}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sub)',    // 12 px
            fontWeight: 500,
            color: 'var(--font-secondary)',
            lineHeight: 1.4,
          }}
        >
          {period}
        </p>
      </div>
    </div>
  )
}
