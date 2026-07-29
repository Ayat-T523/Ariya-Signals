/**
 * NavPanel.tsx — InForm navigation (Clean Clinical, on Animate UI's
 * Radix Sidebar architecture).
 *
 * Rebuilt on src/components/animate-ui/components/radix/sidebar.tsx (copied
 * into the repo via the Animate UI registry, itself built directly on
 * shadcn's own Sidebar architecture -- see DESIGN.md / the component
 * migration decisions log). Gains: built-in mobile Sheet overlay (replaces
 * the old hand-rolled portal/backdrop), built-in collapsed-state tooltips on
 * SidebarMenuButton, keyboard shortcut (Cmd/Ctrl+B) toggle for free.
 *
 * Kept custom: the floating edge-boundary chevron toggle (the Sidebar
 * library ships its own SidebarRail/SidebarTrigger, but neither matches the
 * circular button straddling the panel boundary the user picked from a
 * reference image earlier this session) -- wired to the library's own
 * toggleSidebar() instead of local state. Collapsed: 64px | Expanded: 200px
 * (overriding the library's 3rem/16rem defaults via CSS custom properties
 * on SidebarProvider).
 *
 * Footer (bottom): user avatar · compass (tour) · bell (alerts) · settings (admin) · help
 *
 * Rules:
 *   - No raw hex (RGBA exempt)
 *   - lucide-react only for icons
 *   - Never log data to console
 */

import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
// Icons: animate-ui's Lucide-sourced, motion-wrapped set where available
// (critique 2026-07-28 -- "for all icons, use animate UI"), plain lucide-react
// for the handful animate-ui's registry doesn't carry (Home, LayoutGrid,
// Building2, DollarSign, HelpCircle -- confirmed absent via registry.json).
import { Home, LayoutGrid, Building2, DollarSign, HelpCircle } from 'lucide-react'
import { ChartBar as BarChart3 } from '../animate-ui/icons/chart-bar'
import { Bell } from '../animate-ui/icons/bell'
import { Sparkles } from '../animate-ui/icons/sparkles'
import { User } from '../animate-ui/icons/user'
import { Compass } from '../animate-ui/icons/compass'
import { Settings } from '../animate-ui/icons/settings'
import { ChevronLeft } from '../animate-ui/icons/chevron-left'
import { ChevronRight } from '../animate-ui/icons/chevron-right'
import { LogOut } from '../animate-ui/icons/log-out'
import type { NavIcon } from '../animate-ui/icons/types'
import { motion } from 'framer-motion'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '../animate-ui/components/radix/sidebar'
import { Button } from '../shadcn/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../shadcn/ui/dialog'
import { Separator } from '../shadcn/ui/separator'
import { useApp, useConfig } from '../../context/AppContext'
import { signOut } from '../../lib/auth'
import { userData } from '../../data/kalvista'
import { REDUCED_MOTION } from '../../lib/motion'
import { DEMO, APP_VERSION } from '../../config/demo-config'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubItem  { to: string; label: string; disabled?: boolean }
interface NavItemDef {
  to: string
  icon: NavIcon
  /** True only for animate-ui's motion-wrapped icons -- plain lucide-react
   * icons don't accept animate* props and React warns if they receive one
   * (unrecognized DOM attribute on the underlying <svg>). */
  animatedIcon?: boolean
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
  { to: '/market-performance', icon: BarChart3,  label: 'Market Performance', animatedIcon: true },
  { to: '/pricing',            icon: DollarSign, label: 'Pricing and Access'            },
]

