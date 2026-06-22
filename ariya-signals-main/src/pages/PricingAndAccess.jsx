import pricingData from '../data/pricing.json'

export default function PricingAndAccess() {
  const { markets, rows, unit } = pricingData

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Pricing and Access — Multi-region benchmark
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
          Sources: GlobalData POLI · MMIT (US) · Illustrative
        </p>
      </div>

      {/* Illustrative-data label */}
      <div style={{
        display: 'inline-block', marginTop: '14px', marginBottom: '20px',
        padding: '4px 10px', borderRadius: '9999px',
        background: 'rgba(245,158,11,0.10)', color: '#92500A',
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
      }}>
        Illustrative data
      </div>

      {/* Table card */}
      <div style={{
        background: '#FFFFFF', borderRadius: '20px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(5,10,68,0.04)' }}>
                <th style={headerCellStyle('left')}>Product</th>
                <th style={headerCellStyle('left')}>Company</th>
                <th style={headerCellStyle('left')}>Indication</th>
                {markets.map((m) => (
                  <th key={m} style={headerCellStyle('right')}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOurs = Boolean(row.isOurs)
                return (
                  <tr
                    key={row.name}
                    style={{
                      borderTop: '1px solid rgba(5,10,68,0.06)',
                      background: isOurs ? 'rgba(0,85,187,0.06)' : 'transparent',
                    }}
                  >
                    <td style={bodyCellStyle('left', isOurs)}>
                      {row.name}
                      {isOurs && (
                        <span style={{
                          marginLeft: '8px', padding: '1px 7px', borderRadius: '9999px',
                          background: '#0055BB', color: '#FFFFFF',
                          fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                        }}>
                          OUR ASSET
                        </span>
                      )}
                    </td>
                    <td style={bodyCellStyle('left', isOurs)}>{row.company}</td>
                    <td style={{ ...bodyCellStyle('left', isOurs), fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
                      {row.indication}
                    </td>
                    {markets.map((m) => (
                      <td key={m} style={{ ...bodyCellStyle('right', isOurs), fontVariantNumeric: 'tabular-nums' }}>
                        {row.prices?.[m] ?? '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p style={{ margin: '16px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic', lineHeight: '1.55' }}>
        {unit}. Prices shown are list prices. Net prices reflect confidential rebate agreements and are not shown.
      </p>
    </div>
  )
}

function headerCellStyle(align) {
  return {
    padding: '14px 16px',
    textAlign: align,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(5,10,68,0.45)',
    whiteSpace: 'nowrap',
  }
}

function bodyCellStyle(align, isOurs) {
  return {
    padding: '14px 16px',
    textAlign: align,
    fontSize: '13px',
    fontWeight: isOurs ? 700 : 500,
    color: isOurs ? 'rgba(5,10,68,0.92)' : 'rgba(5,10,68,0.78)',
    whiteSpace: 'nowrap',
  }
}
