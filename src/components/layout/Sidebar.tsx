import { NavLink } from 'react-router-dom'
import {
  Home, Building2, LayoutGrid, Bell, Sparkles, DollarSign, BarChart3,
  User, BellRing, FileText, Compass, Settings,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import user from '../../data/user.json'

// ── Nav groups (Monitor / Decide) ────────────────────────────────────────────
const MONITOR_ITEMS = [
  { to: '/',                   icon: Home,       label: 'War Room',           end: true  },
  { to: '/intelligence',       icon: LayoutGrid, label: 'Intelligence Feed',  end: false },
  { to: '/competitors',        icon: Building2,  label: 'Competitors',        end: false },
  { to: '/market-performance', icon: BarChart3,  label: 'Market Performance', end: false },
  { to: '/pricing',            icon: DollarSign, label: 'Pricing and Access', end: false },
]

const DECIDE_ITEMS = [
  { to: '/alerts',             icon: Bell,       label: 'Alerts',       end: false },
  { to: '/ask',                icon: Sparkles,   label: 'Ask Ariya',    end: false },
  { to: '/myspace',            icon: User,       label: 'My Space',     end: true  },
  { to: '/myspace/alerts',     icon: BellRing,   label: 'My Alerts',    end: false, indent: true },
  { to: '/myspace/documents',  icon: FileText,   label: 'My Documents', end: false, indent: true },
]

/** Ariya logo mark + wordmark */
function AriyaLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img
        src="/ariya-logo.svg"
        alt="Ariya"
        style={{ width: '42px', height: '24px', display: 'block' }}
      />
      <span style={{
        fontSize: '15px', fontWeight: 600,
        color: '#FFFFFF',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        Ariya Signals
      </span>
    </div>
  )
}

// ── Group label (uppercase, muted) ───────────────────────────────────────────
function GroupLabel({ children, topGap }) {
  return (
    <p style={{
      margin: 0,
      padding: `${topGap ? '14px' : '4px'} 12px 8px`,
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: 'rgba(255,255,255,0.38)',
    }}>
      {children}
    </p>
  )
}

// ── Single nav item (supports nested sub-items via indent) ──────────────────
function NavItem({ item, unreadCount }) {
  const indent = Boolean(item.indent)
  return (
    <NavLink
      to={item.to}
      end={item.end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: indent ? '7px 10px 7px 24px' : '9px 10px 9px 8px',
        borderRadius: '8px',
        fontSize: indent ? '13px' : '14px',
        fontWeight: isActive ? '600' : '400',
        color: isActive
          ? 'rgba(255,255,255,1)'
          : indent ? 'rgba(255,255,255,0.48)' : 'rgba(255,255,255,0.58)',
        textDecoration: 'none',
        borderLeft: isActive ? '3px solid #1A6BFF' : '3px solid transparent',
        transition: 'color 150ms ease, background 150ms ease',
        background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
      })}
    >
      {({ isActive }) => (
        <>
          <item.icon size={indent ? 14 : 16} strokeWidth={isActive ? 2 : 1.5} />
          <span>{item.label}</span>

          {/* Unread badge on Alerts */}
          {item.label === 'Alerts' && unreadCount > 0 && (
            <span
              className="ml-auto text-white font-semibold"
              style={{
                fontSize: '11px',
                background: '#E11D48',
                borderRadius: '9999px',
                padding: '1px 6px',
                minWidth: '18px',
                textAlign: 'center',
                lineHeight: '1.6',
              }}
            >
              {unreadCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { unreadCount, openOnboarding } = useApp()

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-40"
      style={{
        width: '240px',
        background: 'linear-gradient(180deg, #050A44 0%, #070F52 55%, #050A44 100%)',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-5">
        <AriyaLogo />
        <p
          className="mt-1 text-xs"
          style={{ color: 'rgba(255,255,255,0.32)', letterSpacing: '0.02em', paddingLeft: '52px' }}
        >
          by phamax
        </p>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
        {/* MONITOR group */}
        <GroupLabel>Monitor</GroupLabel>
        {MONITOR_ITEMS.map((item) => (
          <NavItem key={item.to} item={item} unreadCount={unreadCount} />
        ))}

        {/* Divider between groups */}
        <div
          style={{
            height: '1px',
            background: 'rgba(255,255,255,0.10)',
            margin: '12px 8px',
          }}
        />

        {/* DECIDE group */}
        <GroupLabel topGap>Decide</GroupLabel>
        {DECIDE_ITEMS.map((item) => (
          <NavItem key={item.to} item={item} unreadCount={unreadCount} />
        ))}
      </nav>

      {/* ── Bottom utilities (Take the tour + Admin) ──────────────────── */}
      <div
        className="px-3 pb-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: '8px' }}
      >
        {/* Take the tour — opens the role modal which starts the tour */}
        <button
          onClick={openOnboarding}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '7px 10px 7px 8px',
            borderRadius: '8px',
            fontSize: '12px', fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            background: 'transparent',
            border: 'none',
            borderLeft: '3px solid transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            transition: 'color 150ms ease, background 150ms ease',
            marginBottom: '2px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Compass size={13} strokeWidth={1.5} />
          <span>Take the tour</span>
        </button>

        {/* Admin link */}
        <NavLink
          to="/admin"
          end={false}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px 7px 8px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: isActive ? '600' : '400',
            color: isActive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.38)',
            textDecoration: 'none',
            borderLeft: isActive ? '3px solid rgba(255,255,255,0.35)' : '3px solid transparent',
            background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
            transition: 'color 150ms ease, background 150ms ease',
          })}
        >
          {({ isActive }) => (
            <>
              <Settings size={13} strokeWidth={isActive ? 2 : 1.5} />
              <span>Admin</span>
            </>
          )}
        </NavLink>
      </div>

      {/* ── User profile (bottom, pinned) ─────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 16px',
          borderTop: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <img
          src="/avatar.png"
          alt={user.user.name}
          style={{
            width: '34px', height: '34px', borderRadius: '50%',
            objectFit: 'cover', objectPosition: 'center top',
            flexShrink: 0,
            border: '1.5px solid rgba(255,255,255,0.20)',
          }}
        />
        <div style={{ lineHeight: 1.3, minWidth: 0, overflow: 'hidden' }}>
          <p
            style={{
              margin: 0, fontSize: '13px', fontWeight: 600, color: '#FFFFFF',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {user.user.name}
          </p>
          <p
            style={{
              margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.55)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {user.company}
          </p>
        </div>
      </div>
    </aside>
  )
}
