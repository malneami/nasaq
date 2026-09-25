'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LifeAreaMultiSelect } from '@/components/life-areas';
import { ActivityPanel } from '@/components/projects/activity-panel';
import { ConfirmDialog } from '@/components/projects/confirm-dialog';
import { NotesPanel } from '@/components/projects/notes-panel';
import { TaskWithSubtasks } from '@/components/projects/subtask-row';
import {
  PROJECT_STATE_TONES,
  RISK_LEVEL_TONES,
  StatusPill,
} from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { listLifeAreaRows } from '@/lib/life-areas/actions';
import {
  addProjectCommitment,
  addProjectLink,
  addProjectMilestone,
  addProjectPerson,
  addProjectTask,
  addProjectWaitingItem,
  changeProjectStage,
  changeProjectState,
  dismissProjectRecommendation,
  getPortfolioMeta,
  getProjectWorkspace,
  listProjectContactOptions,
  listProjectGoalOptions,
  listProjectRecommendations,
  markRecommendationAccepted,
  removeProjectLink,
  removeProjectPerson,
  saveProjectIdentity,
  saveProjectProgress,
  saveProjectResources,
  saveProjectRisk,
  saveProjectScore,
} from '@/lib/projects/actions';
import {
  SCORE_FACTORS,
  SCORE_WEIGHTS,
  computePriorityScore,
  DEFAULT_SCORE_FACTORS,
  type ScoreFactorKey,
  type ScoreFactors,
} from '@/lib/projects/score';
import { adjacentStage, AI_ACTION_TO_STATE } from '@/lib/projects/stages';
import type {
  ProjectIdentityInput,
  ProjectProgressInput,
  ProjectResourcesInput,
  ProjectRiskInput,
} from '@/lib/validations/project';
import { formatMoney, toMajor } from '@/lib/money';
import { Link } from '@/lib/i18n/navigation';
import type { AppLocale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';
import type { AiAction, ProjectState, RiskLevel } from '@/lib/db/schema';

const TABS = [
  'identity',
  'progress',
  'execution',
  'notes',
  'people',
  'resources',
  'risk',
  'score',
  'activity',
] as const;

type Tab = (typeof TABS)[number];

export function ProjectDetail({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('identity');
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<{
    state: ProjectState;
    activeCount: number;
    activeLimit: number;
    recommendationId?: string;
  } | null>(null);

  const workspaceKey = ['project-workspace', projectId] as const;
  const recsKey = ['project-recs', projectId] as const;

  const workspaceQuery = useQuery({
    queryKey: workspaceKey,
    queryFn: async () => {
      const result = await getProjectWorkspace(projectId);
      if (result.error || !result.workspace) {
        throw new Error(result.error ?? 'notFound');
      }
      return result.workspace;
    },
  });
  const metaQuery = useQuery({
    queryKey: ['project-meta'],
    queryFn: async () => getPortfolioMeta(),
  });
  const recsQuery = useQuery({
    queryKey: recsKey,
    queryFn: async () => {
      const result = await listProjectRecommendations(projectId);
      return result.recommendations ?? [];
    },
  });
  const areasQuery = useQuery({
    queryKey: ['life-areas'],
    queryFn: async () => (await listLifeAreaRows(true)).areas ?? [],
  });
  const goalsQuery = useQuery({
    queryKey: ['goal-options'],
    queryFn: async () => (await listProjectGoalOptions()).goals ?? [],
  });
  const contactsQuery = useQuery({
    queryKey: ['contact-options'],
    queryFn: async () => (await listProjectContactOptions()).contacts ?? [],
  });

  const workspace = workspaceQuery.data;
  const stages = metaQuery.data?.stages ?? [];
  const pendingRec = recsQuery.data?.find((row) => row.status === 'pending');

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: workspaceKey });
    await queryClient.invalidateQueries({ queryKey: recsKey });
    await queryClient.invalidateQueries({ queryKey: ['project-cards'] });
    await queryClient.invalidateQueries({ queryKey: ['project-meta'] });
  }

  async function applyState(
    state: ProjectState,
    confirmOverLimit = false,
    recommendationId?: string,
  ) {
    setPending(true);
    const result = await changeProjectState({
      projectId,
      state,
      confirmOverLimit,
    });
    setPending(false);
    if (result.needsConfirm) {
      setConfirm({
        state,
        activeCount: result.activeCount ?? 0,
        activeLimit: result.activeLimit ?? 3,
        recommendationId,
      });
      return;
    }
    if (result.error === 'desiredOutcomeRequired') {
      toast.error(t('desiredOutcomeRequired'));
      return;
    }
    if (result.error === 'nextActionRequired') {
      toast.error(t('nextActionRequired'));
      return;
    }
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    if (recommendationId) {
      await markRecommendationAccepted(recommendationId);
    }
    setConfirm(null);
    toast.success(t('saved'));
    await refresh();
  }

  if (workspaceQuery.isError) {
    return <p className="text-sm text-destructive">{t('loadFailed')}</p>;
  }
  if (!workspace) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  const project = workspace.project;
  const prevStage = adjacentStage(stages, project.stage, -1);
  const nextStage = adjacentStage(stages, project.stage, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/projects" className="text-xs text-muted-foreground">
            {t('back')}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{project.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1">
            <StatusPill
              label={t(`states.${project.state}`)}
              tone={PROJECT_STATE_TONES[project.state]}
            />
            <StatusPill
              label={t(`risk.${project.riskLevel}`)}
              tone={RISK_LEVEL_TONES[project.riskLevel]}
            />
            {!project.nextAction ? (
              <StatusPill label={t('noNextAction')} tone="danger" />
            ) : null}
          </div>
        </div>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          value={project.state}
          onChange={(event) =>
            void applyState(event.target.value as ProjectState)
          }
        >
          {(
            [
              'active',
              'maintain',
              'waiting',
              'incubator',
              'someday',
              'completed',
              'stopped',
            ] as ProjectState[]
          ).map((state) => (
            <option key={state} value={state}>
              {t(`states.${state}`)}
            </option>
          ))}
        </select>
      </div>

      <ol className="flex flex-wrap gap-1">
        {stages.map((stage) => {
          const current = stage === project.stage;
          return (
            <li key={stage}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (current) {
                    return;
                  }
                  void (async () => {
                    setPending(true);
                    const result = await changeProjectStage({
                      projectId,
                      stage,
                    });
                    setPending(false);
                    if (result.error) {
                      toast.error(t('saveFailed'));
                      return;
                    }
                    await refresh();
                  })();
                }}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs',
                  current
                    ? 'border-ring bg-muted font-medium'
                    : 'border-border text-muted-foreground',
                )}
              >
                {t(`stages.${stage}`)}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!prevStage || pending}
          onClick={() => prevStage && void changeProjectStage({ projectId, stage: prevStage }).then(refresh)}
        >
          {t('stageBack')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!nextStage || pending}
          onClick={() => nextStage && void changeProjectStage({ projectId, stage: nextStage }).then(refresh)}
        >
          {t('stageForward')}
        </Button>
      </div>

      {pendingRec ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-medium">
            {t('aiSuggestion', {
              action: t(`aiActions.${pendingRec.recommendation}`),
            })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingRec.rationale}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('aiConfidence', {
              value: Math.round(pendingRec.confidence * 100),
            })}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() =>
                void applyState(
                  AI_ACTION_TO_STATE[pendingRec.recommendation as AiAction],
                  false,
                  pendingRec.id,
                )
              }
            >
              {t('accept')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void dismissProjectRecommendation(pendingRec.id).then(refresh)
              }
            >
              {t('dismiss')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-lg border p-1">
        {TABS.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={tab === item ? 'default' : 'ghost'}
            onClick={() => setTab(item)}
          >
            {t(`tabs.${item}`)}
          </Button>
        ))}
      </div>

      {tab === 'identity' ? (
        <IdentityForm
          workspace={workspace}
          areas={areasQuery.data ?? []}
          goals={goalsQuery.data ?? []}
          pending={pending}
          onSave={async (values) => {
            setPending(true);
            const result = await saveProjectIdentity(projectId, values);
            setPending(false);
            if (result.error === 'desiredOutcomeRequired') {
              toast.error(t('desiredOutcomeRequired'));
              return;
            }
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            toast.success(t('saved'));
            await refresh();
          }}
        />
      ) : null}

      {tab === 'progress' ? (
        <ProgressForm
          workspace={workspace}
          pending={pending}
          onSave={async (values) => {
            setPending(true);
            const result = await saveProjectProgress(projectId, values);
            setPending(false);
            if (result.error === 'nextActionRequired') {
              toast.error(t('nextActionRequired'));
              return;
            }
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            toast.success(t('saved'));
            await refresh();
          }}
          onAddMilestone={async (title, targetDate) => {
            const result = await addProjectMilestone(projectId, {
              title,
              targetDate,
            });
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            await refresh();
          }}
        />
      ) : null}

      {tab === 'execution' ? (
        <ExecutionPanel
          workspace={workspace}
          projectId={projectId}
          onAddTask={async (title) => {
            const result = await addProjectTask(projectId, { title });
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            await refresh();
          }}
          onAddCommitment={async (description, direction) => {
            const result = await addProjectCommitment(projectId, {
              description,
              direction,
            });
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            await refresh();
          }}
          onAddWaiting={async (item) => {
            const result = await addProjectWaitingItem(projectId, { item });
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            await refresh();
          }}
          onAddLink={async (url, label) => {
            const result = await addProjectLink(projectId, { url, label });
            if (result.error) {
              toast.error(t('invalidLink'));
              return;
            }
            await refresh();
          }}
          onRemoveLink={async (url) => {
            await removeProjectLink(projectId, url);
            await refresh();
          }}
        />
      ) : null}

      {tab === 'notes' ? <NotesPanel projectId={projectId} /> : null}

      {tab === 'people' ? (
        <PeoplePanel
          workspace={workspace}
          contacts={contactsQuery.data ?? []}
          onAdd={async (contactId, role) => {
            const result = await addProjectPerson(projectId, { contactId, role });
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            await refresh();
          }}
          onRemove={async (contactId) => {
            await removeProjectPerson(projectId, contactId);
            await refresh();
          }}
        />
      ) : null}

      {tab === 'resources' ? (
        <ResourcesForm
          workspace={workspace}
          locale={locale}
          pending={pending}
          onSave={async (values) => {
            setPending(true);
            const result = await saveProjectResources(projectId, values);
            setPending(false);
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            toast.success(t('saved'));
            await refresh();
          }}
        />
      ) : null}

      {tab === 'risk' ? (
        <RiskForm
          workspace={workspace}
          pending={pending}
          onSave={async (values) => {
            setPending(true);
            const result = await saveProjectRisk(projectId, values);
            setPending(false);
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            toast.success(t('saved'));
            await refresh();
          }}
        />
      ) : null}

      {tab === 'score' ? (
        <ScorePanel
          workspace={workspace}
          pending={pending}
          onSave={async (factors) => {
            setPending(true);
            const result = await saveProjectScore(projectId, factors);
            setPending(false);
            if (result.error) {
              toast.error(t('saveFailed'));
              return;
            }
            toast.success(t('saved'));
            await refresh();
          }}
          onRecommend={async () => {
            setPending(true);
            const response = await fetch(`/api/projects/${projectId}/recommend`, {
              method: 'POST',
            });
            setPending(false);
            if (!response.ok) {
              toast.error(t('aiFailed'));
              return;
            }
            toast.success(t('aiReady'));
            await refresh();
          }}
        />
      ) : null}

      {tab === 'activity' ? <ActivityPanel projectId={projectId} /> : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={t('overLimitTitle')}
        body={t('overLimitBody', { limit: confirm?.activeLimit ?? 3 })}
        confirmLabel={t('continue')}
        cancelLabel={t('cancel')}
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            void applyState(confirm.state, true, confirm.recommendationId);
          }
        }}
      />
    </div>
  );
}

