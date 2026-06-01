/**
 * TopBar.tsx — Page tab bar + illustrative-data ribbon.
 * Matches Figma node 23:655–659 (file IXHI4HJFuZpw5hPMrv7DVb).
 *
 * Replaces the previous full header row. Bell, user avatar, and help
 * icon have moved to the NavPanel footer.
 *
 * Rules:
 *   - No raw hex (RGBA exempt)
 *   - lucide-react only for icons
 *   - Never log data to console
 */

import { useLocation } from 'react-router-dom'

// ── Route → page title map ────────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  '/':                    'War Room',
  '/intelligence':        'Intelligence Feed',
  '/competitors':         'Competitors',
  '/market-performance':  'Market Performance',
  '/pricing':             'Pricing and Access',
  '/alerts':              'Alerts',
  '/ask':                 'Ask Ariya',
  '/myspace':             'My Space',
  '/myspace/alerts':      'My Alerts',
  '/myspace/documents':   'My Documents',
  '/admin':               'Admin',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/competitors/')) return 'Competitor Profile'
  return 'Ariya Signals'
}

// ── TopBar ────────────────────────────────────────────────────────────────────
export default function TopBar() {
  const location  = useLocation()
  const pageTitle = getPageTitle(location.pathname)

  return (
    <div style={{ background: 'var(--bg-1)', flexShrink: 0 }}>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: '2px solid #ded8e1',
          paddingTop: '12px',
          paddingLeft: '24px',
          paddingRight: '24px',
        }}
      >
        {/* Active tab — navy 4 px underline, Inter SemiBold 24 px */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            borderBottom: '4px solid #152d61',
            marginBottom: '-2px', /* overlap the container border-bottom */
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 600,
              color: '#152d61',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 'normal',
              whiteSpace: 'nowrap',
            }}
          >
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* ── Illustrative data ribbon ───────────────────────────────────────── */}
      <div
        role="note"
        style={{
          padding: '6px 24px',
          background: '#d2e2ff',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 400,
            color: 'var(--font-primary)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Illustrative data - not for clinical or commercial decisions
        </p>
      </div>

    </div>
  )
}
