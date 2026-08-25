// Signals — KPI Card (per docs/design/component-references/KPI Card.html).
// Three scannability-tuned variants share one shell: delta, breakdown, sparkline.
// The value is the hero; one support row, one action, per card.
import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { ArrowUp } from '../animate-ui/icons/arrow-up'
import { ArrowDown } from '../animate-ui/icons/arrow-down'
import { ArrowRight } from '../animate-ui/icons/arrow-right'
import { KPI_CARD_STYLE } from './primitives'
import type { KpiDatum, DeltaTone } from './types'

const DELTA_ICON: Record<DeltaTone, typeof ArrowUp> = { up: ArrowUp, down: ArrowDown, flat: ArrowRight }

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const w = 200
  const h = 32
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function KpiCard({ kpi, compact = false }: { kpi: KpiDatum; compact?: boolean }) {
  const isLinkable = !!(kpi.link && kpi.linkTo) && !kpi.isError
  const className = `kpi-card${isLinkable ? ' is-linkable' : ''}${compact ? ' compact' : ''}`

  const body = (
    <>
      <span className="kpi-label">{kpi.label}</span>

      <span className={`kpi-value${kpi.isEmpty ? ' is-empty' : ''}${kpi.isError ? ' is-error' : ''}`}>
        {kpi.isEmpty || kpi.isError ? '—' : kpi.value}
      </span>

      {kpi.isError ? (
        kpi.errorNote && (
          <span className="kpi-error-note">
            <AlertCircle size={13} aria-hidden="true" />
            {kpi.errorNote}
          </span>
        )
      ) : kpi.sparkline && kpi.sparkline.length > 1 && !compact ? (
        <div className="kpi-spark">
          <Sparkline points={kpi.sparkline} color={kpi.deltaTone === 'down' ? 'var(--crimson-600)' : kpi.deltaTone === 'flat' ? 'var(--neutral-500)' : 'var(--sage-600)'} />
        </div>
      ) : kpi.breakdown && kpi.breakdown.length > 0 ? (
        <span className="kpi-support">
          <span className="kpi-breakdown">
            {kpi.breakdown.map((b, i) => (
              <span className="seg" key={i}>
                <span className="dot" style={{ background: b.color }} aria-hidden="true" />
                {b.label}
              </span>
            ))}
          </span>
        </span>
      ) : (kpi.delta || kpi.caption) ? (
        <span className="kpi-support">
          {kpi.delta && kpi.deltaTone && (
            <span className={`kpi-delta ${kpi.deltaTone}`}>
              {(() => { const Icon = DELTA_ICON[kpi.deltaTone!]; return <Icon size={13} aria-hidden="true" animateOnHover /> })()}
              {kpi.delta}
            </span>
          )}
          {kpi.caption && <span>{kpi.caption}</span>}
        </span>
      ) : null}

      {kpi.link && (
        <span className={`kpi-footer${kpi.isEmpty ? ' is-muted' : ''}`}>
          {kpi.link} <ArrowRight size={12} aria-hidden="true" />
        </span>
      )}
    </>
  )

  if (isLinkable) {
    return (
      <Link to={kpi.linkTo!} className={className} style={KPI_CARD_STYLE}>
        {body}
      </Link>
    )
  }
  return <div className={className} style={KPI_CARD_STYLE}>{body}</div>
}
