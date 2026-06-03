import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import EmptyState from '../../ui/EmptyState'
import { formatDateAbs } from '../../../utils/formatDate'

// ── Revenue chart (per D-003) ─────────────────────────────────────────────────
function RevenueChart({ data }) {
  if (!data?.length) return null

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: '#050A44', color: '#fff', borderRadius: '8px',
          padding: '8px 12px', fontSize: '12px',
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
          <p style={{ margin: '2px 0 0', opacity: 0.8 }}>${payload[0].value}M (illustrative)</p>
        </div>
      )
    }
    return null
  }

  return (
    <div>
      {/* Y-axis label per D-003 */}
      <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'rgba(5,10,68,0.40)', fontWeight: 500 }}>
        Revenue (USD M, illustrative)
      </p>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0055BB" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#0055BB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: 'rgba(5,10,68,0.40)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'rgba(5,10,68,0.40)' }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone" dataKey="revenue"
            stroke="#0055BB" strokeWidth={2}
            fill="url(#rev-gradient)" dot={false}
            activeDot={{ r: 4, fill: '#0055BB', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Single product card ───────────────────────────────────────────────────────
function ProductCard({ product }) {
  const routeColor = product.route?.toLowerCase().includes('oral')
    ? { bg: 'rgba(0,85,187,0.10)', text: '#0055BB' }
    : { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.65)' }

  const indicationColor = product.indication?.toLowerCase().includes('on-demand')
    ? { bg: 'rgba(0,85,187,0.10)', text: '#0055BB' }
    : { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.65)' }

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      border: '1px solid rgba(210,226,255,1)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04)',
      padding: '24px',
    }}>
      {/* Product header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
            {product.name}
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.50)' }}>
            {product.molecule}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, ...routeColor }}>
            {product.route}
          </span>
          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, ...indicationColor }}>
            {product.indication}
          </span>
        </div>
      </div>

      {/* Mechanism + meta */}
      <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.5' }}>
        {product.mechanism}
      </p>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '12px 0 16px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>Approved</p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.80)', fontVariantNumeric: 'tabular-nums' }}>{product.approvalYear}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>Markets</p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.80)' }}>{product.geographies?.join(', ')}</p>
        </div>
      </div>

      {/* Revenue chart */}
      {product.revenueTrend?.length > 0 && (
        <div style={{ marginBottom: '20px', paddingTop: '8px', borderTop: '1px solid rgba(5,10,68,0.06)' }}>
          <RevenueChart data={product.revenueTrend} />
        </div>
      )}

      {/* Label updates */}
      {product.labelUpdates?.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(5,10,68,0.06)', paddingTop: '16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
            Label updates
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {product.labelUpdates.map((update, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                  {formatDateAbs(update.date)}
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'rgba(5,10,68,0.80)' }}>
                    {update.change}
                  </p>
                  {update.implication && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.5' }}>
                      {update.implication}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function MarketedProductsTab({ competitor }) {
  const products = competitor.marketedProducts || []

  if (!products.length) {
    return (
      <EmptyState message={`No marketed HAE products. Lead asset in late-stage development — see Pipeline tab.`} />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {products.map((product) => (
        <ProductCard key={product.name} product={product} />
      ))}
    </div>
  )
}
