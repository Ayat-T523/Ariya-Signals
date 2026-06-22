/**
 * Confidence indicator — two real dimensions only.
 * sourceCoverage: % of watched competitors with a live signal in 90d
 * dataFreshness:  age of the newest signal
 *
 * Score per dimension: high=2, medium=1, low=0. Max=4.
 * Total ≥ 3 → Strong · ≥ 2 → Good · ≥ 1 → Moderate · 0 → Limited
 */
const SCORE: Record<string, number> = { high: 2, medium: 1, low: 0 }

const TIERS = [
  { min: 3, label: 'Strong',   color: '#49A078' },
  { min: 2, label: 'Good',     color: '#2A76F4' },
  { min: 1, label: 'Moderate', color: '#D97706' },
  { min: 0, label: 'Limited',  color: '#C01041' },
]

export default function ConfidenceIndicator({
  sourceCoverage = 'high',
  dataFreshness  = 'high',
}: {
  sourceCoverage?: string
  dataFreshness?: string
}) {
  const score = (SCORE[sourceCoverage] ?? 2) + (SCORE[dataFreshness] ?? 2)
  const tier  = TIERS.find(t => score >= t.min) ?? TIERS[TIERS.length - 1]

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434c5b' }}>
        Confidence:
      </span>
      <span style={{
        display: 'inline-block',
        width: '8px', height: '8px', borderRadius: '50%',
        background: tier.color, flexShrink: 0,
      }} />
      <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434c5b' }}>
        {tier.label}
      </span>
    </span>
  )
}
