import pricingData from '../data/pricing.json'
import { useApp } from '../context/AppContext'
import { competitorsData } from '../data/kalvista'

export default function PricingAndAccess() {
  const { watchedCompetitors } = useApp()
  const { markets, rows: allRows, unit } = pricingData

  // Strict config scoping: show our asset always; competitor rows only when watched.
  // Rows key on a company-name string, so map name → competitor id via competitorsData.
  const companyToId = new Map(
    (competitorsData as Array<{ id: string; name: string }>).map(c => [c.name, c.id])
  )
  const rows = allRows.filter(r =>
    Boolean((r as any).isOurs) || watchedCompetitors.has(companyToId.get(r.company) ?? '')
  )

  return (
    <div style={{ padding: '20px 36px 36px' }}>

      {/* ── Page description ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '0 0 28px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, fontFamily: 'Satoshi, sans-serif', background: 'rgba(245,158,11,0.18)', color: '#92500A', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '1px' }}>
          Illustrative
        </span>
        <p style={{ margin: 0, fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#92500A', lineHeight: '1.5' }}>
          These are illustrative list-price estimates. Actual net prices reflect confidential managed-entry agreements with national payers and are not publicly available from any free source.
        </p>
      </div>

      {/* ── Section label ────────────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 12px',
        fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'var(--ink-600)',
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
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr style={{
                background: 'rgba(5,10,68,0.03)',
                borderBottom: '1px solid rgba(210,226,255,1)',
              }}>
                <th style={{ ...headerCellStyle('left'), position: 'sticky', left: 0, zIndex: 2, background: 'rgba(5,10,68,0.03)' }}>Product</th>
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
                    {/* Product name + badges — sticky first column */}
                    <td style={{ ...bodyCellStyle('left', isOurs), position: 'sticky', left: 0, zIndex: 1, background: isOurs ? 'rgba(42,118,244,0.06)' : '#FFFFFF' }}>
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
                      {(row as any).isIllustrative && (
                        <span style={{
                          marginLeft: '6px',
                          padding: '2px 6px', borderRadius: '6px',
                          background: 'rgba(245,158,11,0.12)', color: '#92500A',
                          fontSize: '10px', fontWeight: 700,
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          Illustrative
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
        {unit}
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
