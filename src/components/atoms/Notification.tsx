/**
 * Notification.tsx — Ariya v2 atom
 * Figma node: 1689:11460
 *
 * Exports:
 *   Callout  — inline contextual notification (5 variants)
 *   Toast    — ephemeral floating notification (2 variants)
 *
 * ── Callout variants ──────────────────────────────────────────────────────────
 *   default           → blue tint, role="status"
 *   default-buttons   → blue tint + primary + tertiary CTA buttons, role="status" / "alert"
 *   amber             → amber tint, role="status"
 *   green             → green tint, role="status"
 *   error             → red tint, role="alert" (assertive — errors requiring action)
 *
 * Callout container: padding 8 px (--gap-sm), border-radius 12 px (--radius-md), fluid width
 *
 * ⚠️  AMBER TEXT COLOUR FLAG:
 *   Figma spec: #966820. This is NOT a named design system token.
 *   Used directly here. Flag for design system update:
 *   needs Colors/Status/Amber/Text token → var(--status-amber-text)
 *
 * ⚠️  SATOSHI LIGHT FLAG:
 *   Figma body weight = Satoshi Light. Not in the design system type scale.
 *   Using fontWeight 300 here (matches Light). Flag for design system update:
 *   needs a --text-body-light weight token.
 *
 * ── Toast variants ────────────────────────────────────────────────────────────
 *   success → dark bg (#060E1E / --dark-blue-600), white text, auto-dismiss
 *   error   → NEVER auto-dismiss (errors require user action — use Callout Error instead)
 *             NOTE: Toasts are success/informational only. Errors → Callout Error.
 *
 * Toast: bg var(--dark-blue-600), text var(--bg-2), role="status", aria-live="polite"
 * Auto-dismiss: 3–5 s configurable. × allows early dismissal.
 * NEVER auto-dismiss errors — use Callout Error.
 *
 * Rules:
 *   - No raw hex — colours via CSS custom property or RGBA exemption.
 *   - No console.log.
 */

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'

// ══════════════════════════════════════════════════════════════════════════════
// CALLOUT
// ══════════════════════════════════════════════════════════════════════════════

export type CalloutVariant = 'default' | 'default-buttons' | 'amber' | 'green' | 'error'

// Callout colour tokens per variant.
// RGBA strings are exempt from the no-raw-hex rule.
const CALLOUT_TOKENS: Record<
  CalloutVariant,
  { bg: string; border: string; color: string; role: 'status' | 'alert' }
> = {
  default: {
    bg:     'rgba(42,118,244,0.15)',
    border: '1px solid var(--blue-500)',
    color:  'var(--blue-primary)',
    role:   'status',
  },
  'default-buttons': {
    bg:     'rgba(42,118,244,0.15)',
    border: '1px solid var(--blue-500)',
    color:  'var(--blue-primary)',
    role:   'status',
  },
  amber: {
    bg:     'rgba(250,174,54,0.15)',
    border: '1px solid rgba(250,174,54,0.3)',
    // ⚠️ FLAG: #966820 is not a named design system token.
    // Used directly — flag for design system update.
    // Target token: Colors/Status/Amber/Text → var(--status-amber-text)
    color:  '#966820',
    role:   'status',
  },
  green: {
    bg:     'rgba(73,160,120,0.15)',
    border: '1px solid rgba(73,160,120,0.3)',
    color:  'var(--status-green)',
    role:   'status',
  },
  error: {
    bg:     'rgba(183,63,84,0.15)',
    border: '1px solid rgba(183,63,84,0.3)',
    color:  'var(--status-red)',
    role:   'alert',
  },
}

export interface CalloutProps {
  variant?: CalloutVariant
  heading?: string
  children: ReactNode
  /** Primary CTA (only relevant for variant="default-buttons") */
  primaryAction?: { label: string; onClick: () => void }
  /** Tertiary CTA (only relevant for variant="default-buttons") */
  secondaryAction?: { label: string; onClick: () => void }
  /**
   * Override the default ARIA role.
   * Use "alert" when the notification is time-sensitive and requires immediate action.
   * Callout Error always uses role="alert" regardless of this prop.
   */
  role?: 'status' | 'alert'
  className?: string
  style?: CSSProperties
}

