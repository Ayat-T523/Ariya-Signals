// Signals — small shared primitives used across the Ariya component set.
import type { Severity } from './types'

export function severityColor(sev: Severity): string {
  return sev === 'high' ? 'var(--crimson-600)' : sev === 'medium' ? 'var(--amber-600)' : 'var(--info-600)'
}
export function severityTint(sev: Severity): string {
  return sev === 'high' ? 'var(--crimson-050)' : sev === 'medium' ? 'var(--amber-050)' : 'var(--info-050)'
}
export function severityText(sev: Severity): string {
  return sev === 'high' ? 'var(--crimson-600)' : sev === 'medium' ? 'var(--amber-800)' : 'var(--info-600)'
}
export function severityLabel(sev: Severity): string {
  return sev === 'high' ? 'High' : sev === 'medium' ? 'Med' : 'Low'
}

export function SeverityDot({ sev, size = 7 }: { sev: Severity; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: '50%', background: severityColor(sev), flexShrink: 0, display: 'inline-block' }}
    />
  )
}

export function SeverityTag({ sev }: { sev: Severity }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '3px 7px', borderRadius: 'var(--r-xs)',
        background: severityTint(sev), color: severityText(sev),
        whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {severityLabel(sev)}
    </span>
  )
}

export function DotSep() {
  return <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.5, flexShrink: 0 }} />
}

// Inline equivalent of the .sig-raised/.sig-raised-lg CSS recipes (cream-100
// neumorphic plain container, per DESIGN.md's content layer). Not a CSS
// class: those two selectors were reproducibly, silently dropped from both
// the Vite dev and production builds by some tool in the chain (Tailwind
// v4's Vite plugin / Lightning CSS were the suspects; never fully isolated
// despite renaming, repositioning, and de-duplicating the rules) whenever
// they existed as any 3-property-only class in this stylesheet region —
// even after eliminating every selector-prefix and adjacency relationship
// tried. Inline styles sidestep the bug entirely. See git history on this
// file (Round 2 R5) for the failed CSS-only attempts if this needs revisiting.
export const NEU_PLATE_STYLE: React.CSSProperties = { background: 'var(--cream-100)', boxShadow: 'var(--neu-raised)', borderRadius: 'var(--r-lg)' }

// Clean Clinical replacement for NEU_PLATE_STYLE: flat white surface, 1px
// neutral border, no resting shadow, no corner radius (see DESIGN.md's "One
// material layer" -- content-area containers are sharp-cornered, not just
// flat). Also sidesteps the .sig-raised silent-drop build bug by staying inline.
export const FLAT_CARD_STYLE: React.CSSProperties = { background: 'var(--white)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-flat-content)' }

// Same silent-drop bug hits .kpi-card specifically (confirmed live,
// 2026-08-26: KpiCard.tsx's rendered className is exactly "kpi-card", but
// getComputedStyle reports display:block/transparent/0px-everything --
// every OTHER kpi-* selector in the same stylesheet region, e.g.
// .kpi-label/.kpi-value/.kpi-footer, computes correctly, so this is
// narrowly the container rule, not the whole component). className is
// still applied for descendant selectors and :hover/:focus-visible/
// .compact modifiers, which do work -- only the base shell needs the
// inline sidestep.
export const KPI_CARD_STYLE: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
  padding: 'var(--s-5)', borderRadius: 'var(--r-flat-content)',
  background: 'var(--white)', border: '1px solid var(--border-default)',
  textDecoration: 'none', color: 'inherit', outline: 'none',
}
