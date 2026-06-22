import { useState } from 'react'
import { Mic2, FileText, ShieldCheck, Building2, BarChart2, Calendar } from 'lucide-react'
import EmptyState from '../../ui/EmptyState'
import { formatDateAbs } from '../../../utils/formatDate'

const FILTER_OPTIONS = ['All', 'Conferences', 'Publications', 'Regulatory', 'Corporate']

const EVENT_TYPE_MAP = {
  conference:  { label: 'Conference',  icon: Mic2,        color: '#0055BB',            bg: 'rgba(0,85,187,0.10)'  },
  publication: { label: 'Publication', icon: FileText,     color: '#0055BB',            bg: 'rgba(0,85,187,0.10)'  },
  regulatory:  { label: 'Regulatory',  icon: ShieldCheck,  color: '#050A44',            bg: 'rgba(5,10,68,0.08)'   },
  corporate:   { label: 'Corporate',   icon: Building2,    color: 'rgba(5,10,68,0.60)', bg: 'rgba(5,10,68,0.06)'   },
  earnings:    { label: 'Corporate',   icon: BarChart2,    color: 'rgba(5,10,68,0.60)', bg: 'rgba(5,10,68,0.06)'   },
}

function getEventConfig(type) {
  return EVENT_TYPE_MAP[type?.toLowerCase()] || {
    label: type || 'Event', icon: Calendar, color: 'rgba(5,10,68,0.50)', bg: 'rgba(5,10,68,0.06)',
  }
}

function filterMatches(filterLabel, eventType) {
  if (filterLabel === 'All') return true
  const t = (eventType || '').toLowerCase()
  if (filterLabel === 'Conferences')  return t === 'conference'
  if (filterLabel === 'Publications') return t === 'publication'
  if (filterLabel === 'Regulatory')   return t === 'regulatory'
  if (filterLabel === 'Corporate')    return t === 'corporate' || t === 'earnings' || t === 'investor'
  return false
}

function EventCard({ event }) {
  const cfg = getEventConfig(event.type)
  const Icon = cfg.icon

  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      padding: '16px 0',
      borderBottom: '1px solid rgba(5,10,68,0.05)',
    }}>
      {/* Type icon */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px',
        background: cfg.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={cfg.color} strokeWidth={1.8} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: cfg.color,
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.35)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.45)' }}>
            {formatDateAbs(event.date)}
          </span>
          {event.source && (
            <>
              <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.35)' }}>·</span>
              <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>
                {event.source}
              </span>
            </>
          )}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)', lineHeight: '1.4' }}>
          {event.headline}
        </p>
        {event.summary && (
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.60)', lineHeight: '1.6' }}>
            {event.summary}
          </p>
        )}
      </div>
    </div>
  )
}

export default function KeyEventsTab({ competitor }) {
  const [activeFilter, setActiveFilter] = useState('All')

  const events = [...(competitor.keyEvents || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  )

  const filtered = events.filter((e) => filterMatches(activeFilter, e.type))

  return (
    <div>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt
          return (
            <button
              key={opt}
              onClick={() => setActiveFilter(opt)}
              style={{
                padding: '5px 14px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 600,
                border: isActive ? '1.5px solid #050A44' : '1.5px solid rgba(5,10,68,0.12)',
                background: isActive ? '#050A44' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {/* Events */}
      {filtered.length === 0 ? (
        <EmptyState message={`No ${activeFilter.toLowerCase()} events recorded.`} />
      ) : (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid rgba(5,10,68,0.08)',
          boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04)',
          padding: '0 20px',
        }}>
          {filtered.map((event, i) => (
            <EventCard key={i} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
