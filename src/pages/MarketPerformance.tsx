import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { marketPerformanceData } from '../data/kalvista'

type Market = 'US' | 'UK' | 'DE'

interface MarketSlice {
  months: string[]
  series: { ekterly: number[]; takhzyro: number[]; orladeyo: number[] }
  kpis: { newStarts: number; switchingRate: number; marketShare: number }
}

// ── Design helpers ─────────────────────────────────────────────────────────────
const CARD: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(210,226,255,1)',
  borderRadius: '12px',
  padding: '20px 24px',
}

// ── Chart colours — WCAG AA on white background ────────────────────────────────
const C = {
  ekterly:  '#1F6FEB',   // blue — own product
  takhzyro: '#C0432E',   // red-brown — main incumbent
  orladeyo: '#4F7EA7',   // slate blue — secondary
  other:    '#A0AEC0',   // neutral grey
}

// ── Bar chart data (US, Apr 2026 — numbers sum to 100%) ────────────────────────
const SHARE_US = [
  { product: 'Takhzyro',  share: 54.5, fill: C.takhzyro },
  { product: 'Orladeyo',  share: 23.5, fill: C.orladeyo },
  { product: 'Ekterly',   share: 19.5, fill: C.ekterly  },
  { product: 'Other',     share:  2.5, fill: C.other    },
]

// ── Source badge ──────────────────────────────────────────────────────────────
function SourceBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px',
      background: 'rgba(42,118,244,0.08)',
      border: '1px solid rgba(42,118,244,0.20)',
      borderRadius: '999px',
      fontSize: '11px', fontWeight: 600,
      fontFamily: 'Inter, sans-serif',
      color: '#1F6FEB',
      letterSpacing: '0.02em',
    }}>
      {label}
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ ...CARD, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <p style={{
        margin: 0, fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.40)', fontFamily: 'Satoshi, sans-serif',
      }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontSize: '28px', fontWeight: 600,
        fontFamily: 'Satoshi, sans-serif', color: '#10224A', lineHeight: '1',
      }}>
        {value}
      </p>
      <p style={{
        margin: 0, fontSize: '12px',
        fontFamily: 'Inter, sans-serif', color: 'rgba(5,10,68,0.50)',
      }}>
        {sub}
      </p>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 4px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color: 'rgba(5,10,68,0.40)',
    }}>
      {children}
    </p>
  )
}

const TICK = { fontSize: 11, fill: 'rgba(5,10,68,0.45)', fontFamily: 'Inter, sans-serif' }
const TOOLTIP_STYLE = {
  fontSize: 12, fontFamily: 'Inter, sans-serif',
  borderColor: 'rgba(210,226,255,1)', borderRadius: 8,
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MarketPerformance() {
  const [market, setMarket] = useState<Market>('US')
  const d = (marketPerformanceData as Record<string, MarketSlice>)[market]

  // Line chart rows
  const lineData = d.months.map((month, i) => ({
    month,
    Ekterly:  d.series.ekterly[i],
    Takhzyro: d.series.takhzyro[i],
  }))

  // TRx growth MoM
  const latest = d.series.ekterly[d.series.ekterly.length - 1]
  const prev   = d.series.ekterly[d.series.ekterly.length - 2]
  const trxGrowthStr = prev > 0 ? `+${((latest - prev) / prev * 100).toFixed(1)}%` : 'N/A'

  return (
    <div style={{ padding: '20px 36px 36px' }}>

      {/* ── Source badges ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <SourceBadge label="IQVIA DE / UK / US" />
        <SourceBadge label="Veeva CRM" />
        <SourceBadge label="Movianto logistics" />
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <KpiCard
          label="Ekterly market share"
          value={`${d.kpis.marketShare}%`}
          sub="of total addressable HAE population"
        />
        <KpiCard
          label="TRx growth MoM"
          value={trxGrowthStr}
          sub="Apr vs Mar 2026"
        />
        <KpiCard
          label="New patient starts"
          value={d.kpis.newStarts.toString()}
          sub={`${d.kpis.switchingRate}% switching from a competitor`}
        />
      </div>

      {/* ── Market selector ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['US', 'UK', 'DE'] as Market[]).map(m => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            style={{
              padding: '6px 18px',
              background: market === m ? '#10224A' : 'transparent',
              border: `1px solid ${market === m ? '#10224A' : 'rgba(210,226,255,1)'}`,
              borderRadius: '8px',
              fontSize: '13px', fontWeight: 600,
              fontFamily: 'Satoshi, sans-serif',
              color: market === m ? '#ffffff' : 'rgba(5,10,68,0.55)',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Line chart ────────────────────────────────────────────────────────── */}
      <div style={{ ...CARD, marginBottom: '20px' }}>
        <SectionLabel>Ekterly TRx volume — trailing 12 months · {market}</SectionLabel>
        <p style={{
          margin: '0 0 16px', fontSize: '13px',
          fontFamily: 'Inter, sans-serif', color: 'rgba(5,10,68,0.50)',
        }}>
          Monthly prescriptions vs leading competitor · HAE prophylaxis class
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lineData} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(5,10,68,0.06)" />
            <XAxis dataKey="month" tick={TICK} />
            <YAxis tick={TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter, sans-serif' }} />
            <Line
              type="monotone" dataKey="Ekterly"
              stroke={C.ekterly} strokeWidth={2.5}
              dot={false} activeDot={{ r: 4 }}
            />
            <Line
              type="monotone" dataKey="Takhzyro"
              stroke={C.takhzyro} strokeWidth={2}
              dot={false} activeDot={{ r: 4 }}
              strokeDasharray="5 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bar chart ─────────────────────────────────────────────────────────── */}
      <div style={{ ...CARD, marginBottom: '20px' }}>
        <SectionLabel>Market share by product — HAE prophylaxis · US</SectionLabel>
        <p style={{
          margin: '0 0 16px', fontSize: '13px',
          fontFamily: 'Inter, sans-serif', color: 'rgba(5,10,68,0.50)',
        }}>
          Share of total prophylaxis prescriptions · Apr 2026
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={SHARE_US} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(5,10,68,0.06)" vertical={false} />
            <XAxis dataKey="product" tick={({ ...TICK, fontSize: 12 } as object)} />
            <YAxis unit="%" tick={TICK} domain={[0, 65]} />
            <Tooltip
              formatter={(v: unknown) => [`${v}%`, 'Market share']}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar dataKey="share" radius={([4, 4, 0, 0] as unknown as number)}>
              {SHARE_US.map(entry => (
                <Cell key={entry.product} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Illustrative caption ──────────────────────────────────────────────── */}
      <p style={{
        margin: 0, fontSize: '11px',
        fontFamily: 'Inter, sans-serif',
        color: 'rgba(5,10,68,0.35)',
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        Illustrative data for demonstration purposes. Not for clinical or commercial decisions.
      </p>

    </div>
  )
}
