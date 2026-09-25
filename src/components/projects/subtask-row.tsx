'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createSubtask, toggleSubtaskStatus } from '@/lib/projects/actions';
import { cn } from '@/lib/utils';

type Subtask = {
  id: string;
  title: string;
  status: string;
  parentTaskId: string | null;
  sortOrder: number;
};

export function TaskWithSubtasks({
  projectId,
  task,
  subtasks,
}: {
  projectId: string;
  task: { id: string; title: string; status: string };
  subtasks: Subtask[];
}) {
  const t = useTranslations('projects');
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [pending, setPending] = useState(false);

  const workspaceKey = ['project-workspace', projectId] as const;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: workspaceKey });
    await queryClient.invalidateQueries({ queryKey: ['project-cards'] });
  }

  async function onAddSubtask() {
    if (!newSubtask.trim()) {
      return;
    }
    setPending(true);
    const result = await createSubtask(projectId, {
      parentTaskId: task.id,
      title: newSubtask.trim(),
    });
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    setNewSubtask('');
    await refresh();
  }

  async function onToggle(taskId: string) {
    setPending(true);
    const result = await toggleSubtaskStatus(projectId, { taskId });
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    await refresh();
  }

  return (
    <li className="rounded-lg border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-start"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-xs text-muted-foreground">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="font-medium">{task.title}</span>
        </button>
        <span className="text-[11px] text-muted-foreground">
          {subtasks.length > 0
            ? `${subtasks.filter((s) => s.status === 'completed').length}/${subtasks.length}`
            : ''}
        </span>
      </div>

      {expanded ? (
        <div className="mt-2 space-y-1">
          {subtasks.length === 0 ? (
            <p className="ms-5 text-xs text-muted-foreground">
              {t('noSubtasks')}
            </p>
          ) : (
            <ul className="ms-5 space-y-1">
              {subtasks.map((sub) => (
                <li key={sub.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sub.status === 'completed'}
                    disabled={pending}
                    onChange={() => void onToggle(sub.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span
                    className={cn(
                      'text-sm',
                      sub.status === 'completed' && 'text-muted-foreground line-through',
                    )}
                  >
                    {sub.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="ms-5 mt-1 flex gap-2">
            <Input
              value={newSubtask}
              placeholder={t('subtaskPlaceholder')}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onAddSubtask();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !newSubtask.trim()}
              onClick={() => void onAddSubtask()}
            >
              {t('addSubtask')}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
