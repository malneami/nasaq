'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusPill, TASK_PRIORITY_TONES } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { runSelectTasks } from '@/lib/tasks/actions';
import { TASK_SELECT_PRESETS } from '@/lib/tasks/constants';
import type { RankTasksResult, RankedPick, SelectReasonCode } from '@/lib/tasks/select';
import type { AppLocale } from '@/lib/i18n/routing';
import type { EnergyLevel } from '@/lib/db/schema';
import { ENERGY_LEVELS } from '@/lib/validations/task';

const SELECT_CLASS =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

function formatReason(
  pick: RankedPick,
  minutes: number,
  t: ReturnType<typeof useTranslations<'tasks'>>,
) {
  return pick.reasonCodes
    .map((code: SelectReasonCode) =>
      code === 'timeFit'
        ? t('reasons.timeFit', { minutes })
        : t(`reasons.${code}`),
    )
    .join(', ');
}

export function TaskSelectPanel({
  onOpenTask,
}: {
  onOpenTask: (taskId: string) => void;
}) {
  const t = useTranslations('tasks');
  const locale = useLocale() as AppLocale;
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState('30');
  const [energy, setEnergy] = useState<EnergyLevel | 'any'>('medium');
  const [context, setContext] = useState('@computer');
  const [pending, setPending] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [narration, setNarration] = useState<string | null>(null);
  const [result, setResult] = useState<RankTasksResult | null>(null);

  async function run() {
    const windowMinutes = Number(custom) || minutes;
    setPending(true);
    setNarration(null);
    const response = await runSelectTasks({
      minutes: windowMinutes,
      energy: energy === 'any' ? undefined : energy,
      context: context.trim() || undefined,
    });
    setPending(false);
    if (response.error || !response.result) {
      toast.error(t('selectFailed'));
      return;
    }
    setResult(response.result);
    setMinutes(windowMinutes);
  }

  async function explain() {
    if (!result || result.picks.length === 0) {
      return;
    }
    setNarrating(true);
    try {
      const response = await fetch('/api/tasks/suggest-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          energy: energy === 'any' ? undefined : energy,
          context: context.trim() || undefined,
          locale,
          picks: result.picks.map((pick) => ({
            title: pick.task.title,
            projectName: pick.task.projectName,
            estimatedMinutes: pick.task.estimatedMinutes,
            reasonCodes: pick.reasonCodes,
          })),
          skipped: result.skipped
            ? { title: result.skipped.title, code: result.skipped.code }
            : null,
        }),
      });
      const body = (await response.json()) as { narration?: string; error?: string };
      if (!response.ok || !body.narration) {
        toast.error(t('narrationFailed'));
        return;
      }
      setNarration(body.narration);
    } catch {
      toast.error(t('narrationFailed'));
    } finally {
      setNarrating(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{t('selectTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('selectHint')}</p>
        </div>
        <Button type="button" onClick={() => void run()} disabled={pending}>
          {t('whatShouldIDo')}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {TASK_SELECT_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={minutes === preset ? 'default' : 'outline'}
            onClick={() => {
              setMinutes(preset);
              setCustom(String(preset));
            }}
          >
            {t('minutesPreset', { minutes: preset })}
          </Button>
        ))}
        <div className="space-y-1">
          <Label htmlFor="select-custom" className="text-xs">
            {t('customMinutes')}
          </Label>
          <Input
            id="select-custom"
            className="h-8 w-24"
            inputMode="numeric"
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value);
              const next = Number(event.target.value);
              if (Number.isInteger(next) && next > 0) {
                setMinutes(next);
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="select-energy" className="text-xs">
            {t('currentEnergy')}
          </Label>
          <select
            id="select-energy"
            className={SELECT_CLASS}
            value={energy}
            onChange={(event) =>
              setEnergy(event.target.value as EnergyLevel | 'any')
            }
          >
            <option value="any">{t('anyEnergy')}</option>
            {ENERGY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`energies.${level}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="select-context" className="text-xs">
            {t('currentContext')}
          </Label>
          <Input
            id="select-context"
            className="h-8 w-40"
            placeholder="@computer"
            value={context}
            onChange={(event) => setContext(event.target.value)}
          />
        </div>
      </div>

      {result ? (
        <div className="space-y-3">
          {result.picks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('selectEmpty')}</p>
          ) : (
            <ol className="space-y-2">
              {result.picks.map((pick) => (
                <li key={pick.task.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border p-3 text-start"
                    onClick={() => onOpenTask(pick.task.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{pick.task.title}</p>
                      <StatusPill
                        label={t(`priorities.${pick.task.priority}`)}
                        tone={TASK_PRIORITY_TONES[pick.task.priority]}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatReason(pick, minutes, t)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pick.task.estimatedMinutes
                        ? t('estimatedLabel', {
                            minutes: pick.task.estimatedMinutes,
                          })
                        : t('noEstimate')}
                      {pick.task.projectName
                        ? ` · ${pick.task.projectName}`
                        : ` · ${t('standalone')}`}
                    </p>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {result.skipped ? (
            <p className="text-sm text-muted-foreground">
              {result.skipped.code === 'overtime'
                ? t('skippedOvertime', {
                    title: result.skipped.title,
                    estimated: result.skipped.estimatedMinutes ?? 0,
                    available: result.skipped.availableMinutes,
                  })
                : t(`skipped.${result.skipped.code}`, {
                    title: result.skipped.title,
                  })}
            </p>
          ) : null}
          {result.picks.length > 0 ? (
            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={narrating}
                onClick={() => void explain()}
              >
                {t('explainWithAi')}
              </Button>
              {narration ? (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  {narration}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
