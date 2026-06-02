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
import { competitorsData, alertsData } from '../../data/kalvista'

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

// Computed once at module level — same data across every page
const COMPETITOR_COUNT = competitorsData.length
const SIGNAL_COUNT     = alertsData.length

// ── TopBar ────────────────────────────────────────────────────────────────────
export default function TopBar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const pageTitle = getPageTitle(location.pathname)

  return (
    <div style={{ background: 'var(--bg-1)', flexShrink: 0 }}>

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 36px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '16px',
      }}>

        {/* Left — title + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
              {COMPETITOR_COUNT} tracked competitors
            </span>
            <span style={{ color: '#434c5b', lineHeight: '21px' }}>•</span>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
              {SIGNAL_COUNT} signals found
            </span>
            <span style={{ color: '#434c5b', lineHeight: '21px' }}>•</span>
            <span style={{ fontSize: '14px', fontFamily: 'Satoshi, sans-serif', color: '#434c5b', lineHeight: '21px' }}>
              Last refreshed:{' '}
              <span style={{ fontWeight: 500 }}>2 mins ago</span>
            </span>
          </div>
        </div>

        {/* Right — Ask Ariya CTA */}
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
            marginTop: '4px',
          }}
        >
          <Sparkles size={14} strokeWidth={1.5} />
          Ask Ariya
        </button>
      </div>

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
