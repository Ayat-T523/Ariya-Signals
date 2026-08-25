import { useLocation, useNavigate } from 'react-router-dom'
import { SidebarTrigger } from '../shadcn/ui/sidebar'
import { Separator } from '../shadcn/ui/separator'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '../shadcn/ui/breadcrumb'
import { Button } from '../shadcn/ui/button'

/**
 * SiteHeader.tsx — compact SidebarInset header (sidebar-08 migration).
 * Replaces the old TopBar.tsx, which carried a hardcoded per-page "stats"
 * subtitle (TRACKED_COMPETITOR_COUNT = 8, SIGNAL_COUNT = 17, etc. --
 * literal magic numbers presented as if live) and its own separate mobile
 * hamburger (now redundant with SidebarTrigger's built-in mobile toggle).
 * Neither carries over: this header stays deliberately compact, per this
 * migration's own "content remains the focus" instruction.
 */
const PAGE_TITLES: Record<string, string> = {
  '/':                    'War Room',
  '/intelligence':        'Intelligence Feed',
  '/competitors':         'Competitors',
  '/competitors/discover':'Discover Competitors',
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

export default function SiteHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const pageTitle = getPageTitle(location.pathname)
  const isAskPage = location.pathname === '/ask'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {!isAskPage && (
        <Button size="sm" className="ml-auto" onClick={() => navigate('/ask')}>
          Ask Ariya
        </Button>
      )}
    </header>
  )
}
