'use client';

import { useTranslations } from 'next-intl';
import { AskAIChat } from '@/components/layout/ask-ai-chat';
import { useDirection } from '@/components/ui/direction';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function AskAIPanel({
  open,
  onOpenChange,
  initialDemand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDemand?: string;
}) {
  const t = useTranslations('askAi');
  const dir = useDirection();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={dir === 'rtl' ? 'left' : 'right'}
        closeLabel={t('close')}
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('subtitle')}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex min-h-0 flex-1 flex-col pb-2">
          {open ? <AskAIChat initialDemand={initialDemand} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
