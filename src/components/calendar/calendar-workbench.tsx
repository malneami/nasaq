'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EventEditor } from '@/components/calendar/event-editor';
import { ProtectedPanel } from '@/components/calendar/protected-panel';
import {
  capacityBarClass,
  eventTypeClass,
} from '@/components/calendar/event-style';
import {
  loadCalendarBoard,
  moveCalendarEvent,
} from '@/lib/calendar/actions';
import type {
  CalendarBoardDto,
  OccurringEvent,
} from '@/lib/calendar/types';
import type { DayCapacity } from '@/lib/capacity/types';
import {
  addDaysYmd,
  formatTimeInZone,
  formatYmdLocalized,
  hourInTimeZone,
  minuteInTimeZone,
  ymdInTimeZone,
  zonedDateTimeToUtc,
} from '@/lib/time/zoned';
import { cn } from '@/lib/utils';

type View = 'day' | 'week' | 'month';
type Panel = 'none' | 'event' | 'protected';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06–22
const DAY_PX = 56;

function eventsForDay(
  events: OccurringEvent[],
  ymd: string,
  timeZone: string,
) {
  return events.filter((ev) => {
    const start = ymdInTimeZone(new Date(ev.startsAt), timeZone);
    const end = ymdInTimeZone(new Date(ev.endsAt), timeZone);
    return start <= ymd && end >= ymd;
  });
}

function topOffset(iso: string, timeZone: string) {
  const d = new Date(iso);
  const h = hourInTimeZone(d, timeZone);
  const m = minuteInTimeZone(d, timeZone);
  return ((h - 6) * 60 + m) * (DAY_PX / 60);
}

