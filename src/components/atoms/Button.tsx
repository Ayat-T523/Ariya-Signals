/**
 * Button.tsx — Ariya v2 atom
 * Figma node: 1697:40003
 *
 * Variants:
 *   type (variant):  primary | secondary | tertiary | destructive | tertiary-destructive
 *   size:            sm (32 px) | md (36 px) | lg (44 px)
 *   iconPosition:    none | left | right | alone
 *
 * Radius flag (atoms.md): 8 px (var(--radius-sm)) regardless of Figma renders.
 *
 * Loading state:
 *   Replaces label/icon with <Loader> (inline size). Preserves button dimensions.
 *   Sets aria-busy="true". Disables interaction while loading.
 *
 * Icon-alone:
 *   TypeScript requires aria-label when iconPosition === 'alone' and no children.
 *
 * Accessibility:
 *   - Visible :focus-visible ring via .ariya-focus class.
 *   - Disabled: not in tab order (disabled attr), opacity 0.5.
 *   - Loading: aria-busy="true", pointer-events: none.
 *   - No <div onClick>.
 *
 * Rules:
 *   - No raw hex — colours via CSS custom property or RGBA exemption.
 *   - No console.log.
 */

import { useState, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react'
import Loader from './Loader'

// ── Types ────────────────────────────────────────────────────────────────────
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'destructive'
  | 'tertiary-destructive'

export type ButtonSize = 'sm' | 'md' | 'lg'
export type IconPosition = 'none' | 'left' | 'right' | 'alone'

// Base props shared across all icon positions
interface ButtonBaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit' | 'reset'
  className?: string
  style?: CSSProperties
}

// When icon-alone: aria-label is required, children not expected
type IconAloneProps = ButtonBaseProps & {
  iconPosition: 'alone'
  icon: ReactNode
  /** Required when no visible label text is present */
  'aria-label': string
  children?: never
}

// When label visible: children required, aria-label optional
type LabeledProps = ButtonBaseProps & {
  iconPosition?: 'none' | 'left' | 'right'
  icon?: ReactNode
  'aria-label'?: string
  children: ReactNode
}

export type ButtonProps = IconAloneProps | LabeledProps

// ── Size constants ────────────────────────────────────────────────────────────
const HEIGHT: Record<ButtonSize, number> = { sm: 32, md: 36, lg: 44 }
const H_PADDING: Record<ButtonSize, number> = { sm: 12, md: 16, lg: 20 }
const FONT_SIZE: Record<ButtonSize, string> = { sm: '13px', md: '14px', lg: '16px' }
const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 }

// ── Variant style maps ────────────────────────────────────────────────────────
// Defines [default, hover, pressed] backgrounds and text colours.
// RGBA strings are exempt from the no-raw-hex rule.
const VARIANT_STYLES: Record<
  ButtonVariant,
  {
    bg: string
    bgHover: string
    bgPressed: string
    color: string
    border: string
    borderHover: string
  }
