// InForm — Signal Feed wrapper (per docs/design/component-references/
// Signal Feed States.html): owns loading / empty / error, renders DigestFeed
// underneath once signals are ready. Loading and full error hide the filter
// bar (a sibling component); no-results and partial-load keep it visible --
// that visibility choice belongs to the page composing this, not here.
import { Inbox, CheckCircle2, FilterX, AlertTriangle } from 'lucide-react'
import { DigestFeed } from './DigestFeed'
import { NEU_PLATE_STYLE } from './primitives'
import type { Signal } from './types'

export type EmptyVariant = 'fresh' | 'caught-up' | 'no-results'

const EMPTY_COPY: Record<EmptyVariant, { icon: typeof Inbox; heading: string; body: string }> = {
  fresh: { icon: Inbox, heading: 'Your feed is warming up', body: "We're pulling signals for your tracked assets. New ones land here as they're found." },
  'caught-up': { icon: CheckCircle2, heading: "You're all caught up", body: "No unread signals. We'll surface new ones as they arrive." },
  'no-results': { icon: FilterX, heading: 'No signals match these filters', body: 'Try widening the filters or clearing the search.' },
}

export interface SignalFeedProps {
  status: 'loading' | 'error' | 'ready'
  signals: Signal[]
  emptyVariant?: EmptyVariant
  emptyAction?: { label: string; onClick?: () => void }
  errorMessage?: string
  onRetry?: () => void
  /** Shown as a banner above a still-rendered (partial) feed -- distinct from the full-error state. */
  partial?: { message: string; onRetry?: () => void }
  openFeedTo?: string
}

function Skel({ w, h, r = 6, style }: { w: string | number; h: number; r?: number; style?: React.CSSProperties }) {
  return <div className="inf-sk" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

function LoadingSkeleton() {
  return (
    <div className="digest-plate" style={NEU_PLATE_STYLE} aria-busy="true" aria-label="Loading signals">
      {[3, 4].map((rows, gi) => (
        <div className="digest-group" key={gi}>
          <div className="digest-group-hd">
            <Skel w={24} h={24} r={7} />
            <Skel w={90 + gi * 20} h={13} />
            <Skel w={44} h={11} style={{ marginLeft: 6 }} />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div className="digest-row" key={i} style={{ cursor: 'default' }}>
              <Skel w={8} h={8} r={999} />
              <Skel w={`${420 - i * 30}px`} h={13} style={{ maxWidth: '70%' }} />
              <Skel w={70} h={11} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyBox({ variant, action }: { variant: EmptyVariant; action?: { label: string; onClick?: () => void } }) {
  const copy = EMPTY_COPY[variant]
  const Icon = copy.icon
  return (
    <div className="digest-plate signal-feed-empty" style={NEU_PLATE_STYLE}>
      <div className="icon-circle"><Icon size={26} aria-hidden="true" /></div>
      <h3>{copy.heading}</h3>
      <p>{copy.body}</p>
      {action && (
        <button type="button" className={`btn ${variant === 'caught-up' ? 'btn-secondary' : 'btn-primary'}`} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="digest-plate signal-feed-empty" style={NEU_PLATE_STYLE}>
      <div className="icon-circle is-error"><AlertTriangle size={26} aria-hidden="true" /></div>
      <h3>Couldn&rsquo;t load your feed</h3>
      <p>{message}</p>
      {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Retry</button>}
      <div className="muted-line">If this keeps happening, contact your account team.</div>
    </div>
  )
}

export function SignalFeed({ status, signals, emptyVariant = 'fresh', emptyAction, errorMessage, onRetry, partial, openFeedTo }: SignalFeedProps) {
  if (status === 'loading') return <LoadingSkeleton />

  if (status === 'error' && signals.length === 0) {
    return <ErrorBox message={errorMessage ?? 'Something went wrong on our end. Your data is safe.'} onRetry={onRetry} />
  }

  if (signals.length === 0) {
    return <EmptyBox variant={emptyVariant} action={emptyAction} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {partial && (
        <div className="signal-feed-banner">
          <AlertTriangle size={16} aria-hidden="true" />
          <span className="msg">{partial.message}</span>
          {partial.onRetry && <button type="button" className="retry" onClick={partial.onRetry}>Retry</button>}
        </div>
      )}
      <DigestFeed signals={signals} openFeedTo={openFeedTo} />
    </div>
  )
}
