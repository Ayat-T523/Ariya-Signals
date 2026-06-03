/**
 * TopBar.tsx — Global page header.
 * Matches Figma node 77:1956 (file IXHI4HJFuZpw5hPMrv7DVb).
 *
 * Layout:
 *   [page title 32px Satoshi Medium] [stats row 14px]   [Ask Ariya CTA →]
 *   [illustrative data ribbon]
 *
 * Rules:
 *   - No raw hex (RGBA exempt)
 *   - lucide-react only for icons
 *   - Never log data to console
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
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
  const navigate  = useNavigate()
  const pageTitle = getPageTitle(location.pathname)

  // Competitor profile pages have their own sticky header — suppress the global title row
  const isCompetitorProfile = location.pathname.startsWith('/competitors/') &&
    location.pathname.length > '/competitors/'.length

  // On the Ask Ariya page itself, the Ask Ariya button is redundant
  const isAskPage = location.pathname === '/ask'

  return (
    <div style={{ background: 'var(--bg-1)', flexShrink: 0 }}>

      {/* ── Header row (hidden on competitor profile pages) ────────────────── */}
      {!isCompetitorProfile && (
        <div style={{
          padding: '8px 36px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px',
        }}>

          {/* Left — title */}
          <h1 style={{
            margin: 0,
            fontSize: '32px', fontWeight: 500,
            fontFamily: 'Satoshi, sans-serif',
            color: '#434c5b',
            lineHeight: '38.4px',
            whiteSpace: 'nowrap',
          }}>
            {pageTitle}
          </h1>

          {/* Right — Ask Ariya CTA (hidden when already on the Ask page) */}
          {!isAskPage && (
            <button
              onClick={() => navigate('/ask')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px',
                background: '#10224a',
                border: 'none', borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px', fontWeight: 500,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Sparkles size={14} strokeWidth={1.5} />
              Ask Ariya
            </button>
          )}
        </div>
      )}

      {/* ── Illustrative data ribbon ───────────────────────────────────────── */}
      <div
        role="note"
        style={{ padding: '6px 24px', background: '#d2e2ff' }}
      >
        <p style={{
          margin: 0,
          fontSize: '12px', fontWeight: 400,
          color: 'var(--font-primary)',
          fontFamily: 'Inter, sans-serif',
        }}>
          Illustrative data - not for clinical or commercial decisions
        </p>
      </div>

    </div>
  )
}
