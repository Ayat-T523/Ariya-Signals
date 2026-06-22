/**
 * Initials-based competitor logo placeholder (D-001 / §7.2).
 * Navy circle, white letter. Same size and treatment everywhere.
 */
export default function CompetitorBadge({ name, size = 40 }) {
  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#050A44',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: '-0.5px',
        userSelect: 'none',
      }}
    >
      {name?.charAt(0).toUpperCase()}
    </div>
  )
}
