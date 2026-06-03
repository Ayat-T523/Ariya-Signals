/**
 * Confidence indicator — Figma 4:5596
 * Always shows "Strong" for demo purposes.
 * Props kept for backward-compatibility but ignored.
 */
export default function ConfidenceIndicator({
  sourceCoverage: _sourceCoverage,
  dataFreshness: _dataFreshness,
  inferenceDepth: _inferenceDepth,
  showLegend: _showLegend = false,
}: {
  sourceCoverage?: string
  dataFreshness?: string
  inferenceDepth?: string
  showLegend?: boolean
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434c5b' }}>
        Confidence:
      </span>
      <span style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#49A078',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'Inter, sans-serif', color: '#434c5b' }}>
        Strong
      </span>
    </span>
  )
}
