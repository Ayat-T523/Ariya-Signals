import * as React from "react"
import { NavLink, useLocation } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/shadcn/ui/sidebar"

export interface NavSecondaryItem {
  title: string
  url?: string
  onClick?: () => void
  icon: React.ReactNode
}

/**
 * nav-secondary.tsx — adapted from the official sidebar-08 block. Each item
 * is either a real route (`url`, rendered as `NavLink`) or an action
 * (`onClick`, e.g. opening the Help dialog) -- never a dead `href="#"`.
 */
export function NavSecondary({
  items,
  ...props
}: {
  items: NavSecondaryItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const location = useLocation()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.url ? (
                <SidebarMenuButton asChild size="sm" isActive={location.pathname.startsWith(item.url)}>
                  <NavLink to={item.url}>
                    {item.icon}
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton size="sm" onClick={item.onClick}>
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
