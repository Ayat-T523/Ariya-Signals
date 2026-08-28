import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  LayoutGridIcon,
  Building2Icon,
  SettingsIcon,
  HelpCircleIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '../shadcn/ui/sidebar'
import { NavMain, type NavMainItem } from '../shadcn/nav-main'
import { NavSecondary, type NavSecondaryItem } from '../shadcn/nav-secondary'
import { NavUser } from '../shadcn/nav-user'
import HelpModal from './HelpModal'
import { useApp, useConfig } from '../../context/AppContext'
import { getTherapeuticAreaById } from '../../config/therapeutic-areas'

const MONITOR: NavMainItem[] = [
  { url: '/',                   icon: <HomeIcon />,       title: 'War Room',           end: true },
  { url: '/intelligence',       icon: <LayoutGridIcon />, title: 'Intelligence Feed' },
  { url: '/competitors',        icon: <Building2Icon />,  title: 'Competitors' },
]

/** Brand mark -- same vector as the retired NavPanel's NavLogo, unchanged. */
function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="17 -1 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className="shrink-0">
      <mask id="app-sidebar-logo-mask" fill="white">
        <path d="M18 24C18 10.7452 28.7452 0 42 0V0C55.2548 0 66 10.7452 66 24V24C66 37.2548 55.2548 48 42 48V48C28.7452 48 18 37.2548 18 24V24Z" />
      </mask>
      <path d="M18 24M66 24M66 24M18 24M42 0M66 24M42 48M18 24M42 48V47C29.2975 47 19 36.7025 19 24H18H17C17 37.8071 28.1929 49 42 49V48ZM66 24H65C65 36.7025 54.7025 47 42 47V48V49C55.8071 49 67 37.8071 67 24H66ZM42 0V1C54.7025 1 65 11.2975 65 24H66H67C67 10.1929 55.8071 -1 42 -1V0ZM42 0V-1C28.1929 -1 17 10.1929 17 24H18H19C19 11.2975 29.2975 1 42 1V0Z" fill="var(--indigo-500)" mask="url(#app-sidebar-logo-mask)" />
      <path d="M53.9989 27.108C53.988 28.6629 53.4806 29.9046 52.4746 30.8375C51.4577 31.7559 50.1054 32.2196 48.4134 32.2196H35.5866C33.9165 32.2196 32.5687 31.7738 31.5429 30.8877C30.5151 29.987 30 28.8089 30 27.3454V27.1091C30 25.6501 30.5139 24.4708 31.5429 23.5713C32.5687 22.6707 33.9165 22.2204 35.5866 22.2204H48.4134C49.5202 22.2204 50.5032 22.4344 51.3645 22.8613V21.2105C51.3645 20.524 51.0829 19.9076 50.5196 19.3558C49.9224 18.7606 49.2211 18.4619 48.4134 18.4619H31.8399V15.7812H48.4134C49.929 15.7812 51.2363 16.3219 52.3431 17.3997C53.4477 18.4686 54 19.737 54 21.2105V27.1091L53.9989 27.108ZM48.4123 29.5546C50.3793 29.5546 51.3634 28.7353 51.3634 27.0946C51.3634 26.2397 50.9832 25.6256 50.2205 25.2566C49.7219 25.0203 49.1202 24.9022 48.4123 24.9022H35.5866C34.8666 24.9022 34.265 25.0203 33.7785 25.2566C33.0158 25.6256 32.6366 26.2442 32.6366 27.108V27.3443C32.6366 28.2126 33.0168 28.8312 33.7785 29.199C34.2771 29.4353 34.8787 29.5535 35.5866 29.5535H48.4134L48.4123 29.5546Z" fill="var(--indigo-500)" />
    </svg>
  )
}

/**
 * Active-landscape identity, e.g. "RYSTIGGO" + "Neurology · gMG" -- real
 * canonical config only, never fabricated. Home Asset AND Disease Area both
 * resolve via useConfig()'s own shared resolvers (homeAssetDisplay /
 * diseaseAreaDisplay, Targeted Implementation 4 / 2) -- manual -> resolved ->
 * legacy catalog, in that order -- rather than a direct getAssetById()/
 * getDiseaseAreaById() call, which only ever resolves a legacy static
 * catalog id. Never a second, competing priority chain.
 *
 * Two lines only (matches SidebarMenuButton size="lg"'s h-12 budget, the
 * SAME shape the upstream sidebar-08 block uses for "Team name / Plan") --
 * a THIRD line (a static "Ariya Signals" label above this) used to overflow
 * that fixed height and clip a few px off the header's top edge. The brand
 * mark to its left already carries brand identity, so this block spends
 * both lines on the one thing that actually changes per session: which
 * landscape is active. Neutral copy when setup is incomplete.
 */
function LandscapeContext() {
  const { landscapeConfiguration } = useApp()
  const { diseaseAreaDisplay, homeAssetDisplay } = useConfig()
  const { therapeuticAreaId } = landscapeConfiguration

  const therapeuticArea = therapeuticAreaId ? getTherapeuticAreaById(therapeuticAreaId) : undefined

  if (!therapeuticArea || !diseaseAreaDisplay || !homeAssetDisplay) {
    return (
      <div className="min-w-0">
        <span className="truncate text-sm font-semibold">Ariya Signals</span>
        <p className="truncate text-xs text-sidebar-foreground/60">Landscape not configured</p>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{homeAssetDisplay.displayName}</p>
      <p className="truncate text-xs text-sidebar-foreground/60">{therapeuticArea.name} · {diseaseAreaDisplay.shortCode ?? diseaseAreaDisplay.name}</p>
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [helpOpen, setHelpOpen] = useState(false)
  const { startTour } = useApp()
  const navigate = useNavigate()

  const secondary: NavSecondaryItem[] = [
    { title: 'Help', icon: <HelpCircleIcon />, onClick: () => setHelpOpen(true) },
    { title: 'Admin', url: '/admin', icon: <SettingsIcon /> },
  ]

  function handleTakeTour() {
    setHelpOpen(false)
    startTour()
  }

  return (
    // Original Ariya visual-language restoration (pre-freeze unit 2,
    // 2026-08-26): variant="sidebar" (the default -- explicit here as a
    // deliberate choice) so the content canvas sits flush against the navy
    // sidebar, matching the reference screenshots. "inset" floats content
    // in a margined, rounded, shadowed card -- the generic-SaaS-dashboard
    // look this checkpoint is explicitly restoring away from.
    <Sidebar variant="sidebar" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => navigate('/')} className="cursor-pointer">
              <BrandMark />
              <div className="grid flex-1 text-left leading-tight">
                <LandscapeContext />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        <NavMain label="Monitor" items={MONITOR} />
        <NavSecondary items={secondary} className="mt-auto" />
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      {/* Canonical sidebar-08 affordance (was missing from this adaptation):
          a draggable edge for pointer users to resize/toggle the sidebar,
          in addition to the header's SidebarTrigger button. */}
      <SidebarRail />

      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} onTakeTour={handleTakeTour} />
    </Sidebar>
  )
}
