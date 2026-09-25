'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  removeProtectedBlock,
  saveProtectedBlock,
} from '@/lib/calendar/actions';
import type { ProtectedBlockDto } from '@/lib/calendar/types';

const SELECT =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function ProtectedPanel({
  blocks,
  onChanged,
}: {
  blocks: ProtectedBlockDto[];
  onChanged: () => void;
}) {
  const t = useTranslations('calendar');
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState('');
  const [weekday, setWeekday] = useState(5);
  const [startHm, setStartHm] = useState('18:00');
  const [endHm, setEndHm] = useState('20:00');
  const [eventType, setEventType] = useState<
    'family' | 'protected' | 'recovery' | 'other'
  >('family');

  function create() {
    startTransition(async () => {
      const result = await saveProtectedBlock({
        label,
        weekday,
        startHm,
        endHm,
        eventType,
        isProtected: true,
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}` as 'errors.failed'));
        return;
      }
      setLabel('');
      toast.success(t('protectedSaved'));
      onChanged();
    });
  }

  function destroy(id: string) {
    startTransition(async () => {
      const result = await removeProtectedBlock(id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}` as 'errors.failed'));
        return;
      }
      toast.success(t('deleted'));
      onChanged();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div>
        <h3 className="text-sm font-semibold">{t('protectedTitle')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('protectedHint')}</p>
      </div>

      <ul className="space-y-2">
        {blocks.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t('protectedEmpty')}</li>
        ) : (
          blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{block.label}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`weekdays.${String(block.weekday) as '0'}`)} · {block.startHm}–{block.endHm}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => destroy(block.id)}
              >
                {t('delete')}
              </Button>
            </li>
          ))
        )}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="prot-label">{t('fields.title')}</Label>
          <Input
            id="prot-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('protectedPlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prot-day">{t('fields.weekday')}</Label>
          <select
            id="prot-day"
            className={SELECT}
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {t(`weekdays.${d}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prot-type">{t('fields.type')}</Label>
          <select
            id="prot-type"
            className={SELECT}
            value={eventType}
            onChange={(e) =>
              setEventType(
                e.target.value as 'family' | 'protected' | 'recovery' | 'other',
              )
            }
          >
            <option value="family">{t('eventTypes.family')}</option>
            <option value="protected">{t('eventTypes.protected')}</option>
            <option value="recovery">{t('eventTypes.recovery')}</option>
            <option value="other">{t('eventTypes.other')}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prot-start">{t('fields.startTime')}</Label>
          <Input
            id="prot-start"
            type="time"
            value={startHm}
            onChange={(e) => setStartHm(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prot-end">{t('fields.endTime')}</Label>
          <Input
            id="prot-end"
            type="time"
            value={endHm}
            onChange={(e) => setEndHm(e.target.value)}
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={create}
        disabled={pending || !label.trim()}
      >
        {t('addProtected')}
      </Button>
    </div>
  );
}
