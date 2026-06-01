/**
 * Chip.tsx — Ariya v2 atom
 * Figma nodes: 1689:10385 (Standard), 1689:10726 (Status + Citation + Icon+Text)
 *
 * Chip types:
 *   standard      → Default | Secondary | Tertiary | Icon-only | Dismissable
 *   status-filled → Active | Success | Warning | Error | Error-Secondary | Neutral
 *   status-empty  → Active | Success | Warning | Error | Error-Secondary | Neutral | Processing
 *   icon-text     → Active | Success | Warning | Error | Neutral | Processing (Large only)
 *   citation      → Fixed 172 px, click-triggered Citation tooltip
 *
 * ── Radius (atoms.md flag — resolved) ────────────────────────────────────────
 *   Standard / Large:  var(--radius-sm)  = 8 px
 *   Small:             var(--radius-xs)  = 6 px
 *   Citation:          var(--radius-xxs) = 4 px
 *   NEVER use --radius-round (999 px) on any chip variant.
 *   Figma description stated "pill (999)" — resolved: token values are authoritative.
 *
 * ── Status colours — semantic, not decorative ─────────────────────────────────
 *   Active        → #49a078  (solid green Filled / outlined green Empty)
 *   Success       → rgba(73,160,120,0.15) tint Filled / outlined Empty
 *   Warning       → rgba(250,174,54,0.15) tint (--status-yellow fill only)
 *   Error         → #b73f54  (solid red Filled / outlined red Empty)
 *   Error-Sec     → rgba(183,63,84,0.15) tint
 *   Neutral       → rgba(112,128,144,0.15) tint
 *   Processing    → blue tint (available on Empty + Icon+Text only; NOT on Filled)
 *
 * ── Status dot ────────────────────────────────────────────────────────────────
 *   8 × 8 px on all Status chip variants, border-radius 50%
 *
 * ── --status-yellow rule ──────────────────────────────────────────────────────
 *   Warning: fill/background only. Text for Warning uses the amber hex #966820.
 *
 * ⚠️  AMBER TEXT COLOUR FLAG:
 *   Warning chip text: #966820. Not a named design system token.
 *   Used directly — flag for design system update (same flag as Notification).
 *
 * ── Citation chip ─────────────────────────────────────────────────────────────
 *   Fixed 172 px width, Satoshi Medium 12 px, truncated title with ellipsis.
 *   "+N" overflow count shown in brand blue.
 *   Clicking opens Citation Tooltip. These two always paired.
 *   Never render without a valid, retrievable source reference.
 *
 * Rules:
 *   - No raw hex — colours via CSS custom property or RGBA exemption.
 *   - No <div onClick> on interactive chips — use <button> or proper semantics.
 *   - Icon-only always requires aria-label.
 *   - Dismissable × removes the chip — caller manages filter state.
 *   - No console.log.
 */

import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'

// ── Shared types ──────────────────────────────────────────────────────────────
export type ChipSize = 'sm' | 'md' | 'lg'

// Radius token per size (flag resolved)
const RADIUS: Record<ChipSize, string> = {
  sm: 'var(--radius-xs)',  // 6 px
  md: 'var(--radius-sm)',  // 8 px
  lg: 'var(--radius-sm)',  // 8 px
}

// Padding per size
const CHIP_PADDING_H: Record<ChipSize, string> = {
  sm: 'var(--padding-xxs)',  // 6 px
  md: 'var(--padding-xs)',   // 8 px
  lg: 'var(--padding-xs)',   // 8 px
}
const CHIP_PADDING_V: Record<ChipSize, string> = {
  sm: '2px',
  md: '4px',
  lg: '6px',
}

// ── STANDARD CHIP ─────────────────────────────────────────────────────────────
export type StandardCategory = 'default' | 'secondary' | 'tertiary' | 'icon-only' | 'dismissable'

const STD_TOKENS: Record<StandardCategory, { bg: string; border?: string; color: string }> = {
  default:    { bg: 'var(--blue-primary)',         color: 'var(--bg-1)' },
  secondary:  { bg: 'rgba(42,118,244,0.15)',        color: 'var(--blue-primary)' },
  tertiary:   { bg: 'transparent', border: '1px solid var(--blue-primary)', color: 'var(--blue-primary)' },
  'icon-only':{ bg: 'rgba(42,118,244,0.15)',        color: 'var(--blue-primary)' },
  dismissable:{ bg: 'rgba(42,118,244,0.15)',        color: 'var(--blue-primary)' },
}

