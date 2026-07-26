// InForm — small shared primitives used across the Ariya component set.
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
