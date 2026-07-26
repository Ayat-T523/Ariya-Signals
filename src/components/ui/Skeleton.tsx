import { REDUCED_MOTION } from '../../lib/motion'

// ── Base primitive ────────────────────────────────────────────────────────────
interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        flexShrink: 0,
        background: REDUCED_MOTION
          ? 'rgba(5,10,68,0.07)'
          : 'linear-gradient(90deg, rgba(5,10,68,0.07) 25%, rgba(5,10,68,0.03) 50%, rgba(5,10,68,0.07) 75%)',
        backgroundSize: REDUCED_MOTION ? undefined : '200% 100%',
        animation: REDUCED_MOTION ? undefined : 'ariya-shimmer 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

// ── KPI card row (War Room top strip) ─────────────────────────────────────────
export function SkeletonKpiRow() {
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          background: '#F4F8FE',
          border: '1px solid #87B2FA',
          borderRadius: '16px',
          padding: '8px',
          display: 'flex', gap: '6px', alignItems: 'flex-start',
          minWidth: '200px',
        }}>
          <Skeleton width={20} height={20} radius={4} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Skeleton width={110} height={13} radius={4} />
              <Skeleton width={12} height={12} radius="50%" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Skeleton width={38} height={21} radius={4} />
              <Skeleton width={70} height={22} radius={8} />
            </div>
            <Skeleton width={90} height={13} radius={4} />
          </div>
        </div>
      ))}
      <Skeleton width={140} height={11} radius={4} style={{ marginLeft: 'auto' }} />
    </div>
  )
}

