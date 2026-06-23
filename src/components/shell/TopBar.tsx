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

import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useApp, useConfig } from '../../context/AppContext'

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

// ── Per-page subtitle stats (hard-coded from demo snapshot 2026-04-21) ────────
const TRACKED_COMPETITOR_COUNT = 8
const SIGNAL_COUNT             = 17
const UPCOMING_EVENT_COUNT     = 11
const REPORT_COUNT             = 13
const MARKET_DEV_COUNT         = 23
const COMPETITOR_COUNT         = 8

function getPageSubtitle(pathname: string, assetName: string, indication: string, watchedCount: number): string | null {
  if (pathname === '/') {
    return `${assetName} · ${indication} · ${TRACKED_COMPETITOR_COUNT} tracked competitors · ${SIGNAL_COUNT} signals on file`
  }
  if (pathname === '/intelligence') {
    return `${UPCOMING_EVENT_COUNT} upcoming events · ${REPORT_COUNT} reports · ${MARKET_DEV_COUNT} market developments`
  }
  if (pathname === '/competitors') {
    return `${watchedCount} competitor${watchedCount !== 1 ? 's' : ''} tracked · ${indication} therapeutic area`
  }
  return null
}

// ── Static fallback button (shown before Lottie loads) ───────────────────────
function StaticAskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '6px 16px',
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
      Ask Ariya
    </button>
  )
}

function AskAriyaButton({ onClick }: { onClick: () => void }) {
  return <StaticAskButton onClick={onClick} />
}

// ── TopBar ────────────────────────────────────────────────────────────────────
export default function TopBar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { openMobileNav, watchedCompetitors } = useApp()
  const { assetName, indication } = useConfig()
  const pageTitle = getPageTitle(location.pathname)

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 767)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches)
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Competitor profile pages have their own sticky header — suppress the global title row
  const isCompetitorProfile = location.pathname.startsWith('/competitors/') &&
    location.pathname.length > '/competitors/'.length

  // War Room renders its own greeting header in-page — suppress the global title row
  const isWarRoom = location.pathname === '/'

  // On the Ask Ariya page itself, the Ask Ariya button is redundant
  const isAskPage     = location.pathname === '/ask'
  // My Space is a settings/config screen — Ask Ariya not needed there
  const isMySpacePage = location.pathname === '/myspace'

  const pageSubtitle = getPageSubtitle(location.pathname, assetName, indication, watchedCompetitors.size)

  return (
    <div style={{ background: 'var(--bg-1)', flexShrink: 0 }}>

      {/* Hamburger — mobile only */}
      {isMobile && (
        <div style={{ padding: '6px 24px', display: 'flex', alignItems: 'center' }}>
          <button
            onClick={openMobileNav}
            aria-label="Open navigation"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(5,10,68,0.65)', padding: '2px', borderRadius: '4px', flexShrink: 0,
            }}
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* ── Header row (hidden on competitor profile pages and War Room) ───── */}
      {!isCompetitorProfile && !isWarRoom && (
        <div style={{
          padding: '8px 36px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px',
        }}>

          {/* Left — title + optional subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 data-topbar-title style={{
              margin: 0,
              fontSize: '32px', fontWeight: 500,
              fontFamily: 'Satoshi, sans-serif',
              color: '#434c5b',
              lineHeight: '38.4px',
              whiteSpace: 'nowrap',
            }}>
              {pageTitle}
            </h1>

            {pageSubtitle && (
              <p data-topbar-subtitle style={{
                margin: 0,
                fontSize: '14px', fontWeight: 400,
                fontFamily: 'Inter, sans-serif',
                color: 'rgba(5,10,68,0.50)',
                lineHeight: '18px',
                whiteSpace: 'nowrap',
              }}>
                {pageSubtitle}
              </p>
            )}
          </div>

          {/* Right — Ask Ariya CTA (hidden on Ask page and My Space) */}
          {!isAskPage && !isMySpacePage && (
            <AskAriyaButton onClick={() => navigate('/ask')} />
          )}
        </div>
      )}

    </div>
  )
}