// Base props for StandardChip
interface StandardChipBaseProps {
  label?: string
  size?: ChipSize
  className?: string
  style?: CSSProperties
}

// Icon-only variant requires aria-label
type IconOnlyChip = StandardChipBaseProps & {
  category: 'icon-only'
  icon: ReactNode
  /** Required — no visible label text present */
  'aria-label': string
  onDismiss?: never
}

// Dismissable variant requires onDismiss
type DismissableChip = StandardChipBaseProps & {
  category: 'dismissable'
  label: string
  icon?: ReactNode
  'aria-label'?: string
  /** Called when the × button is clicked. Caller manages filter state. */
  onDismiss: () => void
}

// All other categories
type OtherStandardChip = StandardChipBaseProps & {
  category?: 'default' | 'secondary' | 'tertiary'
  label: string
  icon?: ReactNode
  'aria-label'?: string
  onDismiss?: never
}

export type StandardChipProps = IconOnlyChip | DismissableChip | OtherStandardChip

export function StandardChip(props: StandardChipProps) {
  const {
    category = 'default',
    size = 'md',
    className,
    style,
    'aria-label': ariaLabel,
  } = props

  const label = (props as OtherStandardChip).label
  const icon = (props as OtherStandardChip).icon ?? null
  const onDismiss = (props as DismissableChip).onDismiss

  const tokens = STD_TOKENS[category]

  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--gap-xxs)',                  // 6 px
    paddingLeft: CHIP_PADDING_H[size],
    paddingRight: category === 'dismissable' ? 'var(--gap-xxs)' : CHIP_PADDING_H[size],
    paddingTop: CHIP_PADDING_V[size],
    paddingBottom: CHIP_PADDING_V[size],
    borderRadius: RADIUS[size],
    background: tokens.bg,
    border: tokens.border ?? 'none',
    color: tokens.color,
    fontSize: 'var(--text-body)',            // Satoshi Regular 14 px
    fontWeight: 400,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    ...style,
  }

  if (category === 'icon-only') {
    return (
      <span
        aria-label={ariaLabel}
        className={className}
        style={{ ...chipStyle, gap: 0, padding: CHIP_PADDING_V[size] + ' ' + CHIP_PADDING_H[size] }}
      >
        {icon && <span aria-hidden="true" style={{ display: 'inline-flex', width: 16, height: 16 }}>{icon}</span>}
      </span>
    )
  }

  return (
    <span className={className} style={chipStyle}>
      {icon && (
        <span aria-hidden="true" style={{ display: 'inline-flex', width: 16, height: 16, flexShrink: 0 }}>
          {icon}
        </span>
      )}

      {label && (
        <span style={{ color: tokens.color }}>{label}</span>
      )}

      {category === 'dismissable' && onDismiss && (
        /* Dismiss button — semantic button with aria-label per WCAG */
        <button
          onClick={onDismiss}
          aria-label={`Remove ${label}`}
          className="ariya-focus"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: tokens.color,
            padding: 0,
            borderRadius: 'var(--radius-xxs)',
          }}
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}

// ── STATUS CHIP ───────────────────────────────────────────────────────────────
export type StatusChipState =
  | 'active' | 'success' | 'warning' | 'error' | 'error-secondary' | 'neutral'
  | 'processing'   // Empty + Icon+Text only

// Filled chip token sets — dot colour matches text/bg for visibility
// ⚠️ Warning text: #966820 — not a named token. See flag above.
// All RGBA strings are exempt from the no-raw-hex rule.
// Solid hex values that have a matching token use the token; exceptions noted.
const FILLED_TOKENS: Record<
  Exclude<StatusChipState, 'processing'>,
  { bg: string; dotColor: string; textColor: string }
