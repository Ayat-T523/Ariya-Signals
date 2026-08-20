import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IconProps } from './icon';

/**
 * Not an official Animate UI registry type — the public registry (animate-ui.com)
 * has no such export. Derived here, not invented: NavPanel.tsx renders every nav
 * icon uniformly as `<Icon size={16} strokeWidth={...} {...(animatedIcon ? {
 * animateOnHover: true } : {})} />`, mixing plain lucide-react icons (e.g. Home,
 * LayoutGrid) with Animate UI icons (e.g. ChartBar, Bell, Sparkles) in the same
 * NavItemDef[] array, gated by the existing `animatedIcon` flag so a plain
 * lucide-react icon never receives an animate* prop.
 *
 * NavIcon is exactly the union both call sites already require: lucide-react's
 * own exported `LucideIcon` type, or an Animate UI icon component (typed against
 * this module's own `IconProps`, imported from the restored shared icon.tsx).
 */
export type NavIcon = LucideIcon | ComponentType<IconProps<any>>;
