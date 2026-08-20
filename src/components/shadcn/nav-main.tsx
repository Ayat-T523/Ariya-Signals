import { NavLink, useLocation } from "react-router-dom"
import { motion } from "framer-motion"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/shadcn/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"
import { REDUCED_MOTION } from "@/lib/motion"

export interface NavMainSubItem {
  title: string
  url: string
  disabled?: boolean
}

export interface NavMainItem {
  title: string
  url: string
  icon: React.ReactNode
  end?: boolean
  badge?: number
  items?: NavMainSubItem[]
}

/**
 * nav-main.tsx — adapted from the official shadcn sidebar-08 block
 * (https://ui.shadcn.com/view/new-york-v4/sidebar-08). Structural changes
 * from the block only: react-router `NavLink` instead of a bare `<a>` (so
 * navigation is client-side and `isActive` reflects the real current
 * route), an optional `label` prop (Ariya's real nav has two groups --
 * "Monitor"/"Decide" -- the block's own version hardcodes one), and an
 * optional numeric `badge` (unread-alerts count). No new UI primitive --
 * still plain SidebarGroup/SidebarMenu composition.
 */
export function NavMain({ label, items }: { label?: string; items: NavMainItem[] }) {
  const location = useLocation()

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          const isActive = item.end ? location.pathname === item.url : location.pathname.startsWith(item.url)
          const hasSubItems = Boolean(item.items?.length)
          return (
            <Collapsible key={item.url} asChild defaultOpen={isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <NavLink to={item.url} end={item.end}>
                    {item.icon}
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
                {item.badge !== undefined && item.badge > 0 && (
                  <SidebarMenuBadge>
                    <motion.span
                      key={item.badge}
                      animate={REDUCED_MOTION ? {} : { scale: [1, 1.15, 1] }}
                      transition={{ duration: 0.4 }}
                    >
                      {item.badge}
                    </motion.span>
                  </SidebarMenuBadge>
                )}
                {hasSubItems ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRightIcon />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items!.map((subItem) =>
                          subItem.disabled ? (
                            <SidebarMenuSubItem key={subItem.url}>
                              <span className="flex h-7 cursor-not-allowed items-center px-2 text-sm text-muted-foreground select-none">
                                {subItem.title}
                              </span>
                            </SidebarMenuSubItem>
                          ) : (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={location.pathname === subItem.url}>
                                <NavLink to={subItem.url}>{subItem.title}</NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
