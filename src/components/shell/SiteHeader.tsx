import { useLocation } from 'react-router-dom'
import { SidebarTrigger } from '../shadcn/ui/sidebar'
import { Separator } from '../shadcn/ui/separator'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../shadcn/ui/breadcrumb'

/**
 * SiteHeader.tsx — compact SidebarInset header (sidebar-08 migration).
 * Replaces the old TopBar.tsx, which carried a hardcoded per-page "stats"
 * subtitle (TRACKED_COMPETITOR_COUNT = 8, SIGNAL_COUNT = 17, etc. --
 * literal magic numbers presented as if live) and its own separate mobile
 * hamburger (now redundant with SidebarTrigger's built-in mobile toggle).
 * Neither carries over: this header stays deliberately compact, per this
 * migration's own "content remains the focus" instruction.
 *
 * Ask Ariya removal: the header CTA and the /ask entry it pointed to are
 * both gone (product decision, not a hidden/disabled state). The
 * breadcrumb now extends to a real two-level trail for the one page
 * that's genuinely nested (a Competitor Profile under Competitors) —
 * document.title already carries the resolved company name (see
 * useDocumentTitle in CompetitorProfile.tsx), so this reads that back
 * rather than re-deriving the same lookup a second time.
 */
const PAGE_TITLES: Record<string, string> = {
  '/':                    'War Room',
  '/intelligence':        'Intelligence Feed',
  '/competitors':         'Competitors',
  '/competitors/discover':'Discover Competitors',
  '/alerts':              'Alerts',
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
  const isCompetitorProfile = location.pathname.startsWith('/competitors/')

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {isCompetitorProfile && (
            <>
              <BreadcrumbItem className="hidden sm:block">
                <BreadcrumbLink asChild style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  <a href="/competitors">Competitors</a>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--navy-700)' }}>
              {getPageTitle(location.pathname)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
