// InForm — Digest Feed, Variant A (per docs/design/component-references/
// Signal Feed Variants.html): fewest boxes. One plate holds every competitor
// group; entries are hairline rows, not individually-elevated cards.
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import CompetitorBadge from '../ui/CompetitorBadge'
import { SeverityDot, DotSep, NEU_PLATE_STYLE } from './primitives'
import type { Signal } from './types'

function DigestRow({ signal }: { signal: Signal }) {
  const [open, setOpen] = useState(false)
  const [excerptHeight, setExcerptHeight] = useState(0)
  const excerptRef = useRef<HTMLDivElement>(null)
  const canExpand = !!(signal.excerpt || signal.why)

  // Measure after the DOM actually commits, not during render -- see the
  // matching comment in SignalCard.tsx.
  useLayoutEffect(() => {
    if (open && excerptRef.current) setExcerptHeight(excerptRef.current.scrollHeight)
  }, [open])

  return (
    <div>
      <button
        type="button"
        className="digest-row"
        aria-expanded={canExpand ? open : undefined}
        onClick={() => canExpand && setOpen(v => !v)}
      >
        <SeverityDot sev={signal.severity} />
        <span className="headline">{signal.headline}</span>
        <span className="row-meta">
          <span>{signal.source}</span>
          <DotSep />
          <span className="time">{signal.time}</span>
        </span>
      </button>
      {canExpand && (
        <div className={`digest-expand-wrap${open ? ' is-open' : ''}`} style={{ maxHeight: open ? `${excerptHeight}px` : '0px' }}>
          <div className="signal-excerpt" ref={excerptRef}>
            {signal.excerpt && <p className="signal-excerpt-quote">&ldquo;{signal.excerpt}&rdquo;</p>}
            {signal.why && <p className="signal-excerpt-why"><strong>WHY — </strong>{signal.why}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export function DigestFeed({ signals, openFeedTo, emptyMessage }: {
  signals: Signal[]
  openFeedTo?: string
  emptyMessage?: string
}) {
  // Group by competitor, preserving first-appearance order -- the caller has
  // already sorted `signals` by importance/recency, so this surfaces the
  // highest-priority competitor group first without a hardcoded list.
  const order: string[] = []
  for (const s of signals) if (!order.includes(s.competitor)) order.push(s.competitor)
  const groups = order.map(c => ({ competitor: c, competitorId: signals.find(s => s.competitor === c)?.competitorId, signals: signals.filter(s => s.competitor === c) }))

  if (groups.length === 0) {
    return (
      <div className="digest-plate" style={{ ...NEU_PLATE_STYLE, padding: 'var(--s-8) var(--s-6)', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'var(--ink-900)', fontFamily: 'var(--font-ui)' }}>
          {emptyMessage ?? 'No signals match this filter'}
        </p>
      </div>
    )
  }

  const footer = (
    <>
      Open full feed <ExternalLink size={13} aria-hidden="true" />
    </>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
      <div className="digest-plate" style={NEU_PLATE_STYLE}>
        {groups.map(g => (
          <div className="digest-group" key={g.competitor}>
            <div className="digest-group-hd">
              <CompetitorBadge name={g.competitor} id={g.competitorId} size={24} />
              <span className="name">{g.competitor}</span>
              <span className="count">{g.signals.length} signal{g.signals.length === 1 ? '' : 's'}</span>
            </div>
            {g.signals.map(s => <DigestRow key={s.id} signal={s} />)}
          </div>
        ))}
      </div>
      {openFeedTo ? (
        <Link to={openFeedTo} className="digest-footer">{footer}</Link>
      ) : (
        <button type="button" className="digest-footer">{footer}</button>
      )}
    </div>
  )
}
