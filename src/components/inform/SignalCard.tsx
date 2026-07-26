// InForm — Signal Card (per docs/design/component-references/Signal Card.html).
// X-Card anatomy on InForm's neumorphic shell: three facts at rest (author,
// headline, meta); excerpt + WHY reveal as a nested pressed sub-card on expand.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ExternalLink, ChevronDown } from 'lucide-react'
import CompetitorBadge from '../ui/CompetitorBadge'
import { SeverityTag, severityColor } from './primitives'
import type { Signal } from './types'

export function SignalCard({ signal, compact = false, forceHover = false }: {
  signal: Signal
  compact?: boolean
  forceHover?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [excerptHeight, setExcerptHeight] = useState(0)
  const excerptRef = useRef<HTMLDivElement>(null)
  const canExpand = !compact && !!(signal.excerpt || signal.why)

  // Measure after the DOM actually commits, not during render (reading
  // scrollHeight mid-render returned a stale value from before this toggle).
  useLayoutEffect(() => {
    if (expanded && excerptRef.current) setExcerptHeight(excerptRef.current.scrollHeight)
  }, [expanded])

  function toggle() {
    if (canExpand) setExpanded(v => !v)
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
  }

  const className = [
    'signal-card',
    compact ? 'compact' : '',
    signal.unread ? 'is-unread' : '',
    expanded ? 'is-expanded' : '',
    forceHover ? 'force-hover' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={className}
      style={({ '--sev-color': severityColor(signal.severity) } as React.CSSProperties)}
      role={canExpand ? 'button' : undefined}
      tabIndex={canExpand ? 0 : -1}
      aria-expanded={canExpand ? expanded : undefined}
      onClick={canExpand ? toggle : undefined}
      onKeyDown={canExpand ? onKeyDown : undefined}
    >
      <div className="signal-author">
        <CompetitorBadge name={signal.competitor} id={signal.competitorId} size={24} />
        <span className="signal-author-line">
          <span className="signal-author-name">{signal.competitor}</span>
          <span className="signal-author-type">{signal.type}</span>
        </span>
        <SeverityTag sev={signal.severity} />
      </div>

      <div className="signal-headline">{signal.headline}</div>

      <div className="signal-meta">
        <ExternalLink aria-hidden="true" />
        <span>{signal.source}</span>
        <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.5 }} />
        <span className="time">{signal.time}</span>
        {canExpand && (
          <span className="signal-expand">
            Why <ChevronDown aria-hidden="true" />
          </span>
        )}
      </div>

      {canExpand && (
        <div className="signal-excerpt-wrap" style={{ maxHeight: expanded ? `${excerptHeight}px` : '0px' }}>
          <div className="signal-excerpt" ref={excerptRef}>
            {signal.excerpt && <p className="signal-excerpt-quote">&ldquo;{signal.excerpt}&rdquo;</p>}
            {signal.why && <p className="signal-excerpt-why"><strong>WHY — </strong>{signal.why}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
