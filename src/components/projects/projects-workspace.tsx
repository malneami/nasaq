'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { GoalsWorkbench } from '@/components/goals/goals-workbench';
import { PortfolioBoard } from '@/components/projects/portfolio-board';
import { TasksWorkbench } from '@/components/tasks/tasks-workbench';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

export function ProjectsWorkspace() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab =
    tabParam === 'goals' ? 'goals' : tabParam === 'tasks' ? 'tasks' : 'projects';

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-lg border border-border p-1">
        <Button
          type="button"
          size="sm"
          variant={tab === 'projects' ? 'default' : 'ghost'}
          className="flex-1"
          asChild
        >
          <Link href="/projects">{t('projectsWorkspace.projectsTab')}</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === 'goals' ? 'default' : 'ghost'}
          className="flex-1"
          asChild
        >
          <Link href={{ pathname: '/projects', query: { tab: 'goals' } }}>
            {t('projectsWorkspace.goalsTab')}
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === 'tasks' ? 'default' : 'ghost'}
          className="flex-1"
          asChild
        >
          <Link href={{ pathname: '/projects', query: { tab: 'tasks' } }}>
            {t('projectsWorkspace.tasksTab')}
          </Link>
        </Button>
      </div>
      {tab === 'goals' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('goals.intro')}</p>
          <GoalsWorkbench />
        </div>
      ) : tab === 'tasks' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('tasks.intro')}</p>
          <TasksWorkbench />
        </div>
      ) : (
        <PortfolioBoard />
      )}
    </div>
  );
}
