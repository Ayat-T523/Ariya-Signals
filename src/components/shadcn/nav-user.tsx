import { useNavigate } from "react-router-dom"

import {
  Avatar,
  AvatarFallback,
} from "@/components/shadcn/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/shadcn/ui/sidebar"
import { ChevronsUpDownIcon, CompassIcon, LogOutIcon } from "lucide-react"
import { useAccountIdentity } from "@/context/AppContext"
import { useAuth } from "@/context/AuthContext"

function initials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

/**
 * nav-user.tsx — adapted from the official sidebar-08 block. Identity comes
 * from useAccountIdentity() (AuthContext-backed) -- never the "David" /
 * "Pharma Inc" static fixture the old NavPanel footer read from. Local dev
 * mode shows the neutral "Local Developer" identity as-is. Menu items are
 * real Ariya actions only (Edit landscape, Sign out) -- the block's own
 * demo items (Upgrade to Pro, Billing, Notifications) don't correspond to
 * anything in this product and are not carried over.
 */
export function NavUser() {
  const { isMobile } = useSidebar()
  const { displayName, email, anonymous } = useAccountIdentity()
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await logout()
    navigate("/sign-in")
  }

  const name = anonymous ? "Not signed in" : (displayName ?? "Account")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                {email && <span className="truncate text-xs">{email}</span>}
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  {email && <span className="truncate text-xs">{email}</span>}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/setup")}>
                <CompassIcon />
                Edit landscape
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
