'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { completeShutdown, fetchShutdown } from '@/lib/reviews/actions';
import { Link } from '@/lib/i18n/navigation';

export function EveningShutdownView() {
  const t = useTranslations('review.shutdown');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['shutdown'],
    queryFn: async () => {
      const result = await fetchShutdown();
      if (result.error || !result.shutdown) {
        throw new Error(result.error ?? 'failed');
      }
      return result.shutdown;
    },
  });

  const [carry, setCarry] = useState<Set<string>>(new Set());
  const [reflection, setReflection] = useState({
    completedNotes: '',
    unfinishedNotes: '',
    ideas: '',
    commitments: '',
    followUps: '',
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (query.data?.reflection) {
      setReflection(query.data.reflection);
    }
    if (query.data?.carryOverCandidates?.length) {
      setCarry(new Set(query.data.carryOverCandidates.map((c) => c.id)));
    }
  }, [query.data]);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!query.data) {
    return <p className="text-sm text-muted-foreground">{t('failed')}</p>;
  }

  const model = query.data;

  async function save() {
    setPending(true);
    try {
      const result = await completeShutdown({
        reflection,
        carryOverIds: [...carry],
        unfinished: model.unfinished,
      });
      if (result.error) {
        toast.error(t('failed'));
        return;
      }
      toast.success(t('saved'));
      void queryClient.invalidateQueries({ queryKey: ['shutdown'] });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('hint')}</p>
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          {t('noAutoPromote')}
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t('completed')}</h3>
        {model.completedOutcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('none')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {model.completedOutcomes.map((o) => (
              <li key={o.id}>{o.text}</li>
            ))}
          </ul>
        )}
        <Label>{t('completedNotes')}</Label>
        <Textarea
          value={reflection.completedNotes}
          onChange={(e) =>
            setReflection((r) => ({ ...r, completedNotes: e.target.value }))
          }
          rows={2}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t('unfinished')}</h3>
        <p className="text-xs text-muted-foreground">{t('unfinishedHint')}</p>
        {model.unfinished.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('none')}</p>
        ) : (
          <ul className="space-y-2">
            {model.unfinished.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={carry.has(item.id)}
                  onChange={(e) => {
                    setCarry((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    });
                  }}
                />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('carryHint')}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t('ideas')}</Label>
          <Textarea
            value={reflection.ideas}
            onChange={(e) =>
              setReflection((r) => ({ ...r, ideas: e.target.value }))
            }
            rows={2}
            placeholder={t('ideasPlaceholder')}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('commitments')}</Label>
          <Textarea
            value={reflection.commitments}
            onChange={(e) =>
              setReflection((r) => ({ ...r, commitments: e.target.value }))
            }
            rows={2}
            placeholder={t('commitmentsPlaceholder')}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>{t('followUps')}</Label>
          <Textarea
            value={reflection.followUps}
            onChange={(e) =>
              setReflection((r) => ({ ...r, followUps: e.target.value }))
            }
            rows={2}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => void save()}>
          {pending ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/today">{t('backToday')}</Link>
        </Button>
      </div>

      {model.completedAt ? (
        <p className="text-xs text-muted-foreground">
          {t('completedAt', { at: model.completedAt.slice(0, 16) })}
        </p>
      ) : null}
    </div>
  );
}