function heightPx(startIso: string, endIso: string) {
  const minutes = Math.max(
    30,
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
  return minutes * (DAY_PX / 60);
}

function CapacityChip({ day }: { day: DayCapacity }) {
  const t = useTranslations('calendar');
  const fill =
    day.freeHours <= 0
      ? 0
      : Math.round((day.productiveHours / day.freeHours) * 100);
  return (
    <div className="space-y-1" title={t('capacityTooltip', {
      free: day.freeHours,
      productive: day.productiveHours,
    })}>
      <p className="text-[10px] leading-tight text-muted-foreground">
        {t('capacityShort', {
          free: day.freeHours,
          productive: day.productiveHours,
        })}
      </p>
      <div className={capacityBarClass(day.freeHours, day.productiveHours)}>
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${Math.min(100, fill)}%` }}
        />
      </div>
    </div>
  );
}

function TimedEventChip({
  event,
  timeZone,
  locale,
  onSelect,
  onMoved,
}: {
  event: OccurringEvent;
  timeZone: string;
  locale: string;
  onSelect: () => void;
  onMoved: () => void;
}) {
  const t = useTranslations('calendar');
  const [, startTransition] = useTransition();
  const top = Math.max(0, topOffset(event.startsAt, timeZone));
  const height = Math.min(heightPx(event.startsAt, event.endsAt), 17 * DAY_PX - top);
  const canDrag = event.source === 'event' && !event.recurring && !event.allDay;

  return (
    <button
      type="button"
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return;
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({
            id: event.id,
            durationMs:
              new Date(event.endsAt).getTime() -
              new Date(event.startsAt).getTime(),
          }),
        );
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onSelect}
      className={cn(
        'absolute start-1 end-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-start text-[11px] leading-tight shadow-sm',
        eventTypeClass(event.eventType, event.isProtected),
        canDrag && 'cursor-grab active:cursor-grabbing',
      )}
      style={{ top, height }}
      title={`${event.title} · ${formatTimeInZone(new Date(event.startsAt), locale, timeZone)}`}
    >
      <span className="font-medium line-clamp-2">{event.title}</span>
      {event.source === 'block' ? (
        <span className="block text-[9px] opacity-70">{t('protectedBadge')}</span>
      ) : null}
    </button>
  );
}

function DayColumn({
  ymd,
  events,
  capacity,
  timeZone,
  locale,
  isToday,
  onSelect,
  onCreateAt,
  onMoved,
}: {
  ymd: string;
  events: OccurringEvent[];
  capacity: DayCapacity | null;
  timeZone: string;
  locale: string;
  isToday: boolean;
  onSelect: (ev: OccurringEvent) => void;
  onCreateAt: (ymd: string, hm: string) => void;
  onMoved: () => void;
}) {
  const t = useTranslations('calendar');
  const [, startTransition] = useTransition();
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    let payload: { id: string; durationMs: number };
    try {
      payload = JSON.parse(raw) as { id: string; durationMs: number };
    } catch {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromSix = Math.round(y / (DAY_PX / 60) / 15) * 15;
    const totalMinutes = Math.max(0, Math.min(16 * 60, minutesFromSix));
    const hour = 6 + Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const hm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const startsAt = zonedDateTimeToUtc(ymd, hm, timeZone);
    const endsAt = new Date(startsAt.getTime() + payload.durationMs);
    startTransition(async () => {
      const result = await moveCalendarEvent({
        eventId: payload.id,
        startIso: startsAt.toISOString(),
        endIso: endsAt.toISOString(),
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}` as 'errors.failed'));
        return;
      }
      onMoved();
    });
  }

  return (
    <div
      className={cn(
        'min-w-0 border-e border-border last:border-e-0',
        isToday && 'bg-primary/[0.03]',
      )}
    >
      <div className="sticky top-0 z-10 space-y-1 border-b border-border bg-background/95 px-2 py-2 backdrop-blur">
        <p className="text-xs font-medium">
          {formatYmdLocalized(ymd, locale, timeZone).split(',')[0] ?? ymd}
        </p>
        <p className="text-[10px] text-muted-foreground">{ymd.slice(5)}</p>
        {capacity ? <CapacityChip day={capacity} /> : null}
      </div>
      {allDay.length > 0 ? (
        <div className="space-y-1 border-b border-border px-1 py-1">
          {allDay.map((ev) => (
            <button
              key={ev.occurrenceKey}
              type="button"
              onClick={() => onSelect(ev)}
              className={cn(
                'w-full rounded border px-1.5 py-0.5 text-start text-[10px]',
                eventTypeClass(ev.eventType, ev.isProtected),
              )}
            >
              {ev.title}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="relative"
        style={{ height: HOURS.length * DAY_PX }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const minutesFromSix = Math.round(y / (DAY_PX / 60) / 30) * 30;
          const hour = 6 + Math.floor(minutesFromSix / 60);
          const minute = minutesFromSix % 60;
          onCreateAt(
            ymd,
            `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          );
        }}
      >
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="border-b border-border/60"
            style={{ height: DAY_PX }}
          />
        ))}
        {timed.map((ev) => (
          <TimedEventChip
            key={ev.occurrenceKey}
            event={ev}
            timeZone={timeZone}
            locale={locale}
            onSelect={() => onSelect(ev)}
            onMoved={onMoved}
          />
        ))}
      </div>
    </div>
  );
}

export function CalendarWorkbench({
  initialBoard = null,
  initialError = null,
}: {
  initialBoard?: CalendarBoardDto | null;
  initialError?: string | null;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const [view, setView] = useState<View>(initialBoard?.view ?? 'week');
  const [anchorYmd, setAnchorYmd] = useState(
    () => initialBoard?.anchorYmd ?? new Date().toISOString().slice(0, 10),
  );
  const [panel, setPanel] = useState<Panel>('none');
  const [selected, setSelected] = useState<OccurringEvent | null>(null);
  const [draftHm, setDraftHm] = useState('09:00');

  const [board, setBoard] = useState<CalendarBoardDto | null>(initialBoard);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(!initialBoard && !initialError);
  const bootstrapped = useRef(Boolean(initialBoard || initialError));

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await loadCalendarBoard({ view, anchorYmd });
      if (!result.ok) {
        setLoadError(result.error);
        setBoard(null);
        return;
      }
      setBoard(result.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'failed');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [view, anchorYmd]);

  useEffect(() => {
    if (bootstrapped.current) {
      bootstrapped.current = false;
      return;
    }
    void refresh();
  }, [refresh]);

  const data = board;
  const timeZone = data?.timeZone ?? 'Asia/Riyadh';
  const todayYmd = useMemo(
    () => ymdInTimeZone(new Date(), timeZone),
    [timeZone],
  );
  const weekDays = useMemo(() => {
    if (!data) return [];
    const start = data.weekStartYmd;
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
  }, [data]);

  const monthDays = useMemo(() => {
    if (!data || view !== 'month') return [];
    const days: string[] = [];
    let cursor = data.rangeStartYmd;
    while (cursor <= data.rangeEndYmd) {
      days.push(cursor);
      cursor = addDaysYmd(cursor, 1);
    }
    return days;
  }, [data, view]);

  function shiftAnchor(delta: number) {
    const step = view === 'day' ? 1 : view === 'week' ? 7 : 28;
    setAnchorYmd((prev) => addDaysYmd(prev, delta * step));
  }

  function openNew(ymd = anchorYmd, hm = '09:00') {
    setSelected(null);
    setDraftHm(hm);
    setAnchorYmd(ymd);
    setPanel('event');
  }

  if (loadError) {
    const message =
      loadError === 'database' ||
      loadError === 'unauthenticated' ||
      loadError === 'invalid' ||
      loadError === 'invalidRange' ||
      loadError === 'notFound'
        ? t(`errors.${loadError}` as 'errors.failed')
        : t('errors.failed');
    return (
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{message}</p>
      </div>
    );
  }

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  const weekCap = data.weekCapacity;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => shiftAnchor(-1)}>
            {t('prev')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAnchorYmd(todayYmd)}
          >
            {t('today')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => shiftAnchor(1)}>
            {t('next')}
          </Button>
          <p className="ms-2 text-sm font-medium">
            {view === 'month'
              ? data.anchorYmd.slice(0, 7)
              : formatYmdLocalized(data.weekStartYmd, locale, timeZone)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant={view === v ? 'default' : 'outline'}
              onClick={() => setView(v)}
            >
              {t(`views.${v}`)}
            </Button>
          ))}
          <Button type="button" size="sm" onClick={() => openNew()}>
            {t('newEvent')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setPanel(panel === 'protected' ? 'none' : 'protected')}
          >
            {t('protectedTitle')}
          </Button>
        </div>
      </div>

      {weekCap ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium">
            {t('weekSummary', {
              free: weekCap.freeHours,
              productive: weekCap.productiveHours,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('weekSummaryHint')}</p>
        </div>
      ) : null}

      {panel === 'event' ? (
        <EventEditor
          timeZone={timeZone}
          initial={selected}
          defaultStartYmd={selected
            ? ymdInTimeZone(new Date(selected.startsAt), timeZone)
            : anchorYmd}
          defaultStartHm={draftHm}
          onDone={() => {
            setPanel('none');
            setSelected(null);
            refresh();
          }}
        />
      ) : null}

      {panel === 'protected' ? (
        <ProtectedPanel
          blocks={data.protectedBlocks}
          onChanged={refresh}
        />
      ) : null}

      {view === 'month' ? (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {monthDays.map((ymd) => {
            const dayEvents = eventsForDay(data.events, ymd, timeZone);
            const inMonth = ymd.slice(0, 7) === data.anchorYmd.slice(0, 7);
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => {
                  setView('day');
                  setAnchorYmd(ymd);
                }}
                className={cn(
                  'min-h-24 bg-background p-2 text-start align-top',
                  !inMonth && 'opacity-45',
                  ymd === todayYmd && 'ring-1 ring-inset ring-primary/40',
                )}
              >
                <p className="text-xs font-medium">{ymd.slice(8)}</p>
                <ul className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <li
                      key={ev.occurrenceKey}
                      className={cn(
                        'truncate rounded px-1 text-[10px]',
                        eventTypeClass(ev.eventType, ev.isProtected),
                      )}
                    >
                      {ev.title}
                    </li>
                  ))}
                  {dayEvents.length > 3 ? (
                    <li className="text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3}
                    </li>
                  ) : null}
                </ul>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <div
            className={cn(
              'grid min-w-[720px]',
              view === 'day' ? 'grid-cols-[3rem_1fr]' : 'grid-cols-[3rem_repeat(7,minmax(0,1fr))]',
            )}
          >
            <div className="border-e border-border">
              <div className="h-[4.5rem] border-b border-border" />
              <div style={{ height: HOURS.length * DAY_PX }}>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="px-1 text-[10px] text-muted-foreground"
                    style={{ height: DAY_PX }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>
            {(view === 'day' ? [data.anchorYmd] : weekDays).map((ymd) => (
              <DayColumn
                key={ymd}
                ymd={ymd}
                events={eventsForDay(data.events, ymd, timeZone)}
                capacity={
                  weekCap?.days.find((d) => d.dateYmd === ymd) ?? null
                }
                timeZone={timeZone}
                locale={locale}
                isToday={ymd === todayYmd}
                onSelect={(ev) => {
                  if (ev.source === 'block') {
                    setPanel('protected');
                    return;
                  }
                  setSelected(ev);
                  setPanel('event');
                }}
                onCreateAt={(day, hm) => {
                  setDraftHm(hm);
                  openNew(day, hm);
                }}
                onMoved={refresh}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('hints', { time: draftHm })}
      </p>
    </div>
  );
}
