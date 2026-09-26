import { Suspense } from 'react';
import { getMessages } from 'next-intl/server';
import { TodayAttention } from '@/components/today/today-attention';
import { TodayFinance } from '@/components/today/today-finance';
import { TodayFollowUps } from '@/components/today/today-followups';
import { TodayHeaderView } from '@/components/today/today-header';
import {
  TodayOutcomes,
  type TodayMessages,
} from '@/components/today/today-outcomes';
import { TodaySchedule } from '@/components/today/today-schedule';
import { TodaySkeleton } from '@/components/today/today-section';
import { getTodayModel } from '@/lib/today/load';

async function TodayLead() {
  const [model, messages] = await Promise.all([getTodayModel(), getMessages()]);
  return (
    <div className="space-y-8">
      <TodayHeaderView header={model.header} />
      <TodayOutcomes
        initial={model.outcomes}
        messages={messages.today as TodayMessages}
      />
    </div>
  );
}

async function TodaySchedulePane() {
  const model = await getTodayModel();
  return (
    <TodaySchedule items={model.schedule} timezone={model.header.timezone} />
  );
}

async function TodayFollowPane() {
  const model = await getTodayModel();
  return <TodayFollowUps items={model.followUps} />;
}

async function TodayFinancePane() {
  const model = await getTodayModel();
  return <TodayFinance finance={model.finance} />;
}

async function TodayAttentionPane() {
  const model = await getTodayModel();
  return <TodayAttention items={model.attention} />;
}

export function TodayBoard() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<TodaySkeleton lines={5} />}>
        <TodayLead />
      </Suspense>
      <div className="grid gap-8 lg:grid-cols-2">
        <Suspense fallback={<TodaySkeleton />}>
          <TodaySchedulePane />
        </Suspense>
        <Suspense fallback={<TodaySkeleton />}>
          <TodayFollowPane />
        </Suspense>
        <Suspense fallback={<TodaySkeleton />}>
          <TodayFinancePane />
        </Suspense>
        <Suspense fallback={<TodaySkeleton />}>
          <TodayAttentionPane />
        </Suspense>
      </div>
    </div>
  );
}
