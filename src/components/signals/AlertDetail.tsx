// InForm — Alert/signal detail drawer content (SlideOver body). Extracted from
// AlertsPage.tsx (Phase 3.1) so the War Room worklist's "Inspect" action can open
// the exact same drawer (war-room-redesign-spec.md §5: "Inspect opens the Alerts
// detail drawer — shared with the alerts redesign"), not a second bespoke one.
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ProvenanceChip from '../ui/ProvenanceChip'
import { SeverityTag } from './primitives'
import type { MappedAlert } from '../../lib/signalMapping'
import { formatDateAbs } from '../../utils/formatDate'

export function AlertDetail({ alert }: { alert: MappedAlert }) {
  const [sourceOpen, setSourceOpen] = useState(false)
  return (
    <div>
      <div className="alert-drawer-hd">
        <SeverityTag sev={alert.severity} />
        <span style={({ font: 'var(--t-mono)', color: 'var(--ink-600)' } as React.CSSProperties)}>
          {formatDateAbs(alert.timestamp)}
        </span>
      </div>
      <h3 className="alert-drawer-title">{alert.headline}</h3>

      {alert.whatHappened && (
        <div className="alert-drawer-section">
          <p className="alert-drawer-label">What changed</p>
          <p className="alert-drawer-body">{alert.whatHappened}</p>
        </div>
      )}

      {alert.whyItMatters && (
        <div className="alert-drawer-section">
          <p className="alert-drawer-label">Why it matters</p>
          <div className="mw-callout"><p>{alert.whyItMatters}</p></div>
        </div>
      )}

      {/* Suggested action — always shown when present, never a generic fallback
          (war-room-redesign-spec.md §4). Omitted entirely when the synthesis
          pipeline hasn't produced one for this signal — no filler text. */}
      {alert.suggestedAction && (
        <div className="alert-drawer-section">
          <p className="alert-drawer-label">Suggested action</p>
          <p className="alert-drawer-body">{alert.suggestedAction}</p>
        </div>
      )}

      {(alert.labelDiff || alert.source) && (
        <div className="alert-drawer-section">
          {alert.source && (
            <ProvenanceChip sourceLabel={alert.source} date={alert.timestamp} isLive />
          )}
          {alert.labelDiff && (
            <>
              <button
                type="button" className="alert-drawer-source-toggle"
                aria-expanded={sourceOpen} onClick={() => setSourceOpen((v) => !v)}
              >
                {sourceOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                Original source
              </button>
              {sourceOpen && (
                <div className="alert-drawer-source-body">
                  <div className="signal-excerpt">
                    <p className="signal-excerpt-quote">&ldquo;{alert.labelDiff.current}&rdquo;</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
