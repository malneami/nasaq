import {
  CalendarDays,
  ClipboardCheck,
  FolderKanban,
  Inbox,
  Landmark,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';

export const APP_NAV_ITEMS = [
  { href: '/today', messageKey: 'today', icon: Sun },
  { href: '/inbox', messageKey: 'inbox', icon: Inbox },
  { href: '/projects', messageKey: 'projects', icon: FolderKanban },
  { href: '/calendar', messageKey: 'calendar', icon: CalendarDays },
  { href: '/people', messageKey: 'people', icon: Users },
  { href: '/finance', messageKey: 'finance', icon: Landmark },
  { href: '/review', messageKey: 'review', icon: ClipboardCheck },
] as const;

export type AppNavKey = (typeof APP_NAV_ITEMS)[number]['messageKey'];
export type AppNavHref = (typeof APP_NAV_ITEMS)[number]['href'];
export type AppNavItem = {
  href: AppNavHref;
  messageKey: AppNavKey;
  icon: LucideIcon;
};

export const APP_ROUTE_PATHS: readonly string[] = [
  ...APP_NAV_ITEMS.map((item) => item.href),
  '/settings',
];