function IdentityForm({
  workspace,
  areas,
  goals,
  pending,
  onSave,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof getProjectWorkspace>>['workspace']>;
  areas: { id: string; name: string; color: string | null; icon: string | null; archivedAt: string | null }[];
  goals: { id: string; title: string }[];
  pending: boolean;
  onSave: (values: ProjectIdentityInput) => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [name, setName] = useState(workspace.project.name);
  const [description, setDescription] = useState(workspace.project.description ?? '');
  const [strategicObjective, setStrategicObjective] = useState(
    workspace.project.strategicObjective ?? '',
  );
  const [desiredOutcome, setDesiredOutcome] = useState(
    workspace.project.desiredOutcome ?? '',
  );
  const [owner, setOwner] = useState(workspace.project.owner ?? '');
  const [lifeAreaIds, setLifeAreaIds] = useState(workspace.lifeAreaIds);
  const [goalIds, setGoalIds] = useState(workspace.goalIds);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          name,
          description,
          strategicObjective,
          desiredOutcome,
          owner,
          lifeAreaIds,
          goalIds,
        });
      }}
    >
      <Field label={t('name')}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label={t('description')}>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label={t('strategicObjective')}>
        <Textarea
          value={strategicObjective}
          onChange={(event) => setStrategicObjective(event.target.value)}
        />
      </Field>
      <Field label={t('desiredOutcome')}>
        <Textarea
          value={desiredOutcome}
          onChange={(event) => setDesiredOutcome(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t('desiredOutcomeHint')}</p>
      </Field>
      <Field label={t('owner')}>
        <Input value={owner} onChange={(event) => setOwner(event.target.value)} />
      </Field>
      <Field label={t('lifeAreas')}>
        <LifeAreaMultiSelect areas={areas} value={lifeAreaIds} onChange={setLifeAreaIds} />
      </Field>
      <Field label={t('linkedGoals')}>
        <div className="flex flex-wrap gap-1.5">
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noGoals')}</p>
          ) : (
            goals.map((goal) => {
              const selected = goalIds.includes(goal.id);
              return (
                <button
                  key={goal.id}
                  type="button"
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    selected ? 'border-ring bg-muted' : 'border-border text-muted-foreground',
                  )}
                  onClick={() =>
                    setGoalIds(
                      selected
                        ? goalIds.filter((id) => id !== goal.id)
                        : [...goalIds, goal.id],
                    )
                  }
                >
                  {goal.title}
                </button>
              );
            })
          )}
        </div>
      </Field>
      <Button type="submit" disabled={pending}>
        {t('save')}
      </Button>
    </form>
  );
}

