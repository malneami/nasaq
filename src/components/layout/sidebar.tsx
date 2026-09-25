'use client';

import { PanelLeft, PanelRight, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AskAIButton } from '@/components/layout/ask-ai-button';
import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { useDirection } from '@/components/ui/direction';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { APP_NAV_ITEMS } from '@/lib/nav-items';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const dir = useDirection();
  const [collapsed, setCollapsed] = useState(false);
  const collapseLabel = collapsed ? t('nav.expand') : t('nav.collapse');
  const tooltipSide = dir === 'rtl' ? 'left' : 'right';

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-svh shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-(--spacing-sidebar-collapsed)' : 'w-(--spacing-sidebar)',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1 px-2',
          collapsed
            ? 'flex-col py-3'
            : 'h-14 justify-between gap-2 px-3',
        )}
      >
        <BrandMark collapsed={collapsed} size="sm" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapseLabel}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelRight className="rtl:rotate-180" />
              ) : (
                <PanelLeft className="rtl:rotate-180" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>{collapseLabel}</TooltipContent>
        </Tooltip>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label={t('app.name')}>
        {APP_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const label = t(`nav.${item.messageKey}`);
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          const link = (
            <Link
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className={cn(
                'relative flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:start-0 before:w-1 before:rounded-full before:bg-sage'
                  : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          );

          if (!collapsed) {
            return (
              <div key={item.href} className="w-full">
                {link}
              </div>
            );
          }

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side={tooltipSide}>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="space-y-1 p-2">
        {(() => {
          const settingsLabel = t('nav.settings');
          const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/');
          const settingsLink = (
            <Link
              href="/settings"
              aria-label={settingsLabel}
              aria-current={settingsActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm transition-colors',
                collapsed && 'justify-center px-0',
                settingsActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
              )}
            >
              <Settings className="size-4 shrink-0" />
              {!collapsed ? <span className="truncate">{settingsLabel}</span> : null}
            </Link>
          );
          return collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
              <TooltipContent side={tooltipSide}>{settingsLabel}</TooltipContent>
            </Tooltip>
          ) : (
            settingsLink
          );
        })()}
        <AskAIButton collapsed={collapsed} />
      </div>
    </aside>
  );
}
