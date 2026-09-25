'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  removeCalendarEvent,
  saveCalendarEvent,
} from '@/lib/calendar/actions';
import type { OccurringEvent } from '@/lib/calendar/types';
import { EVENT_TYPES, SHIFT_KINDS } from '@/lib/validations/calendar';
import { ymdInTimeZone, hourInTimeZone, minuteInTimeZone, pad2 } from '@/lib/time/zoned';

const SELECT =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

function hmFromIso(iso: string, timeZone: string): string {
  const d = new Date(iso);
  return `${pad2(hourInTimeZone(d, timeZone))}:${pad2(minuteInTimeZone(d, timeZone))}`;
}

function addOneHour(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  const next = ((h ?? 9) + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export function EventEditor({
  timeZone,
  initial,
  defaultStartYmd,
  defaultStartHm = '09:00',
  onDone,
}: {
  timeZone: string;
  initial?: OccurringEvent | null;
  defaultStartYmd: string;
  defaultStartHm?: string;
  onDone: () => void;
}) {
  const t = useTranslations('calendar');
  const [pending, startTransition] = useTransition();
  const editing = initial?.source === 'event' ? initial : null;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>(
    (editing?.eventType as (typeof EVENT_TYPES)[number]) ?? 'meeting',
  );
  const [startYmd, setStartYmd] = useState(
    editing
      ? ymdInTimeZone(new Date(editing.startsAt), timeZone)
      : defaultStartYmd,
  );
  const [endYmd, setEndYmd] = useState(
    editing
      ? ymdInTimeZone(new Date(editing.endsAt), timeZone)
      : defaultStartYmd,
  );
  const [startHm, setStartHm] = useState(
    editing ? hmFromIso(editing.startsAt, timeZone) : defaultStartHm,
  );
  const [endHm, setEndHm] = useState(
    editing ? hmFromIso(editing.endsAt, timeZone) : addOneHour(defaultStartHm),
  );
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [isProtected, setIsProtected] = useState(editing?.isProtected ?? false);
  const [shiftKind, setShiftKind] = useState<(typeof SHIFT_KINDS)[number] | ''>(
    (editing?.shiftKind as (typeof SHIFT_KINDS)[number]) ?? '',
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [recurrenceFreq, setRecurrenceFreq] = useState<
    'none' | 'daily' | 'weekly'
  >(editing?.recurring ? 'weekly' : 'none');

  function submit() {
    startTransition(async () => {
      const result = await saveCalendarEvent({
        id: editing?.id,
        title,
        eventType,
        startYmd,
        endYmd,
        startHm,
        endHm,
        allDay,
        isProtected,
        notes: notes || null,
        shiftKind: eventType === 'shift' ? shiftKind || null : null,
        projectId: editing?.projectId ?? null,
        contactId: editing?.contactId ?? null,
        recurrenceFreq,
        recurrenceInterval: 1,
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}` as 'errors.failed'));
        return;
      }
      toast.success(t('saved'));
      onDone();
    });
  }

  function destroy() {
    if (!editing) return;
    startTransition(async () => {
      const result = await removeCalendarEvent(editing.id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}` as 'errors.failed'));
        return;
      }
      toast.success(t('deleted'));
      onDone();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {editing ? t('editEvent') : t('newEvent')}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('close')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="cal-title">{t('fields.title')}</Label>
          <Input
            id="cal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('fields.titlePlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-type">{t('fields.type')}</Label>
          <select
            id="cal-type"
            className={SELECT}
            value={eventType}
            onChange={(e) =>
              setEventType(e.target.value as (typeof EVENT_TYPES)[number])
            }
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`eventTypes.${type}`)}
              </option>
            ))}
          </select>
        </div>
        {eventType === 'shift' ? (
          <div className="space-y-1.5">
            <Label htmlFor="cal-shift">{t('fields.shiftKind')}</Label>
            <select
              id="cal-shift"
              className={SELECT}
              value={shiftKind}
              onChange={(e) =>
                setShiftKind(e.target.value as (typeof SHIFT_KINDS)[number] | '')
              }
            >
              <option value="">{t('fields.shiftKindPick')}</option>
              {SHIFT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`shiftKinds.${kind}`)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="cal-start-d">{t('fields.start')}</Label>
          <Input
            id="cal-start-d"
            type="date"
            value={startYmd}
            onChange={(e) => setStartYmd(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-start-t">{t('fields.startTime')}</Label>
          <Input
            id="cal-start-t"
            type="time"
            value={startHm}
            disabled={allDay}
            onChange={(e) => setStartHm(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-end-d">{t('fields.end')}</Label>
          <Input
            id="cal-end-d"
            type="date"
            value={endYmd}
            onChange={(e) => setEndYmd(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-end-t">{t('fields.endTime')}</Label>
          <Input
            id="cal-end-t"
            type="time"
            value={endHm}
            disabled={allDay}
            onChange={(e) => setEndHm(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-rec">{t('fields.recurrence')}</Label>
          <select
            id="cal-rec"
            className={SELECT}
            value={recurrenceFreq}
            onChange={(e) =>
              setRecurrenceFreq(e.target.value as 'none' | 'daily' | 'weekly')
            }
          >
            <option value="none">{t('recurrence.none')}</option>
            <option value="daily">{t('recurrence.daily')}</option>
            <option value="weekly">{t('recurrence.weekly')}</option>
          </select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="cal-notes">{t('fields.notes')}</Label>
          <Textarea
            id="cal-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          {t('fields.allDay')}
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isProtected}
            onChange={(e) => setIsProtected(e.target.checked)}
          />
          {t('fields.protected')}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={submit} disabled={pending || !title.trim()}>
          {t('save')}
        </Button>
        {editing ? (
          <Button
            type="button"
            variant="destructive"
            onClick={destroy}
            disabled={pending}
          >
            {t('delete')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
