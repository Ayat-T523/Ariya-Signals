/**
 * NavPanel.tsx — Ariya Signals v2 navigation panel.
 * Matches Figma node 23:595 (file IXHI4HJFuZpw5hPMrv7DVb).
 *
 * Collapsed: 64 px  |  Expanded: 208 px  |  Transition: 200 ms ease
 * Trigger: mouseenter / mouseleave on the panel itself
 *
 * Active (collapsed): 40×40 white bg, blue icon
 * Active (expanded):  12×35 white left-tab + white card row
 *
 * Footer (bottom): user avatar · compass (tour) · bell (alerts) · settings (admin) · help
 *
 * Rules:
 *   - No raw hex (RGBA exempt)
 *   - lucide-react only for icons
 *   - Never log data to console
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Home, LayoutGrid, Building2, BarChart3, DollarSign,
  Bell, Sparkles, User, Compass, Settings, HelpCircle, X,
  ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useApp, useConfig } from '../../context/AppContext'
import { signOut } from '../../lib/auth'
import { userData } from '../../data/kalvista'
import { REDUCED_MOTION } from '../../lib/motion'
import { DEMO, APP_VERSION } from '../../config/demo-config'

// ── Layout constants ──────────────────────────────────────────────────────────
const W_COLLAPSED = 64
const W_EXPANDED  = 200  // 12px padding each side + 176px items = 200px

// Shell background — matches Figma outer bg
const SHELL_BG = '#152d61'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubItem  { to: string; label: string; disabled?: boolean }
interface NavItemDef {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
  badge?: boolean
  subItems?: SubItem[]
  tourId?: string
}

// ── Nav structure ─────────────────────────────────────────────────────────────
const MONITOR: NavItemDef[] = [
  { to: '/',                   icon: Home,       label: 'War Room',          end: true  },
  { to: '/intelligence',       icon: LayoutGrid, label: 'Intelligence Feed'             },
  { to: '/competitors', icon: Building2, label: 'Competitors', tourId: 'nav-competitors' },
  { to: '/market-performance', icon: BarChart3,  label: 'Market Performance'            },
  { to: '/pricing',            icon: DollarSign, label: 'Pricing and Access'            },
]

const DECIDE: NavItemDef[] = [
  { to: '/alerts', icon: Bell,     label: 'Alerts',    badge: true, tourId: 'nav-alerts' },
  { to: '/ask',    icon: Sparkles, label: 'Ask Ariya', tourId: 'nav-ask' },
  {
    to: '/myspace', icon: User, label: 'My Space', end: true,
    subItems: [
      { to: '/myspace/alerts',    label: 'My Alerts'    },
      { to: '/myspace/documents', label: 'My Documents', disabled: true },
    ],
  },
]

// ── Help modal ────────────────────────────────────────────────────────────────
function buildHelpSections(assetName: string, indication: string) {
  return [
    { name: 'War Room',          description: 'Your personalised landing page: the highest-priority signals and recent alerts in one view.' },
    { name: 'Intelligence Feed', description: 'Events calendar, earnings digests, deal landscape, and HTA tracker — all in one feed.' },
    { name: 'Competitors',       description: 'Pipeline, company, and messaging profiles for all tracked competitors with timeline view.' },
    { name: 'Market Performance',description: `${assetName} uptake vs the ${indication} class across DE, UK, US, and other key markets.` },
    { name: 'Pricing and Access',description: 'Multi-region pricing benchmark and reimbursement status across tracked markets.' },
    { name: 'Alerts',            description: 'Full signal feed, filterable by type and competitor. Mark alerts read and archive.' },
    { name: 'My Space',          description: 'Configure your delivery preferences, personal saved alerts, and uploaded documents.' },
  ]
}

function HelpModal({ onClose, onTakeTour }: { onClose: () => void; onTakeTour: () => void }) {
  const { assetName, indication } = useConfig()
  const helpSections = buildHelpSections(assetName, indication)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Auto-focus dialog on open; ESC closes (WCAG 2.1.2)
  useEffect(() => {
    dialogRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Focus trap
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus() } }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--scrim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-1)', borderRadius: '20px',
          width: '100%', maxWidth: '600px',
          maxHeight: '85vh', overflowY: 'auto',
          padding: '36px 40px',
          boxShadow: 'var(--shadow-overlay)',
          position: 'relative',
          outline: 'none',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close help"
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px', color: 'var(--font-secondary)',
          }}
        >
          <X size={18} />
        </button>

        <h2 id="help-modal-title" style={{ margin: '0 0 10px', fontSize: '24px', fontWeight: 700, color: 'var(--font-bold)' }}>
          What is Ariya Signals?
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--font-secondary)', lineHeight: 1.55 }}>
          A competitive intelligence hub for {DEMO.companyLabel}'s {indication} franchise. It monitors the competitive
          environment, tracks competitor pipeline and commercial moves, and delivers role-tailored
          insights so you spend less time gathering and more time deciding.
        </p>

        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--font-secondary)' }}>
          Sections
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {helpSections.map(s => (
            <div key={s.name}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--font-bold)' }}>{s.name}</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--font-secondary)', lineHeight: 1.55 }}>{s.description}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--font-secondary)', lineHeight: 1.5 }}>
            New here, or want a quick refresher? Take the guided tour.
          </p>
          <button
            onClick={onTakeTour}
            style={{
              padding: '8px 16px', borderRadius: '9999px',
              background: 'var(--dark-blue)', color: 'var(--bg-1)',
              border: 'none', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Take the tour
          </button>
        </div>
        <p style={{ margin: '16px 0 0', fontSize: '11px', color: 'rgba(5,10,68,0.22)', textAlign: 'center', letterSpacing: '0.03em' }}>
          {DEMO.appName} demo · {APP_VERSION}
        </p>
      </div>
    </div>,
    document.body
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────
// SVG inlined with viewBox cropped to the circle only (17,-1 → 67,49 in SVG units)
// so there are no empty margins — the circle fills the element exactly.
function NavLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg
        width="48"
        height="48"
        viewBox="17 -1 50 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        aria-hidden
      >
        <mask id="nav-logo-mask" fill="white">
          <path d="M18 24C18 10.7452 28.7452 0 42 0V0C55.2548 0 66 10.7452 66 24V24C66 37.2548 55.2548 48 42 48V48C28.7452 48 18 37.2548 18 24V24Z"/>
        </mask>
        <path d="M18 24M66 24M66 24M18 24M42 0M66 24M42 48M18 24M42 48V47C29.2975 47 19 36.7025 19 24H18H17C17 37.8071 28.1929 49 42 49V48ZM66 24H65C65 36.7025 54.7025 47 42 47V48V49C55.8071 49 67 37.8071 67 24H66ZM42 0V1C54.7025 1 65 11.2975 65 24H66H67C67 10.1929 55.8071 -1 42 -1V0ZM42 0V-1C28.1929 -1 17 10.1929 17 24H18H19C19 11.2975 29.2975 1 42 1V0Z" fill="white" mask="url(#nav-logo-mask)"/>
        <path d="M53.9989 27.108C53.988 28.6629 53.4806 29.9046 52.4746 30.8375C51.4577 31.7559 50.1054 32.2196 48.4134 32.2196H35.5866C33.9165 32.2196 32.5687 31.7738 31.5429 30.8877C30.5151 29.987 30 28.8089 30 27.3454V27.1091C30 25.6501 30.5139 24.4708 31.5429 23.5713C32.5687 22.6707 33.9165 22.2204 35.5866 22.2204H48.4134C49.5202 22.2204 50.5032 22.4344 51.3645 22.8613V21.2105C51.3645 20.524 51.0829 19.9076 50.5196 19.3558C49.9224 18.7606 49.2211 18.4619 48.4134 18.4619H31.8399V15.7812H48.4134C49.929 15.7812 51.2363 16.3219 52.3431 17.3997C53.4477 18.4686 54 19.737 54 21.2105V27.1091L53.9989 27.108ZM48.4123 29.5546C50.3793 29.5546 51.3634 28.7353 51.3634 27.0946C51.3634 26.2397 50.9832 25.6256 50.2205 25.2566C49.7219 25.0203 49.1202 24.9022 48.4123 24.9022H35.5866C34.8666 24.9022 34.265 25.0203 33.7785 25.2566C33.0158 25.6256 32.6366 26.2442 32.6366 27.108V27.3443C32.6366 28.2126 33.0168 28.8312 33.7785 29.199C34.2771 29.4353 34.8787 29.5535 35.5866 29.5535H48.4134L48.4123 29.5546Z" fill="white"/>
      </svg>
      <div>
        <p style={{
          margin: 0,
          fontSize: '18px', fontWeight: 700,
          color: '#FFFFFF',
          lineHeight: 1.2, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}>
          Ariya Signals
        </p>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: 'rgba(255,255,255,0.70)',
          lineHeight: 1, letterSpacing: '0.01em',
        }}>
          by phamax
        </p>
      </div>
    </div>
  )
}

// ── Group label (expanded mode only) ─────────────────────────────────────────
function GroupLabel({ label }: { label: string }) {
  return (
    <p style={{
      margin: '12px 0 8px', padding: '0',
      fontSize: '12px', fontWeight: 500,
      fontFamily: 'Satoshi, sans-serif',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: '#FFFFFF', whiteSpace: 'nowrap',
    }}>
      {label}
    </p>
  )
}

// ── Single nav item ───────────────────────────────────────────────────────────
function NavItem({ item, isExpanded, unreadCount }: {
  item: NavItemDef
  isExpanded: boolean
  unreadCount: number
}) {
  const location = useLocation()
  const isActive = item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)
  const showSubs = isExpanded && Boolean(item.subItems?.length)

  if (!isExpanded) {
    return (
      <div style={{ marginBottom: '2px' }}>
        <NavLink
          to={item.to}
          end={item.end}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
          title={item.label}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '40px', height: '40px',
            margin: '0 auto',
            borderRadius: '8px',
            background: isActive ? 'var(--bg-1)' : 'transparent',
            color: isActive ? 'var(--blue-primary)' : '#FFFFFF',
            textDecoration: 'none',
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
          {item.badge && unreadCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: '7px', right: '7px',
                width: '7px', height: '7px',
                background: 'var(--status-red)', borderRadius: '50%',
                border: `1.5px solid ${SHELL_BG}`,
              }}
            />
          )}
        </NavLink>
      </div>
    )
  }

  return (
    <div {...(item.tourId ? { 'data-tour': item.tourId } : {})}>
      <NavLink
          to={item.to}
          end={item.end}
          aria-current={isActive ? 'page' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            height: '35px',
            paddingLeft: '6px', paddingRight: '6px',
            borderRadius: '6px',
            background: isActive ? '#FFFFFF' : 'transparent',
            color: isActive ? '#2A76F4' : '#FFFFFF',
            textDecoration: 'none',
            fontSize: '14px', fontWeight: isActive ? 500 : 400,
            fontFamily: 'Satoshi, sans-serif',
            whiteSpace: 'nowrap',
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {item.label}
          </span>
          {item.badge && unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              animate={REDUCED_MOTION ? {} : { scale: [1, 1.15, 1] }}
              transition={{ duration: 0.4 }}
              style={{
                display: 'inline-block',
                fontSize: '11px', fontWeight: 700,
                background: 'var(--status-red)', color: 'var(--bg-1)',
                borderRadius: '9999px', padding: '1px 6px',
                minWidth: '18px', textAlign: 'center', lineHeight: '1.6', flexShrink: 0,
              }}
            >
              {unreadCount}
            </motion.span>
          )}
        </NavLink>

      {showSubs && (
        <div style={{ marginBottom: '4px' }}>
          {item.subItems!.map(sub => {
            if (sub.disabled) {
              return (
                <span
                  key={sub.to}
                  style={{
                    display: 'flex', alignItems: 'center',
                    height: '34px', paddingLeft: '55.5px', paddingRight: '12px',
                    marginRight: '8px', borderRadius: '8px',
                    fontSize: '14px', fontWeight: 300,
                    color: 'rgba(255,255,255,0.28)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    cursor: 'not-allowed', userSelect: 'none',
                  }}
                >
                  {sub.label}
                </span>
              )
            }
            const subActive = location.pathname === sub.to || location.pathname.startsWith(sub.to + '/')
            return (
              <NavLink
                key={sub.to}
                to={sub.to}
                aria-current={subActive ? 'page' : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  height: '34px', paddingLeft: '55.5px', paddingRight: '12px',
                  marginRight: '8px', borderRadius: '8px',
                  fontSize: '14px', fontWeight: subActive ? 700 : 300,
                  color: '#FFFFFF',
                  textDecoration: subActive ? 'underline' : 'none',
                  textDecorationColor: 'rgba(255,255,255,0.65)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'color 150ms ease',
                }}
              >
                {sub.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Footer icon button ────────────────────────────────────────────────────────
function FooterIconBtn({
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  badge?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '24px', height: '24px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'rgba(255,255,255,0.75)',
        borderRadius: '4px',
        transition: 'color 150ms ease',
        padding: '4px',
        boxSizing: 'content-box',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.90)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
    >
      <Icon size={16} strokeWidth={1.5} />
      {badge && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: '3px', right: '3px',
            width: '6px', height: '6px',
            background: 'var(--status-red)', borderRadius: '50%',
            border: `1.5px solid ${SHELL_BG}`,
          }}
        />
      )}
    </button>
  )
}

// ── NavPanel (main export) ────────────────────────────────────────────────────
export default function NavPanel() {
  const [helpOpen, setHelpOpen] = useState(false)
  const { unreadCount, openOnboarding, startTour, mobileNavOpen, closeMobileNav } = useApp()
  const navigate = useNavigate()

  const [isExpanded, setIsExpanded] = useState(true)
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth <= 767)

  async function handleSignOut() {
    await signOut()
    navigate('/sign-in')
  }

  // Track mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches)
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const user    = userData.user
  const company = userData.company

  function handleTakeTour() {
    setHelpOpen(false)
    startTour()
  }

  // On mobile the nav always renders in expanded (label-visible) mode
  const showExpanded = isMobile || isExpanded

  function NavContent() {
    return (
      <>
        {/* ── Logo + collapse/close toggle ─────────────────────────────── */}
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center',
          paddingTop: '24px', paddingBottom: '12px',
          paddingLeft: '12px', paddingRight: '12px',
          flexShrink: 0,
        }}>
          <NavLogo />
          {isMobile ? (
            <button
              onClick={closeMobileNav}
              aria-label="Close navigation"
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', background: 'none', border: 'none',
                cursor: 'pointer', color: 'rgba(255,255,255,0.75)', borderRadius: '4px', padding: 0,
              }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={() => setIsExpanded(v => !v)}
              aria-label={isExpanded ? 'Collapse nav' : 'Expand nav'}
              title={isExpanded ? 'Collapse nav' : 'Expand nav'}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', background: 'none', border: 'none',
                cursor: 'pointer', color: 'rgba(255,255,255,0.75)', borderRadius: '4px', padding: 0, flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
            >
              {isExpanded ? <ChevronLeft size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
            </button>
          )}
        </div>

        {/* ── Nav scroll area ──────────────────────────────────────────── */}
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 12px' }}>
          {showExpanded && <GroupLabel label="Monitor" />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MONITOR.map(item => (
              <NavItem key={item.to} item={item} isExpanded={showExpanded} unreadCount={unreadCount} />
            ))}
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '12px 0' }} />

          {showExpanded && <GroupLabel label="Decide" />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DECIDE.map(item => (
              <NavItem key={item.to} item={item} isExpanded={showExpanded} unreadCount={unreadCount} />
            ))}
          </div>
        </div>

        {/* ── Footer: user identity + utility icons ─────────────────────────── */}
        <div style={{
          padding: '12px 12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {/* Avatar row — avatar alone when collapsed, avatar + name when expanded */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
            overflow: 'hidden',
            justifyContent: showExpanded ? 'flex-start' : 'center',
          }}>
            {/* User avatar */}
            <div
              title={`${user.name} · ${company}`}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <User size={18} color="rgba(255,255,255,0.80)" strokeWidth={1.5} />
            </div>
            {showExpanded && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--bg-1)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.name}
                </p>
                <p style={{
                  margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.70)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {company}
                </p>
              </div>
            )}
            {showExpanded && (
              <FooterIconBtn icon={LogOut} label="Sign out" onClick={handleSignOut} />
            )}
          </div>

          {/* Utility icons — column when collapsed, row when expanded */}
          <div style={{
            display: 'flex',
            flexDirection: showExpanded ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: showExpanded ? 'flex-start' : 'center',
            gap: showExpanded ? '4px' : '8px',
          }}>
            <FooterIconBtn icon={Compass} label="Take the tour" onClick={openOnboarding} />
            <FooterIconBtn
              icon={Bell}
              label={`${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`}
              onClick={() => navigate('/alerts')}
              badge={unreadCount > 0}
            />
            <FooterIconBtn icon={HelpCircle} label="Help" onClick={() => setHelpOpen(true)} />
            <FooterIconBtn icon={Settings} label="Admin" onClick={() => navigate('/admin')} />
            {!showExpanded && (
              <FooterIconBtn icon={LogOut} label="Sign out" onClick={handleSignOut} />
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Mobile backdrop — closes nav on tap outside */}
      {isMobile && mobileNavOpen && createPortal(
        <div
          aria-hidden="true"
          onClick={closeMobileNav}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.50)' }}
        />,
        document.body
      )}

      {/* The actual nav — fixed overlay on mobile-open, in-flow on desktop */}
      {(!isMobile || mobileNavOpen) && (
        <nav
          role="navigation"
          aria-label="Main navigation"
          aria-expanded={showExpanded}
          style={{
            position: isMobile ? 'fixed' : 'relative',
            left: 0, top: 0,
            height: '100vh',
            width: isMobile ? `${W_EXPANDED}px` : `${isExpanded ? W_EXPANDED : W_COLLAPSED}px`,
            transition: isMobile ? 'none' : 'width 200ms ease',
            background: 'transparent',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
            zIndex: isMobile ? 200 : 40,
            overflow: 'hidden',
          }}
        >
          <NavContent />
        </nav>
      )}

      {helpOpen && (
        <HelpModal onClose={() => setHelpOpen(false)} onTakeTour={handleTakeTour} />
      )}
    </>
  )
}
