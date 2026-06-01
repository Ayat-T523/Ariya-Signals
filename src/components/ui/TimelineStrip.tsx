import { useEffect, useMemo, useRef } from 'react'

// Dot colours by event type — see spec
const DOT_COLOR_BY_TYPE = {
  earnings:   '#0055BB',
  regulatory: '#F59E0B',
  conference: '#050A44',
}
const DEFAULT_DOT_COLOR = '#9CA3AF'

// ── Date helpers (UTC-based to stay consistent with ISO date strings) ────────
function utcDateKey(d) {
  return d.toISOString().slice(0, 10)
}
function addDays(d, n) {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + n)
  return x
}
function isFirstOfMonth(d) {
  return d.getUTCDate() === 1
}
function utcMonthName(d) {
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

/**
 * Horizontally-scrollable 90-day (or N-day) timeline strip.
 * Props:
 *   events       — array of { id, date, title, type, ... }
 *   startDate    — Date object — the leftmost day (usually "today")
 *   days         — number of days to render (default 90)
 *   height       — strip height in px (default 80)
 *   columnWidth  — width per day in px (default 30)
 *   onDotClick   — (eventId) => void
 *   dotTooltip   — (event) => string  — content for the native tooltip
 */
export default function TimelineStrip({
  events,
  startDate,
  days = 90,
  height = 80,
  columnWidth = 30,
  onDotClick,
  dotTooltip,
}) {
  const scrollRef = useRef(null)

  // Group events by their YYYY-MM-DD key
  const eventsByDate = useMemo(() => {
    const map = new Map()
    for (const e of events || []) {
      const key = (e.date || '').slice(0, 10)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    return map
  }, [events])

  // Build the 90-day window
  const dayList = useMemo(() => {
    const list = []
    for (let i = 0; i < days; i++) {
      list.push(addDays(startDate, i))
    }
    return list
  }, [startDate, days])

  const todayKey = utcDateKey(startDate)

  // Auto-scroll on mount so today sits ~1/4 from the left edge
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const todayCol = container.querySelector('[data-today="true"]')
    if (!todayCol) return
    const offset = todayCol.offsetLeft - container.clientWidth * 0.25
    container.scrollLeft = Math.max(0, offset)
  }, [])

  const defaultTooltip = (e) => `${e.title} · ${e.date}`

  return (
    <div
      ref={scrollRef}
      style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
      }}
    >
      <div style={{ display: 'flex', minWidth: 'min-content', height }}>
        {dayList.map((d, idx) => {
          const key             = utcDateKey(d)
          const dayEvents       = eventsByDate.get(key) || []
          const isToday         = key === todayKey
          const firstOfMonth    = isFirstOfMonth(d)
          const showMonth       = firstOfMonth || idx === 0
          const monthLabel      = showMonth ? utcMonthName(d) : ''

          return (
            <div
              key={idx}
              data-today={isToday ? 'true' : 'false'}
              style={{
                position: 'relative',
                flexShrink: 0,
                width: `${columnWidth}px`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '6px',
                borderLeft: firstOfMonth ? '1px solid rgba(5,10,68,0.10)' : '1px solid transparent',
                background: isToday ? '#E8EAF6' : 'transparent',
                borderRadius: isToday ? '8px' : 0,
              }}
            >
              {/* Month label — only on 1st of month (or first column) */}
              <div style={{
                height: '12px',
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(5,10,68,0.45)',
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}>
                {monthLabel}
              </div>

              {/* Day number */}
              <div style={{
                fontSize: '11px',
                fontWeight: isToday ? 700 : 500,
                color: isToday ? '#0055BB' : 'rgba(5,10,68,0.65)',
                marginTop: '4px',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {d.getUTCDate()}
              </div>

              {/* Dots — stacked when multiple events fall on same day */}
              <div style={{
                marginTop: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                alignItems: 'center',
              }}>
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    title={(dotTooltip ? dotTooltip(e) : defaultTooltip(e))}
                    onClick={() => onDotClick && onDotClick(e.id)}
                    style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: DOT_COLOR_BY_TYPE[e.type] || DEFAULT_DOT_COLOR,
                      border: 'none', padding: 0,
                      cursor: onDotClick ? 'pointer' : 'default',
                      flexShrink: 0,
                    }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span style={{
                    fontSize: '8px', color: 'rgba(5,10,68,0.50)', fontWeight: 700,
                  }}>
                    +{dayEvents.length - 3}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { DOT_COLOR_BY_TYPE, DEFAULT_DOT_COLOR }
