'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  getPortfolioMeta,
  saveProjectStageOrder,
} from '@/lib/projects/actions';
import { PROJECT_STAGES } from '@/lib/projects/stages';
import type { ProjectStage } from '@/lib/db/schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function ProjectStagesSettings() {
  const t = useTranslations('projects');
  const queryClient = useQueryClient();
  const metaQuery = useQuery({
    queryKey: ['project-meta'],
    queryFn: async () => getPortfolioMeta(),
  });
  const [local, setLocal] = useState<ProjectStage[] | null>(null);
  const stages = local ?? metaQuery.data?.stages ?? [...PROJECT_STAGES];

  function move(index: number, direction: -1 | 1) {
    const next = [...stages];
    const target = index + direction;
    if (target < 0 || target >= next.length) {
      return;
    }
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setLocal(next);
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-1">
        {stages.map((stage, index) => (
          <li
            key={stage}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          >
            <span>{t(`stages.${stage}`)}</span>
            <span className="flex gap-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        onClick={async () => {
          const result = await saveProjectStageOrder(stages);
          if (result.error) {
            toast.error(t('saveFailed'));
            return;
          }
          toast.success(t('saved'));
          await queryClient.invalidateQueries({ queryKey: ['project-meta'] });
        }}
      >
        {t('save')}
      </Button>
    </div>
  );
}
