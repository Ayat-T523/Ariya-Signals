import EmptyState from '../../ui/EmptyState'

const STRENGTH_CONFIG = {
  high:   { dot: '#0055BB', label: 'High',   labelColor: '#0055BB', bg: 'rgba(0,85,187,0.08)' },
  medium: { dot: '#1A6BFF', label: 'Medium', labelColor: '#1A6BFF', bg: 'rgba(26,107,255,0.06)' },
  low:    { dot: 'rgba(5,10,68,0.25)', label: 'Low', labelColor: 'rgba(5,10,68,0.40)', bg: 'rgba(5,10,68,0.03)' },
}

function StrengthDot({ strength }) {
  const cfg = STRENGTH_CONFIG[strength] || STRENGTH_CONFIG.low
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: cfg.dot, flexShrink: 0,
      }} />
      <span style={{ fontSize: '12px', fontWeight: 600, color: cfg.labelColor }}>
        {cfg.label}
      </span>
    </div>
  )
}

export default function ActivityByCountryTab({ competitor }) {
  const countries = competitor.activityByCountry || []

  if (!countries.length) {
    return <EmptyState message="No country-level activity data available." />
  }

  // Sort: high → medium → low
  const sorted = [...countries].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return (order[a.strength] ?? 3) - (order[b.strength] ?? 3)
  })

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      border: '1px solid rgba(5,10,68,0.08)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04)',
      overflow: 'hidden',
    }}>
      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '130px 160px 180px 1fr 100px',
        gap: '0',
        background: '#F7F8FC',
        borderBottom: '1px solid rgba(5,10,68,0.08)',
        padding: '10px 20px',
      }}>
        {['Country', 'Products', 'Patient share', 'Recent activity', 'Strength'].map((col) => (
          <p key={col} style={{
            margin: 0, fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'rgba(5,10,68,0.40)',
          }}>
            {col}
          </p>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((row, i) => {
        const cfg = STRENGTH_CONFIG[row.strength] || STRENGTH_CONFIG.low
        return (
          <div
            key={row.country}
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 160px 180px 1fr 100px',
              gap: '0',
              padding: '14px 20px',
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(5,10,68,0.05)' : 'none',
              background: cfg.bg,
              alignItems: 'start',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.85)' }}>
              {row.country}
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.65)' }}>
              {row.products?.length ? row.products.join(', ') : '—'}
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.65)', fontVariantNumeric: 'tabular-nums' }}>
              {row.estimatedPatientShare || '—'}
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.5', paddingRight: '16px' }}>
              {row.recentActivity || '—'}
            </p>
            <StrengthDot strength={row.strength} />
          </div>
        )
      })}
    </div>
  )
}