export function Callout({
  variant = 'default',
  heading,
  children,
  primaryAction,
  secondaryAction,
  role: roleProp,
  className,
  style,
}: CalloutProps) {
  const tokens = CALLOUT_TOKENS[variant]
  // Error callout must always be role="alert" — never override
  const role = variant === 'error' ? 'alert' : (roleProp ?? tokens.role)

  return (
    <div
      role={role}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--gap-xs)',          // 8 px
        padding: 'var(--gap-sm)',      // 12 px
        borderRadius: 'var(--radius-md)',  // 12 px
        background: tokens.bg,
        border: tokens.border,
        color: tokens.color,
        ...style,
      }}
    >
      {heading && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-body-lg)',  // 18 px
            fontWeight: 400,
            lineHeight: 'var(--lh-body-lg)',
          }}
        >
          {heading}
        </p>
      )}

      <div
        style={{
          margin: 0,
          fontSize: 'var(--text-body)',   // 14 px
          // ⚠️ FLAG: Figma uses Satoshi Light (fontWeight 300).
          // Satoshi Light is not in the design system type scale.
          // Flagged for design system update.
          fontWeight: 300,
          lineHeight: 'var(--lh-body)',
          color: tokens.color,
        }}
      >
        {children}
      </div>

      {(primaryAction || secondaryAction) && (
        <div style={{ display: 'flex', gap: 'var(--gap-xs)', flexWrap: 'wrap' }}>
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="ariya-focus"
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-xs)',  // 6 px (Figma CTA inside callout)
                background: tokens.color,
                color: 'var(--bg-1)',
                border: 'none',
                fontSize: 'var(--text-body)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="ariya-focus"
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--radius-xs)',
                background: 'transparent',
                color: 'var(--font-bold)',
                border: 'none',
                fontSize: 'var(--text-body)',
                fontWeight: 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════

export type ToastVariant = 'success' | 'info'
// NOTE: 'error' is intentionally omitted from Toast variants.
// Per Figma spec: NEVER auto-dismiss errors. Errors requiring action → Callout Error.

export interface ToastProps {
  variant?: ToastVariant
  heading?: string
  message: string
  /** Auto-dismiss duration in ms. Range: 3000–5000. Default: 4000. */
  duration?: number
  /** Called when toast is dismissed (auto or manual) */
  onDismiss: () => void
  className?: string
  style?: CSSProperties
}

export function Toast({
  variant = 'success',
  heading,
  message,
  duration = 4000,
  onDismiss,
  className,
  style,
}: ToastProps) {
  // Auto-dismiss after `duration` ms
  useEffect(() => {
    const t = window.setTimeout(onDismiss, Math.max(3000, Math.min(5000, duration)))
    return () => window.clearTimeout(t)
  }, [duration, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      // ariya-toast applies slide-in animation (see index.css)
      className={`ariya-toast${className ? ' ' + className : ''}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--gap-xs)',
        padding: 'var(--gap-sm)',         // 12 px
        borderRadius: 'var(--radius-md)', // 12 px
        // Figma: dark navy bg for toasts regardless of variant
        background: 'var(--dark-blue-600)',
        color: 'var(--bg-2)',             // near-white
        minWidth: 280,
        maxWidth: 400,
        boxShadow: 'var(--shadow-floating)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        {heading && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-body-lg)',
              fontWeight: 400,
              lineHeight: 'var(--lh-body-lg)',
              color: 'var(--bg-2)',
            }}
          >
            {heading}
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-body)',
            fontWeight: 300,  // Satoshi Light — see FLAG in Callout above
            lineHeight: 'var(--lh-body)',
            color: 'var(--bg-2)',
          }}
        >
          {message}
        </p>
      </div>

      {/* Dismiss button — always present, aria-label required (icon-only) */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ariya-focus"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: 24,
          height: 24,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--bg-2)',
          borderRadius: 'var(--radius-xs)',
          padding: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
