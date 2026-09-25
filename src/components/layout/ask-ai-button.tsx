'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { AskAIPanel } from '@/components/layout/ask-ai-panel';
import { Button } from '@/components/ui/button';
import { useDirection } from '@/components/ui/direction';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function AskAIButton({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav');
  const dir = useDirection();
  const [open, setOpen] = useState(false);
  const label = t('askAi');
  const tooltipSide = dir === 'rtl' ? 'left' : 'right';

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            className={cn(
              'w-full bg-accent text-accent-foreground hover:bg-accent/90',
              collapsed ? 'px-0' : 'justify-start',
            )}
            onClick={() => setOpen(true)}
            aria-label={label}
          >
            <Sparkles />
            {!collapsed ? <span>{label}</span> : null}
          </Button>
        </TooltipTrigger>
        {collapsed ? (
          <TooltipContent side={tooltipSide}>{label}</TooltipContent>
        ) : null}
      </Tooltip>
      <AskAIPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
