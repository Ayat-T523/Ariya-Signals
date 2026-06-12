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

import { useState, useEffect, Component, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import {
  alertsData,
  competitorsData,
  eventsData,
  reportsData,
  marketDevelopments,
} from '../../data/kalvista'
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

// ── Per-page subtitle stats ────────────────────────────────────────────────────
const TODAY_TS = new Date('2026-04-21').getTime()

const TRACKED_COMPETITOR_COUNT = new Set(alertsData.map((a) => a.competitorId)).size
const SIGNAL_COUNT             = alertsData.length
const UPCOMING_EVENT_COUNT     = eventsData.filter(
  (e) => new Date(e.date).getTime() >= TODAY_TS
).length
const REPORT_COUNT             = (reportsData as unknown[]).length
const MARKET_DEV_COUNT         = (marketDevelopments as unknown[]).length
const COMPETITOR_COUNT         = competitorsData.length

function getPageSubtitle(pathname: string): string | null {
  if (pathname === '/') {
    return `Ekterly · HAE · ${TRACKED_COMPETITOR_COUNT} tracked competitors · ${SIGNAL_COUNT} signals on file`
  }
  if (pathname === '/intelligence') {
    return `${UPCOMING_EVENT_COUNT} upcoming events · ${REPORT_COUNT} reports · ${MARKET_DEV_COUNT} market developments`
  }
  if (pathname === '/competitors') {
    return `${COMPETITOR_COUNT} competitors tracked · HAE therapeutic area`
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

// ── Error boundary — catches any lottie-react render errors ───────────────────
class LottieBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// ── AskAriyaButton ────────────────────────────────────────────────────────────
// Lazy-loads the Scene.json Lottie so a parse error never crashes the app.
// Clips 1600×1200 scene at 0.2125× scale → 340×255; pill lives at centre (170, 127.5).
function AskAriyaButton({ onClick }: { onClick: () => void }) {
  const [animData, setAnimData] = useState<object | null>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    import('../../assets/ask-ariya-anim.json')
      .then((mod) => setAnimData(mod.default as object))
      .catch(() => { /* leave animData null → static fallback stays */ })
  }, [])

  if (!animData) return <StaticAskButton onClick={onClick} />

  return (
    <LottieBoundary fallback={<StaticAskButton onClick={onClick} />}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '170px',
          height: '54px',
          overflow: 'hidden',
          position: 'relative',
          borderRadius: '40px',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'transform 160ms ease',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        }}
      >
        <Lottie
          animationData={animData}
          loop
          style={{
            width: '340px',
            height: '255px',
            position: 'absolute',
            left: '-85px',
            top: '-100px',
            pointerEvents: 'none',
          }}
        />
      </div>
    </LottieBoundary>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
export default function TopBar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const pageTitle = getPageTitle(location.pathname)

  // Competitor profile pages have their own sticky header — suppress the global title row
  const isCompetitorProfile = location.pathname.startsWith('/competitors/') &&
    location.pathname.length > '/competitors/'.length

  // War Room renders its own greeting header in-page — suppress the global title row
  const isWarRoom = location.pathname === '/'

  // On the Ask Ariya page itself, the Ask Ariya button is redundant
  const isAskPage     = location.pathname === '/ask'
  // My Space is a settings/config screen — Ask Ariya not needed there
  const isMySpacePage = location.pathname === '/myspace'

  const pageSubtitle = getPageSubtitle(location.pathname)

  return (
    <div style={{ background: 'var(--bg-1)', flexShrink: 0 }}>

      {/* ── Header row (hidden on competitor profile pages and War Room) ───── */}
      {!isCompetitorProfile && !isWarRoom && (
        <div style={{
          padding: '8px 36px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px',
        }}>

          {/* Left — title + optional subtitle */}
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

            {pageSubtitle && (
              <p style={{
                margin: 0,
                fontSize: '13px', fontWeight: 400,
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