// ── Signal list rows (War Room top-signals panel) ─────────────────────────────
export function SkeletonSignalList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            padding: '16px 0', minHeight: '80px',
          }}>
            <Skeleton width={28} height={28} radius="50%" style={{ flexShrink: 0, marginTop: '3px' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Skeleton height={14} width="75%" radius={4} />
              <Skeleton height={13} width="90%" radius={4} />
              <Skeleton height={13} width="65%" radius={4} />
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
              gap: '6px', flexShrink: 0, alignSelf: 'stretch',
            }}>
              <Skeleton width={54} height={26} radius={6} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                <Skeleton width={28} height={13} radius={4} />
                <Skeleton width={60} height={13} radius={4} />
              </div>
            </div>
          </div>
          {i < count - 1 && (
            <div style={{ height: '1px', background: 'rgba(42,118,244,0.15)' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Competitor quadrant grid (War Room tracked competitors) ───────────────────
const QUADRANT_TINTS = [
  'rgba(42,118,244,0.15)',
  'rgba(183,63,84,0.15)',
  'rgba(250,174,54,0.15)',
  'rgba(67,76,91,0.16)',
] as const

function SkeletonQuadrantCard({ tint }: { tint: string }) {
  return (
    <div style={{
      background: tint,
      borderRadius: '16px',
      padding: '10px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <Skeleton height={16} width="55%" radius={4} />
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '8px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <Skeleton height={26} width={100} radius={8} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Skeleton width={20} height={20} radius="50%" />
            <Skeleton height={13} width="60%" radius={4} />
          </div>
          <Skeleton height={13} width="100%" radius={4} />
          <Skeleton height={13} width="85%" radius={4} />
          <Skeleton height={13} width="70%" radius={4} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <Skeleton height={12} width={50} radius={3} />
            <Skeleton height={14} width={60} radius={4} />
          </div>
          <div style={{ width: '1px', height: '48px', background: 'rgba(5,10,68,0.06)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <Skeleton height={12} width={60} radius={3} />
            <Skeleton height={14} width={40} radius={4} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonQuadrantGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {QUADRANT_TINTS.map((tint, i) => (
        <SkeletonQuadrantCard key={i} tint={tint} />
      ))}
    </div>
  )
}

// ── Market weather body (War Room right panel, below the title) ───────────────
export function SkeletonMarketWeatherBody() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Skeleton height={12} width="55%" radius={4} />
          <Skeleton height={24} width={110} radius={8} />
        </div>
        <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Skeleton height={13} width="100%" radius={4} />
              <Skeleton height={13} width={`${85 - i * 8}%`} radius={4} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)' }} />
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton height={12} width="45%" radius={4} />
        <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Skeleton height={13} width="95%" radius={4} />
              <Skeleton height={13} width={`${78 - i * 7}%`} radius={4} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Upcoming events body (War Room events panel) ──────────────────────────────
function SkeletonEventRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      border: '1px solid rgba(210,226,255,1)', borderRadius: '8px',
      padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', flex: 1, gap: '12px', alignItems: 'flex-start', minWidth: 0 }}>
        <div style={{
          width: 51, height: 51, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <Skeleton height={14} width={40} radius={4} />
          <Skeleton height={20} width={28} radius={4} />
        </div>
        <div style={{ width: 1, height: 51, background: 'rgba(210,226,255,1)', flexShrink: 0, alignSelf: 'center' }} />
        <div style={{ flexShrink: 0, height: 51, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Skeleton height={14} width={70} radius={4} />
          <Skeleton height={12} width={55} radius={4} />
        </div>
        <div style={{ flex: 1, height: 51, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
          <div style={{ padding: '4px 12px' }}>
            <Skeleton height={14} width="80%" radius={4} />
          </div>
          <div style={{ padding: '0 12px' }}>
            <Skeleton height={12} width="50%" radius={4} />
          </div>
        </div>
      </div>
      <Skeleton width={80} height={24} radius={6} style={{ alignSelf: 'center', flexShrink: 0 }} />
    </div>
  )
}

export function SkeletonEventList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[0, 1].map(month => (
        <div key={month} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ borderBottom: '2px solid #DED8E1', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 16px' }}>
              <Skeleton height={14} width={70} radius={4} />
              <Skeleton height={24} width={130} radius={8} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[0, 1, 2].map(i => <SkeletonEventRow key={i} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Competitor card grid (Competitors page) ───────────────────────────────────
function SkeletonCompetitorCard() {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid rgba(5,10,68,0.08)',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
        <Skeleton width={48} height={48} radius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
          <Skeleton height={15} width="70%" radius={4} />
          <Skeleton height={12} width="50%" radius={4} />
          <Skeleton height={22} width={90} radius={9999} />
        </div>
      </div>
      <Skeleton height={13} width="100%" radius={4} style={{ marginBottom: '5px' }} />
      <Skeleton height={13} width="85%" radius={4} style={{ marginBottom: '20px' }} />
      <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
        {[0, 1, 2].map(j => (
          <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Skeleton height={11} width={50} radius={3} />
            <Skeleton height={16} width={40} radius={4} />
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid rgba(5,10,68,0.06)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton height={11} width="40%" radius={3} />
        <Skeleton height={13} width="90%" radius={4} />
        <Skeleton height={13} width="72%" radius={4} />
      </div>
    </div>
  )
}

export function SkeletonCompetitorGrid({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCompetitorCard key={i} />
      ))}
      <div style={{
        border: '1px dashed rgba(210,226,255,1)',
        borderRadius: '16px', padding: '10px',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: 'rgba(112,128,144,0.10)',
          borderRadius: '12px', flex: 1, minHeight: '160px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
        }}>
          <Skeleton width={32} height={32} radius={9999} />
          <Skeleton height={20} width={120} radius={4} />
          <Skeleton height={14} width={140} radius={4} />
        </div>
      </div>
    </div>
  )
}

// ── Alert card list (Alerts page) ─────────────────────────────────────────────
function SkeletonAlertCard() {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid rgba(5,10,68,0.08)',
      borderRadius: '16px',
      padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(5,10,68,0.04)',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Skeleton width={32} height={32} radius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton height={14} width="72%" radius={4} />
          <Skeleton height={12} width="45%" radius={4} />
        </div>
        <Skeleton width={60} height={22} radius={9999} />
      </div>
      <Skeleton height={13} width="100%" radius={4} />
      <Skeleton height={13} width="88%" radius={4} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Skeleton height={26} width={90} radius={6} />
        <Skeleton height={26} width={110} radius={6} />
        <Skeleton height={26} width={75} radius={6} />
      </div>
    </div>
  )
}

export function SkeletonAlertList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonAlertCard key={i} />
      ))}
    </div>
  )
}

// ── Portal event list (Intelligence portal page) ──────────────────────────────
function SkeletonPortalEventCard() {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(210,226,255,1)',
      borderRadius: '12px',
      padding: '0 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 0' }}>
        <Skeleton width={36} height={36} radius="50%" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Skeleton height={14} width="55%" radius={4} />
            <Skeleton height={22} width={90} radius={9999} />
          </div>
          <Skeleton height={13} width="80%" radius={4} />
          <Skeleton height={13} width="60%" radius={4} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <Skeleton height={22} width={70} radius={4} />
            <Skeleton height={22} width={90} radius={4} />
          </div>
        </div>
        <Skeleton width={80} height={22} radius={9999} style={{ flexShrink: 0 }} />
      </div>
    </div>
  )
}

export function SkeletonPortalList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} height={30} width={90} radius={9999} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <Skeleton height={14} width={120} radius={4} />
        <div style={{ flex: 1, height: '1px', background: 'rgba(5,10,68,0.07)' }} />
      </div>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonPortalEventCard key={i} />
      ))}
    </div>
  )
}

// ── Ask Ariya response text (AskModal) ────────────────────────────────────────
export function SkeletonAskResponse() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Skeleton height={13} width="98%" radius={4} />
      <Skeleton height={13} width="85%" radius={4} />
      <Skeleton height={13} width="92%" radius={4} />
      <Skeleton height={13} width="78%" radius={4} />
      <div style={{ height: '4px' }} />
      <Skeleton height={13} width="95%" radius={4} />
      <Skeleton height={13} width="88%" radius={4} />
      <Skeleton height={13} width="65%" radius={4} />
    </div>
  )
}

// ── Generic chart block ───────────────────────────────────────────────────────
export function SkeletonChart({ height = 180 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Skeleton height={13} width="40%" radius={4} />
      <Skeleton height={height} width="100%" radius={8} />
    </div>
  )
}
