/**
 * Competitor logo badge.
 * If a logo SVG exists for the company (matched by id or name), renders it.
 * Falls back to an initials circle for companies without a logo.
 *
 * Props:
 *   name  — display name (used for alt text and initials fallback)
 *   id    — optional competitor id (e.g. "takeda", "pharvaris")
 *   size  — pixel diameter (default 40)
 */

// ── Logo assets map (id → public path) ───────────────────────────────────────
const LOGOS_BY_ID: Record<string, string> = {
  'takeda':      '/logos/logo-takeda.svg',
  'pharvaris':   '/logos/logo-pharvaris.svg',
  'biocryst':    '/logos/logo-biocryst.svg',
  'csl-behring': '/logos/logo-csl-behring.svg',
  'ionis':       '/logos/logo-ionis.svg',
  'astria':      '/logos/logo-astria.svg',
}

// Reverse map: display name → id  (so callers that pass only `name` also resolve)
const NAME_TO_ID: Record<string, string> = {
  'Takeda':                  'takeda',
  'Pharvaris':               'pharvaris',
  'BioCryst':                'biocryst',
  'CSL Behring':             'csl-behring',
  'Ionis Pharmaceuticals':   'ionis',
  'Astria Therapeutics':     'astria',
}

export default function CompetitorBadge({
  name,
  id,
  size = 40,
}: {
  name: string
  id?: string
  size?: number
}) {
  const resolvedId = id ?? NAME_TO_ID[name]
  const logoSrc    = resolvedId ? LOGOS_BY_ID[resolvedId] : undefined

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={name}
        aria-label={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'block',
          flexShrink: 0,
          objectFit: 'cover',
          userSelect: 'none',
        }}
      />
    )
  }

  // ── Initials fallback ─────────────────────────────────────────────────────
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