const DECIDE: NavItemDef[] = [
  { to: '/alerts', icon: Bell,     label: 'Alerts',    badge: true, tourId: 'nav-alerts', animatedIcon: true },
  { to: '/ask',    icon: Sparkles, label: 'Ask InForm', tourId: 'nav-ask', animatedIcon: true },
  {
    to: '/myspace', icon: User, label: 'My Space', end: true, animatedIcon: true,
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

function HelpModal({ open, onOpenChange, onTakeTour }: { open: boolean; onOpenChange: (open: boolean) => void; onTakeTour: () => void }) {
  const { assetName, indication } = useConfig()
  const helpSections = buildHelpSections(assetName, indication)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px]"
        style={{
          maxHeight: '85vh', overflowY: 'auto',
          padding: '36px 40px',
          fontFamily: 'var(--font-ui)',
          borderRadius: 'var(--r-flat-content)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--neutral-900)' }}>
            What is InForm?
          </DialogTitle>
          <DialogDescription style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--neutral-700)', lineHeight: 1.55 }}>
            A competitive intelligence hub for {DEMO.companyLabel}'s {indication} franchise. It monitors the competitive
            environment, tracks competitor pipeline and commercial moves, and delivers role-tailored
            insights so you spend less time gathering and more time deciding.
          </DialogDescription>
        </DialogHeader>

        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--neutral-600)' }}>
          Sections
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {helpSections.map(s => (
            <div key={s.name}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--neutral-900)' }}>{s.name}</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--neutral-700)', lineHeight: 1.55 }}>{s.description}</p>
            </div>
          ))}
        </div>

        <Separator style={{ marginTop: '8px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--neutral-700)', lineHeight: 1.5 }}>
            New here, or want a quick refresher? Take the guided tour.
          </p>
          <Button
            onClick={onTakeTour}
            size="sm"
            style={{ flexShrink: 0 }}
          >
            Take the tour
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--neutral-500)', textAlign: 'center', letterSpacing: '0.03em' }}>
          {DEMO.appName} demo · {APP_VERSION}
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────
function NavLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg
        width="32" height="32"
        viewBox="17 -1 50 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        aria-hidden
      >
        <mask id="nav-logo-mask" fill="white">
          <path d="M18 24C18 10.7452 28.7452 0 42 0V0C55.2548 0 66 10.7452 66 24V24C66 37.2548 55.2548 48 42 48V48C28.7452 48 18 37.2548 18 24V24Z"/>
        </mask>
        <path d="M18 24M66 24M66 24M18 24M42 0M66 24M42 48M18 24M42 48V47C29.2975 47 19 36.7025 19 24H18H17C17 37.8071 28.1929 49 42 49V48ZM66 24H65C65 36.7025 54.7025 47 42 47V48V49C55.8071 49 67 37.8071 67 24H66ZM42 0V1C54.7025 1 65 11.2975 65 24H66H67C67 10.1929 55.8071 -1 42 -1V0ZM42 0V-1C28.1929 -1 17 10.1929 17 24H18H19C19 11.2975 29.2975 1 42 1V0Z" fill="var(--indigo-600)" mask="url(#nav-logo-mask)"/>
        <path d="M53.9989 27.108C53.988 28.6629 53.4806 29.9046 52.4746 30.8375C51.4577 31.7559 50.1054 32.2196 48.4134 32.2196H35.5866C33.9165 32.2196 32.5687 31.7738 31.5429 30.8877C30.5151 29.987 30 28.8089 30 27.3454V27.1091C30 25.6501 30.5139 24.4708 31.5429 23.5713C32.5687 22.6707 33.9165 22.2204 35.5866 22.2204H48.4134C49.5202 22.2204 50.5032 22.4344 51.3645 22.8613V21.2105C51.3645 20.524 51.0829 19.9076 50.5196 19.3558C49.9224 18.7606 49.2211 18.4619 48.4134 18.4619H31.8399V15.7812H48.4134C49.929 15.7812 51.2363 16.3219 52.3431 17.3997C53.4477 18.4686 54 19.737 54 21.2105V27.1091L53.9989 27.108ZM48.4123 29.5546C50.3793 29.5546 51.3634 28.7353 51.3634 27.0946C51.3634 26.2397 50.9832 25.6256 50.2205 25.2566C49.7219 25.0203 49.1202 24.9022 48.4123 24.9022H35.5866C34.8666 24.9022 34.265 25.0203 33.7785 25.2566C33.0158 25.6256 32.6366 26.2442 32.6366 27.108V27.3443C32.6366 28.2126 33.0168 28.8312 33.7785 29.199C34.2771 29.4353 34.8787 29.5535 35.5866 29.5535H48.4134L48.4123 29.5546Z" fill="var(--indigo-600)"/>
      </svg>
      {!collapsed && (
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <p style={{
            margin: 0,
            fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-display)',
            color: 'var(--neutral-900)',
            lineHeight: 1.2, letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            InForm
          </p>
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
  animatedIcon = true,
}: {
  icon: NavIcon
  label: string
  onClick: () => void
  badge?: boolean
  /** False for plain lucide-react icons (see NavItemDef.animatedIcon). */
  animatedIcon?: boolean
}) {
  return (
    <Button
      onClick={onClick}
      aria-label={label}
      title={label}
      variant="ghost"
      size="icon-sm"
      style={{ position: 'relative', color: 'var(--neutral-600)' }}
    >
      <Icon size={16} strokeWidth={1.5} {...(animatedIcon ? { animateOnHover: true } : {})} />
      {badge && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: '3px', right: '3px',
            width: '6px', height: '6px',
            background: 'var(--crimson-600)', borderRadius: '50%',
            border: '1.5px solid var(--white)',
          }}
        />
      )}
    </Button>
  )
}

// ── Floating edge-boundary chevron toggle ─────────────────────────────────────
function EdgeChevron() {
  const { state, toggleSidebar } = useSidebar()
  const isExpanded = state === 'expanded'
  return (
    <Button
      onClick={toggleSidebar}
      aria-label={isExpanded ? 'Collapse nav' : 'Expand nav'}
      title={isExpanded ? 'Collapse nav' : 'Expand nav'}
      variant="outline"
      size="icon-sm"
      className="nav-edge-chevron"
      style={{
        position: 'absolute', top: '50%', right: '-13px', transform: 'translateY(-50%)',
        width: '26px', height: '26px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--white)',
        border: '1.5px solid var(--border-default)',
        boxShadow: 'var(--shadow-flat-hover)',
        zIndex: 41,
      }}
    >
      {isExpanded ? <ChevronLeft size={16} strokeWidth={2.25} animateOnHover /> : <ChevronRight size={16} strokeWidth={2.25} animateOnHover />}
    </Button>
  )
}

