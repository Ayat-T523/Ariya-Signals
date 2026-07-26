// InForm — Market Weather (per docs/design/component-references/
// Market Weather.html): State (mood) -> Section A (evidence per competitor)
// -> Section B (one synthesized implication). Content surface, never glass.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowRight, TrendingDown, AlertTriangle } from 'lucide-react'
import CompetitorBadge from '../ui/CompetitorBadge'
import { SeverityDot } from './primitives'
import type { WeatherRow, WeatherState } from './types'

const STATE_META: Record<WeatherState, { label: string; icon: typeof TrendingUp; color: string }> = {
  clearing: { label: 'Clearing', icon: TrendingUp, color: 'var(--sage-600)' },
  stable: { label: 'Holding steady', icon: ArrowRight, color: 'var(--info-600)' },
  pressure: { label: 'Pressure building', icon: TrendingDown, color: 'var(--amber-800)' },
  storm: { label: 'Storm warning', icon: AlertTriangle, color: 'var(--crimson-600)' },
}

export interface MarketWeatherProps {
  asset: string
  isLive?: boolean
  state: WeatherState
  qualifier: string
  timeframe: '30D' | '90D'
  onTimeframeChange?: (tf: '30D' | '90D') => void
  rows: WeatherRow[]
  rowsEmptyMessage?: string
  implication?: string
  implicationEmptyMessage?: string
  readMoreTo?: string
  compact?: boolean
}

export function MarketWeather({
  asset, isLive = true, state, qualifier, timeframe, onTimeframeChange,
  rows, rowsEmptyMessage, implication, implicationEmptyMessage, readMoreTo, compact = false,
}: MarketWeatherProps) {
  const [showAll, setShowAll] = useState(false)
  const meta = STATE_META[state]
  const Icon = meta.icon
  const visibleRows = compact && !showAll ? rows.slice(0, 2) : rows

  return (
    <div className={`mw-card inf-raised-lg${compact ? ' compact' : ''}`} tabIndex={0} style={({ '--state-color': meta.color } as React.CSSProperties)}>
      <div className="mw-header">
        <div className="mw-title-group">
          <h3 className="mw-title">Market weather</h3>
          <span className="mw-asset-chip">{asset}</span>
          {isLive && <span className="mw-live-dot" title="Live data" />}
        </div>
        {onTimeframeChange && (
          <div className="mw-timeframe" role="tablist" aria-label="Timeframe">
            {(['30D', '90D'] as const).map(tf => (
              <button key={tf} type="button" role="tab" aria-selected={timeframe === tf} className={timeframe === tf ? 'active' : ''} onClick={() => onTimeframeChange(tf)}>
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mw-state">
        <span className="mw-icon"><Icon size={22} aria-hidden="true" /></span>
        <span className="mw-label">{meta.label}</span>
        <span className="mw-qualifier">{qualifier}</span>
      </div>

      <div>
        <div className="mw-section-label">What moved this week</div>
        {rows.length === 0 ? (
          <div className="mw-empty"><p>{rowsEmptyMessage ?? 'Not enough signal yet — check back as data builds.'}</p></div>
        ) : (
          <>
            <div className="mw-rows">
              {visibleRows.map(r => (
                <div className="mw-row" tabIndex={0} key={r.competitor}>
                  <div className="mw-row-top">
                    <div className="mw-row-left">
                      <CompetitorBadge name={r.competitor} id={r.competitorId} size={24} />
                      <span className="mw-row-name">{r.competitor}</span>
                    </div>
                    <div className="mw-row-right">
                      <span className="mw-row-count">{r.count} signal{r.count === 1 ? '' : 's'}</span>
                      <SeverityDot sev={r.severity} />
                    </div>
                  </div>
                  <div className="mw-row-implication">{r.summary}</div>
                </div>
              ))}
            </div>
            {compact && !showAll && rows.length > 2 && (
              <button type="button" className="mw-show-all" onClick={() => setShowAll(true)}>Show all ({rows.length})</button>
            )}
          </>
        )}
      </div>

      <div>
        <div className="mw-section-label">Implications</div>
        {implication ? (
          <div className="mw-callout"><p>{implication}</p></div>
        ) : (
          <div className="mw-empty"><p>{implicationEmptyMessage ?? 'Not enough recent signals to generate implications.'}</p></div>
        )}
      </div>

      {readMoreTo && (
        <Link className="mw-footer" to={readMoreTo}>
          Read full assessment <ArrowRight size={12} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}
