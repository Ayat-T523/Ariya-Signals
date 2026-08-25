// InForm — Market Weather (per docs/design/component-references/
// Market Weather.html): State (mood) -> Section A (evidence per competitor)
// -> Section B (one synthesized implication). Content surface, never glass.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowRight, TrendingDown, AlertTriangle, Minus } from 'lucide-react'
import CompetitorBadge from '../ui/CompetitorBadge'
import { SeverityDot } from './primitives'
import type { WeatherRow, WeatherState } from './types'
import { Tabs, TabsList, TabsTrigger } from '../animate-ui/components/radix/tabs'

const STATE_META: Record<WeatherState, { label: string; icon: typeof TrendingUp; color: string }> = {
  clearing: { label: 'Clearing', icon: TrendingUp, color: 'var(--sage-600)' },
  stable: { label: 'Holding steady', icon: ArrowRight, color: 'var(--info-600)' },
  pressure: { label: 'Pressure building', icon: TrendingDown, color: 'var(--amber-800)' },
  storm: { label: 'Storm warning', icon: AlertTriangle, color: 'var(--crimson-600)' },
  // No real assessment yet -- see WeatherState's own docstring in types.ts.
  pending: { label: 'Assessment pending', icon: Minus, color: 'var(--neutral-500)' },
}

/** A cross-Signal grounded synthesis statement (War Room semantic-
 *  integrity checkpoint, 2026-08-25 -- the real V1 landscape's own "what
 *  moved" content, produced server-side from real Signals). Distinct from
 *  `WeatherRow`: a movement is a pattern across the whole landscape (e.g.
 *  "three competitors generated clinical activity"), never one row per
 *  competitor -- so it renders without a competitor badge/count/severity
 *  dot. When `movements` is supplied, it takes priority over `rows`. */
export interface MarketWeatherMovementRow {
  title: string
  summary: string
}

export interface MarketWeatherProps {
  asset: string
  isLive?: boolean
  state: WeatherState
  qualifier: string
  timeframe: '7D' | '30D' | '90D'
  onTimeframeChange?: (tf: '7D' | '30D' | '90D') => void
  rows: WeatherRow[]
  /** Real V1 cross-Signal synthesis rows -- see MarketWeatherMovementRow's
   *  own docstring. Takes priority over `rows` when present (same
   *  precedence convention `implications` already has over `implication`). */
  movements?: MarketWeatherMovementRow[]
  rowsEmptyMessage?: string
  /** Single takeaway. Use `implications` instead to show a short capped list (e.g. the War
   *  Room rail's "top 2-3"); when both are passed, `implications` wins. */
  implication?: string
  implications?: string[]
  implicationEmptyMessage?: string
  readMoreTo?: string
  compact?: boolean
}

export function MarketWeather({
  asset, isLive = true, state, qualifier, timeframe, onTimeframeChange,
  rows, movements, rowsEmptyMessage, implication, implications, implicationEmptyMessage, readMoreTo, compact = false,
}: MarketWeatherProps) {
  const [showAll, setShowAll] = useState(false)
  const meta = STATE_META[state]
  const Icon = meta.icon
  const usingMovements = movements !== undefined
  const movementCount = usingMovements ? movements.length : rows.length
  const visibleMovements = usingMovements ? (compact && !showAll ? movements.slice(0, 2) : movements) : []
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
          <Tabs value={timeframe} onValueChange={(v) => onTimeframeChange(v as '7D' | '30D' | '90D')}>
            <TabsList aria-label="Timeframe" style={{ height: '26px', padding: '2px' }}>
              {(['7D', '30D', '90D'] as const).map(tf => (
                <TabsTrigger key={tf} value={tf} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '0 8px' }}>
                  {tf}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="mw-state">
        <span className="mw-icon"><Icon size={22} aria-hidden="true" /></span>
        <span className="mw-label">{meta.label}</span>
        <span className="mw-qualifier">{qualifier}</span>
      </div>

      <div>
        <div className="mw-section-label">What moved in {timeframe.toLowerCase()}</div>
        {movementCount === 0 ? (
          <div className="mw-empty"><p>{rowsEmptyMessage ?? 'Not enough signal yet — check back as data builds.'}</p></div>
        ) : usingMovements ? (
          <>
            <div className="mw-rows">
              {visibleMovements.map((m, i) => (
                <div className="mw-row" tabIndex={0} key={i}>
                  <div className="mw-row-top">
                    <span className="mw-row-name">{m.title}</span>
                  </div>
                  <div className="mw-row-implication">{m.summary}</div>
                </div>
              ))}
            </div>
            {compact && !showAll && movements!.length > 2 && (
              <button type="button" className="mw-show-all" onClick={() => setShowAll(true)}>Show all ({movements!.length})</button>
            )}
          </>
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
        {implications && implications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            {implications.map((text, i) => (
              <div className="mw-callout" key={i}><p>{text}</p></div>
            ))}
          </div>
        ) : implication ? (
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