function ProgressForm({
  workspace,
  pending,
  onSave,
  onAddMilestone,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof getProjectWorkspace>>['workspace']>;
  pending: boolean;
  onSave: (values: ProjectProgressInput) => Promise<void>;
  onAddMilestone: (title: string, targetDate?: string) => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [progress, setProgress] = useState(workspace.project.progress);
  const [currentMilestoneId, setCurrentMilestoneId] = useState(
    workspace.project.currentMilestoneId ?? '',
  );
  const [nextMilestoneId, setNextMilestoneId] = useState(
    workspace.project.nextMilestoneId ?? '',
  );
  const [targetDate, setTargetDate] = useState(workspace.project.targetDate ?? '');
  const [nextAction, setNextAction] = useState(workspace.project.nextAction ?? '');
  const [milestoneTitle, setMilestoneTitle] = useState('');

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            progress,
            currentMilestoneId: currentMilestoneId || null,
            nextMilestoneId: nextMilestoneId || null,
            targetDate,
            nextAction,
          });
        }}
      >
        <Field label={`${t('progress')}: ${progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            className="w-full"
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
        </Field>
        <Field label={t('nextAction')}>
          <Input
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
          />
        </Field>
        <Field label={t('targetDate')}>
          <Input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </Field>
        <Field label={t('currentMilestone')}>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            value={currentMilestoneId}
            onChange={(event) => setCurrentMilestoneId(event.target.value)}
          >
            <option value="">{t('none')}</option>
            {workspace.milestones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('nextMilestone')}>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            value={nextMilestoneId}
            onChange={(event) => setNextMilestoneId(event.target.value)}
          >
            <option value="">{t('none')}</option>
            {workspace.milestones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </form>
      <div className="flex gap-2">
        <Input
          value={milestoneTitle}
          placeholder={t('milestonePlaceholder')}
          onChange={(event) => setMilestoneTitle(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!milestoneTitle.trim()) {
              return;
            }
            void onAddMilestone(milestoneTitle.trim()).then(() =>
              setMilestoneTitle(''),
            );
          }}
        >
          {t('addMilestone')}
        </Button>
      </div>
    </div>
  );
}

function ExecutionPanel({
  workspace,
  projectId,
  onAddTask,
  onAddCommitment,
  onAddWaiting,
  onAddLink,
  onRemoveLink,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof getProjectWorkspace>>['workspace']>;
  projectId: string;
  onAddTask: (title: string) => Promise<void>;
  onAddCommitment: (
    description: string,
    direction: 'i_promised' | 'they_promised',
  ) => Promise<void>;
  onAddWaiting: (item: string) => Promise<void>;
  onAddLink: (url: string, label?: string) => Promise<void>;
  onRemoveLink: (url: string) => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [taskTitle, setTaskTitle] = useState('');
  const [commitment, setCommitment] = useState('');
  const [waiting, setWaiting] = useState('');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  const parentTasks = workspace.tasks.filter((t) => !t.parentTaskId);
  const subtasksByParent = new Map<string, typeof workspace.tasks>();
  for (const task of workspace.tasks) {
    if (!task.parentTaskId) continue;
    const arr = subtasksByParent.get(task.parentTaskId) ?? [];
    arr.push(task);
    subtasksByParent.set(task.parentTaskId, arr);
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-medium">{t('tasks')}</h3>
        <ul className="space-y-1 text-sm">
          {parentTasks.length === 0 ? (
            <li className="text-muted-foreground">{t('noTasks')}</li>
          ) : (
            parentTasks.map((item) => (
              <TaskWithSubtasks
                key={item.id}
                projectId={projectId}
                task={item}
                subtasks={subtasksByParent.get(item.id) ?? []}
              />
            ))
          )}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input
            value={taskTitle}
            placeholder={t('taskPlaceholder')}
            onChange={(event) => setTaskTitle(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!taskTitle.trim()) {
                return;
              }
              void onAddTask(taskTitle.trim()).then(() => setTaskTitle(''));
            }}
          >
            {t('addTask')}
          </Button>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-medium">{t('meetings')}</h3>
        <ul className="space-y-1 text-sm">
          {workspace.meetings.length === 0 ? (
            <li className="text-muted-foreground">{t('noMeetings')}</li>
          ) : (
            workspace.meetings.map((item) => (
              <li key={item.id} className="rounded-lg border px-3 py-2">
                {item.title}
              </li>
            ))
          )}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-medium">{t('commitments')}</h3>
        <ul className="space-y-1 text-sm">
          {workspace.commitments.length === 0 ? (
            <li className="text-muted-foreground">{t('noCommitments')}</li>
          ) : (
            workspace.commitments.map((item) => (
              <li key={item.id} className="rounded-lg border px-3 py-2">
                {item.description}
              </li>
            ))
          )}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input
            value={commitment}
            placeholder={t('commitmentPlaceholder')}
            onChange={(event) => setCommitment(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!commitment.trim()) {
                return;
              }
              void onAddCommitment(commitment.trim(), 'i_promised').then(() =>
                setCommitment(''),
              );
            }}
          >
            {t('addCommitment')}
          </Button>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-medium">{t('waitingFor')}</h3>
        <ul className="space-y-1 text-sm">
          {workspace.waitingItems.length === 0 ? (
            <li className="text-muted-foreground">{t('noWaiting')}</li>
          ) : (
            workspace.waitingItems.map((item) => (
              <li key={item.id} className="rounded-lg border px-3 py-2">
                {item.item}
              </li>
            ))
          )}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input
            value={waiting}
            placeholder={t('waitingPlaceholder')}
            onChange={(event) => setWaiting(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!waiting.trim()) {
                return;
              }
              void onAddWaiting(waiting.trim()).then(() => setWaiting(''));
            }}
          >
            {t('addWaiting')}
          </Button>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-medium">{t('links')}</h3>
        <ul className="space-y-1 text-sm">
          {workspace.project.links.length === 0 ? (
            <li className="text-muted-foreground">{t('noLinks')}</li>
          ) : (
            workspace.project.links.map((item) => (
              <li
                key={item.url}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <a href={item.url} className="truncate underline" target="_blank" rel="noreferrer">
                  {item.label || item.url}
                </a>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => void onRemoveLink(item.url)}
                >
                  {t('remove')}
                </Button>
              </li>
            ))
          )}
        </ul>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <Input
            value={url}
            placeholder="https://"
            onChange={(event) => setUrl(event.target.value)}
          />
          <Input
            value={label}
            placeholder={t('linkLabel')}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!url.trim()) {
                return;
              }
              void onAddLink(url.trim(), label.trim() || undefined).then(() => {
                setUrl('');
                setLabel('');
              });
            }}
          >
            {t('addLink')}
          </Button>
        </div>
      </section>
    </div>
  );
}

function PeoplePanel({
  workspace,
  contacts,
  onAdd,
  onRemove,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof getProjectWorkspace>>['workspace']>;
  contacts: { id: string; name: string }[];
  onAdd: (contactId: string, role: string) => Promise<void>;
  onRemove: (contactId: string) => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [role, setRole] = useState('stakeholder');

  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-sm">
        {workspace.contacts.length === 0 ? (
          <li className="text-muted-foreground">{t('noPeople')}</li>
        ) : (
          workspace.contacts.map((item) => (
            <li
              key={item.contactId}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <Link
                href={`/people/${item.contactId}`}
                className="underline-offset-4 hover:underline"
              >
                {item.name} · {item.role}
              </Link>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => void onRemove(item.contactId)}
              >
                {t('remove')}
              </Button>
            </li>
          ))
        )}
      </ul>
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noContactsYet')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
          >
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
          <Input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="max-w-40"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!contactId || !role.trim()) {
                return;
              }
              void onAdd(contactId, role.trim());
            }}
          >
            {t('addPerson')}
          </Button>
        </div>
      )}
    </div>
  );
}

function ResourcesForm({
  workspace,
  locale,
  pending,
  onSave,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof getProjectWorkspace>>['workspace']>;
  locale: AppLocale;
  pending: boolean;
  onSave: (values: ProjectResourcesInput) => Promise<void>;
}) {
  const t = useTranslations('projects');
  const currency = workspace.project.currency;
  const [minutes, setMinutes] = useState(workspace.project.timeInvestedMinutes);
  const [invested, setInvested] = useState(
    toMajor(workspace.project.moneyInvested, currency),
  );
  const [future, setFuture] = useState(
    toMajor(workspace.project.estimatedFutureCost, currency),
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          timeInvestedMinutes: minutes,
          moneyInvestedMajor: invested,
          estimatedFutureCostMajor: future,
        });
      }}
    >
      {workspace.computedFinance ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">{t('resourcesComputed')}</p>
          <p className="mt-1">
            {t('moneyInvested')}:{' '}
            {formatMoney(
              workspace.computedFinance.investedMinor,
              workspace.computedFinance.currency,
              locale,
            )}
          </p>
          <p>
            {t('revenue')}:{' '}
            {formatMoney(
              workspace.computedFinance.revenueMinor,
              workspace.computedFinance.currency,
              locale,
            )}
          </p>
          <p>
            {t('net')}:{' '}
            {formatMoney(
              workspace.computedFinance.netMinor,
              workspace.computedFinance.currency,
              locale,
            )}
          </p>
          <p className="text-muted-foreground">
            {t('timeInvested')}: {workspace.computedFinance.timeInvestedMinutes}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('resourcesTodo')}</p>
      )}
      <Field label={t('timeInvested')}>
        <Input
          type="number"
          min={0}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
        />
      </Field>
      <Field label={`${t('moneyInvested')} (${formatMoney(workspace.project.moneyInvested, currency, locale)})`}>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={invested}
          onChange={(event) => setInvested(Number(event.target.value))}
        />
      </Field>
      <Field label={t('estimatedFutureCost')}>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={future}
          onChange={(event) => setFuture(Number(event.target.value))}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {t('save')}
      </Button>
    </form>
  );
}

function RiskForm({
  workspace,
  pending,
  onSave,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof getProjectWorkspace>>['workspace']>;
  pending: boolean;
  onSave: (values: ProjectRiskInput) => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [blockers, setBlockers] = useState(workspace.project.blockers ?? '');
  const [dependencies, setDependencies] = useState(
    workspace.project.dependencies ?? '',
  );
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(
    workspace.project.riskLevel,
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ blockers, dependencies, riskLevel });
      }}
    >
      <Field label={t('blockers')}>
        <Textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} />
      </Field>
      <Field label={t('dependencies')}>
        <Textarea
          value={dependencies}
          onChange={(event) => setDependencies(event.target.value)}
        />
      </Field>
      <Field label={t('riskLevel')}>
        <select
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          value={riskLevel}
          onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}
        >
          {(['low', 'medium', 'high'] as RiskLevel[]).map((level) => (
            <option key={level} value={level}>
              {t(`risk.${level}`)}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" disabled={pending}>
        {t('save')}
      </Button>
    </form>
  );
}

function ScorePanel({
  workspace,
  pending,
  onSave,
  onRecommend,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof getProjectWorkspace>>['workspace']>;
  pending: boolean;
  onSave: (factors: ScoreFactors) => Promise<void>;
  onRecommend: () => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [factors, setFactors] = useState<ScoreFactors>(
    workspace.score ?? DEFAULT_SCORE_FACTORS,
  );
  const live = useMemo(() => computePriorityScore(factors), [factors]);

  const breakdown = [
    live.pullingUp.length > 0
      ? t('scoreUp', {
          factors: live.pullingUp.map((key) => t(`factors.${key}`)).join(', '),
        })
      : null,
    live.pullingDown.length > 0
      ? t('scoreDown', {
          factors: live.pullingDown.map((key) => t(`factors.${key}`)).join(', '),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-3xl font-semibold">{live.score}</p>
        <p className="mt-1 text-sm text-muted-foreground" title={t('scoreWeights')}>
          {breakdown || t('scoreNeutral')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('scoreWeights')}</p>
      </div>
      <div className="space-y-3">
        {SCORE_FACTORS.map((key: ScoreFactorKey) => (
          <div key={key}>
            <Label className="flex justify-between">
              <span>
                {t(`factors.${key}`)}
                <span className="ms-1 text-muted-foreground">
                  ({SCORE_WEIGHTS[key].kind === 'cost' ? t('cost') : t('benefit')} · {SCORE_WEIGHTS[key].weight})
                </span>
              </span>
              <span>{factors[key]}</span>
            </Label>
            <input
              type="range"
              min={1}
              max={10}
              value={factors[key]}
              className="w-full"
              onChange={(event) =>
                setFactors({ ...factors, [key]: Number(event.target.value) })
              }
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => void onSave(factors)}>
          {t('saveScore')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void onRecommend()}
        >
          {t('getAi')}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