> = {
  // Active: solid green bg, white text. --status-green = #49A078.
  active:          { bg: 'var(--status-green)',          dotColor: 'var(--bg-1)',           textColor: 'var(--bg-1)'              },
  success:         { bg: 'rgba(73,160,120,0.15)',         dotColor: 'var(--status-green)',   textColor: 'var(--status-green)'      },
  // Warning: bg tint only. Text = #966820 (not a token — see FLAG above).
  warning:         { bg: 'rgba(250,174,54,0.15)',         dotColor: 'var(--status-yellow)',  textColor: '#966820'                  },
  // Error: solid red bg, white text. --status-red = #B73F54.
  error:           { bg: 'var(--status-red)',             dotColor: 'var(--bg-1)',           textColor: 'var(--bg-1)'              },
  'error-secondary': { bg: 'rgba(183,63,84,0.15)',        dotColor: 'var(--status-red)',     textColor: 'var(--status-red)'        },
  neutral:         { bg: 'rgba(112,128,144,0.15)',         dotColor: 'var(--font-secondary)', textColor: 'var(--font-secondary)'    },
}

// Empty chip token sets — transparent bg + coloured border + coloured text
// All RGBA strings exempt from no-raw-hex rule.
const EMPTY_TOKENS: Record<
  StatusChipState,
  { border: string; dotColor: string; textColor: string }
> = {
  active:          { border: '1px solid var(--status-green)',        dotColor: 'var(--status-green)',   textColor: 'var(--status-green)'    },
  success:         { border: '1px solid rgba(73,160,120,0.4)',       dotColor: 'var(--status-green)',   textColor: 'var(--status-green)'    },
  // Warning text = #966820 (not a token — see FLAG above)
  warning:         { border: '1px solid rgba(250,174,54,0.4)',       dotColor: 'var(--status-yellow)',  textColor: '#966820'                },
  error:           { border: '1px solid rgba(183,63,84,0.5)',        dotColor: 'var(--status-red)',     textColor: 'var(--status-red)'      },
  'error-secondary': { border: '1px solid rgba(183,63,84,0.3)',      dotColor: 'var(--status-red)',     textColor: 'var(--status-red)'      },
  neutral:         { border: '1px solid rgba(112,128,144,0.4)',      dotColor: 'var(--font-secondary)', textColor: 'var(--font-secondary)'  },
  processing:      { border: '1px solid var(--blue-primary)',         dotColor: 'var(--blue-primary)',   textColor: 'var(--blue-primary)'    },
}

// Small dot (8×8 px) for Status chips
function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

export interface StatusChipProps {
  /** "filled" = solid/tinted bg; "empty" = outlined. Processing only on "empty". */
  fill: 'filled' | 'empty'
  state: StatusChipState
  label: string
  size?: ChipSize
  className?: string
  style?: CSSProperties
}

export function StatusChip({
  fill,
  state,
  label,
  size = 'md',
  className,
  style,
}: StatusChipProps) {
  // Processing is not available on Filled — enforce the rule
  if (fill === 'filled' && state === 'processing') {
    // Silently fall back to empty for Processing (design system rule)
    fill = 'empty'
  }

  const radius = RADIUS[size]
  const pH = CHIP_PADDING_H[size]
  const pV = CHIP_PADDING_V[size]

  if (fill === 'filled') {
    const t = FILLED_TOKENS[state as Exclude<StatusChipState, 'processing'>]
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--gap-xs)',
          paddingLeft: pH,
          paddingRight: pH,
          paddingTop: pV,
          paddingBottom: pV,
          borderRadius: radius,
          background: t.bg,
          color: t.textColor,
          fontSize: 'var(--text-body)',
          fontWeight: 400,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        <StatusDot color={t.dotColor} />
        {label}
      </span>
    )
  }

  // Empty (outlined)
  const t = EMPTY_TOKENS[state]
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--gap-xs)',
        paddingLeft: pH,
        paddingRight: pH,
        paddingTop: pV,
        paddingBottom: pV,
        borderRadius: radius,
        background: 'transparent',
        border: t.border,
        color: t.textColor,
        fontSize: 'var(--text-body)',
        fontWeight: 400,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <StatusDot color={t.dotColor} />
      {label}
    </span>
  )
}

// ── ICON + TEXT CHIP ──────────────────────────────────────────────────────────
// Large only. Always outlined. Reserved for prominent callouts / operational states.
// States: active | success | warning | error | neutral | processing