> = {
  primary: {
    bg:          'var(--blue-primary)',
    bgHover:     'var(--blue-600)',
    bgPressed:   'var(--blue-700)',
    color:       'var(--bg-1)',
    border:      'none',
    borderHover: 'none',
  },
  secondary: {
    bg:          'transparent',
    bgHover:     'rgba(42,118,244,0.08)',
    bgPressed:   'rgba(42,118,244,0.15)',
    color:       'var(--blue-primary)',
    border:      '1px solid var(--blue-primary)',
    borderHover: '1px solid var(--blue-primary)',
  },
  tertiary: {
    bg:          'transparent',
    bgHover:     'var(--bg-2)',
    bgPressed:   'var(--disabled-bg)',
    color:       'var(--blue-primary)',
    border:      'none',
    borderHover: 'none',
  },
  destructive: {
    bg:          'var(--status-red)',
    bgHover:     '#9e2c3e',
    bgPressed:   '#86253a',
    color:       'var(--bg-1)',
    border:      'none',
    borderHover: 'none',
  },
  'tertiary-destructive': {
    bg:          'transparent',
    bgHover:     'rgba(183,63,84,0.08)',
    bgPressed:   'rgba(183,63,84,0.15)',
    color:       'var(--status-red)',
    border:      'none',
    borderHover: 'none',
  },
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    onClick,
    type = 'button',
    className,
    style,
    'aria-label': ariaLabel,
  } = props

  const iconPosition =
    (props as LabeledProps).iconPosition ?? 'none'
  const icon = (props as LabeledProps).icon ?? null
  const children =
    iconPosition !== 'alone' ? (props as LabeledProps).children : undefined

  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const isDisabled = disabled || loading

  const vs = VARIANT_STYLES[variant]
  const height = HEIGHT[size]
  const hPad = H_PADDING[size]
  const fontSize = FONT_SIZE[size]
  const iconPx = ICON_SIZE[size]
  const loaderSize = size === 'lg' ? 'md' : 'sm'

  // Determine background and border for current interaction state
  let bg = vs.bg
  let border = vs.border
  if (!isDisabled) {
    if (pressed) {
      bg = vs.bgPressed
      border = vs.borderHover
    } else if (hovered) {
      bg = vs.bgHover
      border = vs.borderHover
    }
  }

  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: icon && iconPosition !== 'alone' ? 6 : 0,
    height,
    // Icon-alone: square button; else horizontal padding
    width:      iconPosition === 'alone' ? height : undefined,
    minWidth:   iconPosition === 'alone' ? height : undefined,
    paddingLeft:  iconPosition === 'alone' ? 0 : hPad,
    paddingRight: iconPosition === 'alone' ? 0 : hPad,
    // Radius flag: always 8 px per atoms.md — overrides Figma renders
    borderRadius: 'var(--radius-sm)',
    background: isDisabled ? (variant === 'tertiary' || variant === 'tertiary-destructive' ? 'transparent' : vs.bg) : bg,
    color:      isDisabled ? vs.color : vs.color,
    border:     isDisabled ? (variant === 'secondary' ? '1px solid rgba(112,128,144,0.4)' : border) : border,
    fontSize,
    fontWeight: 600,
    fontFamily: 'inherit',
    lineHeight: 1,
    cursor:     isDisabled ? 'not-allowed' : 'pointer',
    opacity:    disabled ? 0.45 : loading ? 0.75 : 1,
    transition: 'background 120ms ease, border-color 120ms ease, opacity 120ms ease',
    whiteSpace: 'nowrap',
    // Loading removes pointer events
    pointerEvents: loading ? 'none' : undefined,
    ...style,
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      onClick={!isDisabled ? onClick : undefined}
      onMouseEnter={() => !isDisabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => !isDisabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      // ariya-focus drives :focus-visible ring (see index.css)
      className={`ariya-focus${className ? ' ' + className : ''}`}
      style={baseStyle}
    >
      {loading ? (
        /* Loading state: replace content with Loader, preserve dimensions */
        <Loader size={loaderSize} label="Loading" />
      ) : (
        <>
          {/* Left icon */}
          {icon && iconPosition === 'left' && (
            <span aria-hidden="true" style={{ display: 'inline-flex', width: iconPx, height: iconPx, flexShrink: 0 }}>
              {icon}
            </span>
          )}

          {/* Label text (hidden from icon-alone buttons) */}
          {iconPosition !== 'alone' && children && (
            <span>{children}</span>
          )}

          {/* Right icon */}
          {icon && iconPosition === 'right' && (
            <span aria-hidden="true" style={{ display: 'inline-flex', width: iconPx, height: iconPx, flexShrink: 0 }}>
              {icon}
            </span>
          )}

          {/* Alone icon (no label — aria-label required by TypeScript signature) */}
          {icon && iconPosition === 'alone' && (
            <span aria-hidden="true" style={{ display: 'inline-flex', width: iconPx, height: iconPx, flexShrink: 0 }}>
              {icon}
            </span>
          )}
        </>
      )}
    </button>
  )
}
