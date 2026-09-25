'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { CommitmentsBoard } from '@/components/people/commitments-board';
import { ContactsList } from '@/components/people/contacts-list';
import { WaitingBoard } from '@/components/people/waiting-board';
import { cn } from '@/lib/utils';

type PeopleTab = 'contacts' | 'waiting' | 'commitments';

function PeopleTabs() {
  const t = useTranslations('people');
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initial: PeopleTab =
    tabParam === 'waiting' || tabParam === 'commitments'
      ? tabParam
      : 'contacts';
  const [tab, setTab] = useState<PeopleTab>(initial);

  const tabs: { id: PeopleTab; label: string }[] = [
    { id: 'contacts', label: t('tabs.contacts') },
    { id: 'waiting', label: t('tabs.waiting') },
    { id: 'commitments', label: t('tabs.commitments') },
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
              'rounded-t-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === item.id
                ? 'border border-b-0 border-border bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'contacts' ? <ContactsList /> : null}
      {tab === 'waiting' ? <WaitingBoard /> : null}
      {tab === 'commitments' ? <CommitmentsBoard /> : null}
    </div>
  );
}

export function PeopleWorkbench() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
      <PeopleTabs />
    </Suspense>
  );
}