// ── Inner content (needs useSidebar(), must be inside the provider) ──────────
function NavPanelInner({ onHelpOpen }: { onHelpOpen: () => void }) {
  const { state, isMobile } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  const { unreadCount, openOnboarding, startTour } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() { await signOut(); navigate('/sign-in') }

  const user = userData.user
  const company = userData.company

  return (
    <div style={{ position: 'relative', flexShrink: 0, height: '100%' }}>
      <Sidebar collapsible="icon" className="border-r" style={{ borderColor: 'var(--border-default)' }}>
        <SidebarHeader style={{ paddingTop: '16px', paddingBottom: '8px' }}>
          <NavLogo collapsed={collapsed} />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Monitor</SidebarGroupLabel>}
            <SidebarMenu>
              {MONITOR.map(item => {
                const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to} {...(item.tourId ? { 'data-tour': item.tourId } : {})}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <NavLink to={item.to} end={item.end}>
                        <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} {...(item.animatedIcon ? { animateOnHover: true } : {})} />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Decide</SidebarGroupLabel>}
            <SidebarMenu>
              {DECIDE.map(item => {
                const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
                const showSubs = !collapsed && Boolean(item.subItems?.length)
                return (
                  <SidebarMenuItem key={item.to} {...(item.tourId ? { 'data-tour': item.tourId } : {})}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <NavLink to={item.to} end={item.end}>
                        <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} {...(item.animatedIcon ? { animateOnHover: true } : {})} />
                        {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    {item.badge && unreadCount > 0 && (
                      <SidebarMenuBadge>
                        <motion.span
                          key={unreadCount}
                          animate={REDUCED_MOTION ? {} : { scale: [1, 1.15, 1] }}
                          transition={{ duration: 0.4 }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                            background: 'var(--crimson-600)', color: '#fff',
                            borderRadius: 'var(--r-pill)', minWidth: '18px', height: '18px', padding: '0 5px',
                          }}
                        >
                          {unreadCount}
                        </motion.span>
                      </SidebarMenuBadge>
                    )}
                    {showSubs && (
                      <SidebarMenuSub>
                        {item.subItems!.map(sub => {
                          const subActive = location.pathname === sub.to || location.pathname.startsWith(sub.to + '/')
                          if (sub.disabled) {
                            return (
                              <SidebarMenuSubItem key={sub.to}>
                                <span style={{ display: 'flex', alignItems: 'center', height: '28px', padding: '0 8px', fontSize: '14px', color: 'var(--neutral-400)', cursor: 'not-allowed', userSelect: 'none' }}>
                                  {sub.label}
                                </span>
                              </SidebarMenuSubItem>
                            )
                          }
                          return (
                            <SidebarMenuSubItem key={sub.to}>
                              <SidebarMenuSubButton asChild isActive={subActive}>
                                <NavLink to={sub.to}>{sub.label}</NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter style={{ borderTop: '1px solid var(--border-default)', paddingBottom: '16px' }}>
          {/* Avatar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', overflow: 'hidden', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div
              title={`${user.name} · ${company}`}
              style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--neutral-100)', border: '1.5px solid var(--border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <User size={16} color="var(--neutral-600)" strokeWidth={1.5} animateOnHover />
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</p>
              </div>
            )}
            {!collapsed && <FooterIconBtn icon={LogOut} label="Sign out" onClick={handleSignOut} />}
          </div>

          {/* Utility icons */}
          <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '8px' : '4px' }}>
            <FooterIconBtn icon={Compass} label="Take the tour" onClick={openOnboarding} />
            <FooterIconBtn icon={Bell} label={`${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`} onClick={() => navigate('/alerts')} badge={unreadCount > 0} />
            <FooterIconBtn icon={HelpCircle} label="Help" onClick={onHelpOpen} animatedIcon={false} />
            <FooterIconBtn icon={Settings} label="Admin" onClick={() => navigate('/admin')} />
            {collapsed && <FooterIconBtn icon={LogOut} label="Sign out" onClick={handleSignOut} />}
          </div>
        </SidebarFooter>
      </Sidebar>

      {!isMobile && <EdgeChevron />}
    </div>
  )
}

// ── NavPanel (main export) ────────────────────────────────────────────────────
export default function NavPanel() {
  const [helpOpen, setHelpOpen] = useState(false)
  const { startTour, mobileNavOpen, closeMobileNav } = useApp()

  function handleTakeTour() { setHelpOpen(false); startTour() }

  return (
    <SidebarProvider
      className="w-auto"
      style={{ '--sidebar-width': '200px', '--sidebar-width-icon': '64px' } as React.CSSProperties}
      openMobile={mobileNavOpen}
      onOpenMobileChange={(open) => { if (!open) closeMobileNav() }}
    >
      <NavPanelInner onHelpOpen={() => setHelpOpen(true)} />
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} onTakeTour={handleTakeTour} />
    </SidebarProvider>
  )
}
