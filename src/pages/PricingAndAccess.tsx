import pricingData from '../data/pricing.json'

export default function PricingAndAccess() {
  const { markets, rows, unit } = pricingData

  return (
    <div style={{ padding: '20px 36px 36px' }}>

      {/* ── Page description ─────────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 28px',
        fontSize: '14px', fontFamily: 'Inter, sans-serif',
        color: '#434c5b', lineHeight: '1.5',
      }}>
        Multi-region benchmark · Sources: GlobalData POLI · MMIT (US) · Illustrative
      </p>

      {/* ── Section label ────────────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 12px',
        fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.40)',
      }}>
        Price comparison
      </p>

      {/* ── Table card ───────────────────────────────────────────────────────── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(210,226,255,1)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                background: 'rgba(5,10,68,0.03)',
                borderBottom: '1px solid rgba(210,226,255,1)',
              }}>
                <th style={headerCellStyle('left')}>Product</th>
                <th style={headerCellStyle('left')}>Company</th>
                <th style={headerCellStyle('left')}>Indication</th>
                {markets.map((m) => (
                  <th key={m} style={headerCellStyle('right')}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isOurs = Boolean(row.isOurs)
                const isLast = ri === rows.length - 1
                return (
                  <tr
                    key={row.name}
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid rgba(5,10,68,0.05)',
                      background: isOurs ? 'rgba(42,118,244,0.06)' : 'transparent',
                    }}
                  >
                    {/* Product name + badge */}
                    <td style={bodyCellStyle('left', isOurs)}>
                      <span style={{ fontFamily: 'Satoshi, sans-serif' }}>{row.name}</span>
                      {isOurs && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 8px', borderRadius: '6px',
                          background: 'rgba(42,118,244,0.15)', color: '#2A76F4',
                          fontSize: '11px', fontWeight: 600,
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          Our asset
                        </span>
                      )}
                    </td>

                    {/* Company */}
                    <td style={bodyCellStyle('left', isOurs)}>
                      {row.company}
                    </td>

                    {/* Indication — secondary weight */}
                    <td style={{
                      ...bodyCellStyle('left', isOurs),
                      fontWeight: 400,
                      color: 'rgba(5,10,68,0.65)',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {row.indication}
                    </td>

                    {/* Price cells */}
                    {markets.map((m) => (
                      <td key={m} style={{
                        ...bodyCellStyle('right', isOurs),
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'Inter, sans-serif',
                      }}>
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

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <p style={{
        margin: '12px 0 0',
        fontSize: '13px', fontFamily: 'Inter, sans-serif',
        color: 'rgba(5,10,68,0.55)',
        fontStyle: 'italic', lineHeight: '1.55',
      }}>
        {unit}. Prices shown are list prices. Net prices reflect confidential rebate agreements and are not shown.
      </p>

    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function headerCellStyle(align) {
  return {
    padding: '12px 16px',
    textAlign: align,
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: 'Inter, sans-serif',
    textTransform: 'uppercase',
    letterSpacing: '0.09em',
    color: 'rgba(5,10,68,0.50)',
    whiteSpace: 'nowrap',
  }
}

function bodyCellStyle(align, isOurs) {
  return {
    padding: '13px 16px',
    textAlign: align,
    fontSize: '13px',
    fontFamily: 'Satoshi, sans-serif',
    fontWeight: isOurs ? 600 : 400,
    color: isOurs ? '#434c5b' : 'rgba(5,10,68,0.75)',
    whiteSpace: 'nowrap',
  }
}