const ICON_TEXT_TOKENS: Record<
  Exclude<StatusChipState, 'error-secondary'>,
  { border: string; dotColor: string; textColor: string }
> = {
  active:     { border: '1px solid var(--status-green)',         dotColor: 'var(--status-green)',   textColor: 'var(--status-green)'   },
  success:    { border: '1px solid rgba(73,160,120,0.4)',        dotColor: 'var(--status-green)',   textColor: 'var(--status-green)'   },
  // Warning text = #966820 (not a token — flagged for design system update)
  warning:    { border: '1px solid rgba(250,174,54,0.4)',        dotColor: 'var(--status-yellow)',  textColor: '#966820'               },
  error:      { border: '1px solid rgba(183,63,84,0.5)',         dotColor: 'var(--status-red)',     textColor: 'var(--status-red)'     },
  neutral:    { border: '1px solid rgba(112,128,144,0.4)',       dotColor: 'var(--font-secondary)', textColor: 'var(--font-secondary)' },
  processing: { border: '1px solid var(--blue-primary)',          dotColor: 'var(--blue-primary)',   textColor: 'var(--blue-primary)'   },
}

export interface IconTextChipProps {
  state: Exclude<StatusChipState, 'error-secondary'>
  label: string
  /** lucide-react icon element — must reinforce semantic meaning */
  icon: ReactNode
  className?: string
  style?: CSSProperties
}

export function IconTextChip({ state, label, icon, className, style }: IconTextChipProps) {
  const t = ICON_TEXT_TOKENS[state]

  return (
    <span
      // Announce icon meaning + label to AT
      aria-label={`${state}: ${label}`}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--gap-xxs)',
        paddingLeft: 'var(--padding-xs)',
        paddingRight: 'var(--padding-xs)',
        paddingTop: 'var(--padding-xxs)',
        paddingBottom: 'var(--padding-xxs)',
        borderRadius: 'var(--radius-sm)',   // Large = 8 px
        background: 'transparent',
        border: t.border,
        color: t.textColor,
        fontSize: 'var(--text-body)',
        fontWeight: 400,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', width: 16, height: 16, flexShrink: 0, color: t.dotColor }}>
        {icon}
      </span>
      {label}
    </span>
  )
}

// ── CITATION CHIP ─────────────────────────────────────────────────────────────
// Fixed 172 px. Always paired with CitationTooltip. Never decorative.

export interface CitationChipProps {
  /** Primary source title — truncated to fit 172 px */
  sourceTitle: string
  /** Total source count. Shows "+N" when > 1 */
  sourceCount: number
  /** Called when chip is clicked — caller opens CitationTooltip */
  onClick: () => void
  className?: string
  style?: CSSProperties
}

export function CitationChip({
  sourceTitle,
  sourceCount,
  onClick,
  className,
  style,
}: CitationChipProps) {
  const overflowCount = sourceCount - 1

  return (
    <button
      onClick={onClick}
      // Announce as button with source info
      aria-label={`Citation: ${sourceTitle}${overflowCount > 0 ? ` and ${overflowCount} more` : ''}`}
      className={`ariya-focus${className ? ' ' + className : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        // Fixed 172 px per Figma spec
        width: 172,
        minWidth: 172,
        maxWidth: 172,
        paddingLeft: 'var(--padding-xs)',
        paddingRight: 'var(--padding-xs)',
        paddingTop: '2px',
        paddingBottom: '2px',
        // Citation chip radius: 4 px (var(--radius-xxs))
        borderRadius: 'var(--radius-xxs)',
        background: 'var(--blue-light)',
        border: '1px solid var(--blue-300)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Truncated source title — Satoshi Medium 12 px */}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 'var(--text-sub)',     // 12 px
          fontWeight: 500,
          color: 'var(--font-bold)',
          minWidth: 0,
        }}
      >
        {sourceTitle}
      </span>

      {/* "+N" overflow count — brand blue, tabular-nums */}
      {overflowCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            fontSize: 'var(--text-sub)',
            fontWeight: 500,
            color: 'var(--blue-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          +{overflowCount}
        </span>
      )}
    </button>
  )
}
