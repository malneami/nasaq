import { cn } from '@/lib/utils';
import type {
  CommitmentStatus,
  EventType,
  GoalStatus,
  ProjectState,
  RelationshipCategory,
  RiskLevel,
  TaskPriority,
  TaskStatus,
  WaitingStatus,
} from '@/lib/db/schema';

export type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted';

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  info: 'bg-sky-500/15 text-sky-800 dark:text-sky-200',
  success: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  warning: 'bg-amber-500/15 text-amber-900 dark:text-amber-200',
  danger: 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
  muted: 'bg-muted text-muted-foreground',
};

export function StatusPill({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase',
        TONE_CLASS[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export const GOAL_STATUS_TONES: Record<GoalStatus, StatusTone> = {
  planned: 'info',
  active: 'success',
  achieved: 'neutral',
  paused: 'warning',
  abandoned: 'muted',
};

export const PROJECT_STATE_TONES: Record<ProjectState, StatusTone> = {
  active: 'success',
  maintain: 'info',
  waiting: 'warning',
  incubator: 'neutral',
  someday: 'muted',
  completed: 'neutral',
  stopped: 'danger',
};

export const RISK_LEVEL_TONES: Record<RiskLevel, StatusTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

export const TASK_PRIORITY_TONES: Record<TaskPriority, StatusTone> = {
  low: 'muted',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

export const TASK_STATUS_TONES: Record<TaskStatus, StatusTone> = {
  inbox: 'muted',
  next: 'info',
  scheduled: 'info',
  in_progress: 'success',
  waiting: 'warning',
  completed: 'neutral',
  cancelled: 'muted',
};

export const EVENT_TYPE_TONES: Record<EventType, StatusTone> = {
  shift: 'info',
  meeting: 'neutral',
  family: 'warning',
  appointment: 'info',
  deep_work: 'success',
  recovery: 'muted',
  protected: 'info',
  other: 'muted',
};

export const COMMITMENT_STATUS_TONES: Record<CommitmentStatus, StatusTone> = {
  open: 'info',
  fulfilled: 'success',
  overdue: 'danger',
  cancelled: 'muted',
};

export const WAITING_STATUS_TONES: Record<WaitingStatus, StatusTone> = {
  waiting: 'warning',
  received: 'success',
  overdue: 'danger',
  cancelled: 'muted',
};

export const RELATIONSHIP_CATEGORY_TONES: Record<
  RelationshipCategory,
  StatusTone
> = {
  partner: 'success',
  investor: 'info',
  advisor: 'info',
  colleague: 'neutral',
  client: 'success',
  potential_client: 'warning',
  professional: 'neutral',
  personal: 'muted',
};
