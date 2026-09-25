'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MorningBriefView } from '@/components/reviews/morning-brief';
import { EveningShutdownView } from '@/components/reviews/evening-shutdown';
import { WeeklyReviewStepper } from '@/components/reviews/weekly-stepper';
import { MonthlyScorecard } from '@/components/reviews/monthly-scorecard';
import { cn } from '@/lib/utils';

type Tab = 'morning' | 'shutdown' | 'weekly' | 'monthly';

export function ReviewHub({ initialTab }: { initialTab?: Tab }) {
  const t = useTranslations('review');
  const [tab, setTab] = useState<Tab>(initialTab ?? 'morning');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'morning', label: t('tabs.morning') },
    { id: 'shutdown', label: t('tabs.shutdown') },
    { id: 'weekly', label: t('tabs.weekly') },
    { id: 'monthly', label: t('tabs.monthly') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-t-lg px-3 py-2 text-sm font-medium',
              tab === item.id
                ? 'border border-b-0 border-border bg-background'
                : 'text-muted-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'morning' ? <MorningBriefView /> : null}
      {tab === 'shutdown' ? <EveningShutdownView /> : null}
      {tab === 'weekly' ? <WeeklyReviewStepper /> : null}
      {tab === 'monthly' ? <MonthlyScorecard /> : null}
    </div>
  );
}
