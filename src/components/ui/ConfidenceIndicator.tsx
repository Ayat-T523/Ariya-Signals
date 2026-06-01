// ── Colour map ────────────────────────────────────────────────────────────────
// For sourceCoverage and dataFreshness: high=green, medium=amber, low=red
// For inferenceDepth: low=green (direct data — good), medium=amber, high=red (deep AI derivation)
const COLORS = {
  green: '#10B981',
  amber: '#F59E0B',
  red:   '#E11D48',
  grey:  'rgba(5,10,68,0.20)',
}

function colorFor(dimension, value) {
  if (dimension === 'inferenceDepth') {
    if (value === 'low')    return COLORS.green
    if (value === 'medium') return COLORS.amber
    if (value === 'high')   return COLORS.red
    return COLORS.grey
  }
  // sourceCoverage / dataFreshness: high is good
  if (value === 'high')   return COLORS.green
  if (value === 'medium') return COLORS.amber
  if (value === 'low')    return COLORS.red
  return COLORS.grey
}

function labelFor(dimension, value) {
  const dimLabel = {
    sourceCoverage: 'Source coverage',
    dataFreshness:  'Data freshness',
    inferenceDepth: 'Inference depth',
  }[dimension] ?? dimension
  const valLabel = value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown'
  return `${dimLabel}: ${valLabel}`
}

function Dot({ dimension, value }) {
  return (
    <span
      title={labelFor(dimension, value)}
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: colorFor(dimension, value),
        flexShrink: 0,
      }}
    />
  )
}

/**
 * Compact 3-dot indicator showing confidence dimensions.
 * Hover any dot for the dimension + level.
 */
export default function ConfidenceIndicator({ sourceCoverage, dataFreshness, inferenceDepth, showLegend = false }) {
  if (!sourceCoverage && !dataFreshness && !inferenceDepth) return null

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '11px', color: 'rgba(5,10,68,0.40)',
      }}
      title="Source coverage · Data freshness · Inference depth"
    >
      <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '10px' }}>
        Confidence
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Dot dimension="sourceCoverage" value={sourceCoverage} />
        <Dot dimension="dataFreshness"  value={dataFreshness} />
        <Dot dimension="inferenceDepth" value={inferenceDepth} />
      </span>
      {showLegend && (
        <span style={{ marginLeft: '4px', fontSize: '10px', color: 'rgba(5,10,68,0.35)' }}>
          Source coverage · Data freshness · Inference depth
        </span>
      )}
    </span>
  )
}
