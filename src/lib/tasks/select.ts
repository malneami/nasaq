import type {
  EnergyLevel,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../db/schema/enums';
import {
  CANDIDATE_TASK_STATUSES,
  DEFAULT_PROJECT_PRIORITY_SCORE,
  ENERGY_RANK,
  PRIORITY_FACTOR,
  TASK_SELECT_LIMIT,
  TASK_SELECT_SLACK_PERCENT,
  TASK_SELECT_WEIGHTS,
} from './constants';

export type SelectCandidate = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  energy: EnergyLevel;
  type: TaskType;
  context: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  projectId: string | null;
  projectName: string | null;
  projectScore: number | null;
  hasUnmetDependency?: boolean;
};

export type CalendarWindowEvent = {
  startsAt: string;
  endsAt: string;
};

export type RankTasksInput = {
  now: Date;
  availableMinutes: number;
  energy?: EnergyLevel;
  context?: string;
  slackPercent?: number;
  limit?: number;
  calendarEvents?: CalendarWindowEvent[];
};

export type SelectReasonCode =
  | 'overdue'
  | 'dueToday'
  | 'dueTomorrow'
  | 'dueSoon'
  | 'urgentPriority'
  | 'highPriority'
  | 'projectPriority'
  | 'timeFit'
  | 'energyFit'
  | 'inProgress';

export type ScoreBreakdown = {
  deadline: number;
  priority: number;
  projectScore: number;
  timeFit: number;
  energyFit: number;
};

export type RankedPick = {
  task: SelectCandidate;
  score: number;
  breakdown: ScoreBreakdown;
  reasonCodes: SelectReasonCode[];
};

export type SkipCode = 'overtime' | 'energy' | 'context' | 'calendar' | 'waiting';

export type SkippedNote = {
  title: string;
  estimatedMinutes: number | null;
  availableMinutes: number;
  code: SkipCode;
};

export type RankTasksResult = {
  picks: RankedPick[];
  skipped: SkippedNote | null;
};

type ExcludeCode = SkipCode | 'not_candidate' | 'dependency';

const MS_PER_DAY = 86_400_000;

function normalizeContext(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function contextMatches(
  taskContext: string | null,
  requested: string | undefined,
): boolean {
  const want = normalizeContext(requested);
  if (!want) {
    return true;
  }
  if (!taskContext?.trim()) {
    return true;
  }
  const tokens = taskContext
    .split(/[,]+/)
    .map((token) => normalizeContext(token))
    .filter((token): token is string => Boolean(token));
  return tokens.includes(want);
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysUntilDue(dueDate: string, now: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  const dueUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Math.round((dueUtc - utcDay(now)) / MS_PER_DAY);
}

function deadlineFactor(dueDate: string | null, now: Date): number {
  if (!dueDate) {
    return 0.05;
  }
  const days = daysUntilDue(dueDate, now);
  if (days < 0) {
    return 1;
  }
  if (days === 0) {
    return 0.9;
  }
  if (days === 1) {
    return 0.8;
  }
  if (days <= 3) {
    return 0.65;
  }
  if (days <= 7) {
    return 0.45;
  }
  if (days <= 14) {
    return 0.3;
  }
  if (days <= 30) {
    return 0.15;
  }
  return 0.05;
}

function energyFitFactor(
  taskEnergy: EnergyLevel,
  current: EnergyLevel | undefined,
): number {
  if (!current) {
    return 0.5;
  }
  const gap = ENERGY_RANK[current] - ENERGY_RANK[taskEnergy];
  if (gap === 0) {
    return 1;
  }
  if (gap === 1) {
    return 0.55;
  }
  return 0.25;
}

function timeFitFactor(
  estimatedMinutes: number | null,
  availableMinutes: number,
): number {
  if (!estimatedMinutes || estimatedMinutes <= 0 || availableMinutes <= 0) {
    return 0.5;
  }
  return Math.min(1, estimatedMinutes / availableMinutes);
}

function projectScoreFactor(score: number | null): number {
  const value = score ?? DEFAULT_PROJECT_PRIORITY_SCORE;
  return Math.min(1, Math.max(0, value / 100));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function scoreCandidate(
  candidate: SelectCandidate,
  now: Date,
  availableMinutes: number,
  energy: EnergyLevel | undefined,
): { score: number; breakdown: ScoreBreakdown; reasonCodes: SelectReasonCode[] } {
  const deadline = deadlineFactor(candidate.dueDate, now);
  const priority = PRIORITY_FACTOR[candidate.priority];
  const projectScore = projectScoreFactor(candidate.projectScore);
  const timeFit = timeFitFactor(candidate.estimatedMinutes, availableMinutes);
  const energyFit = energyFitFactor(candidate.energy, energy);

  const breakdown: ScoreBreakdown = {
    deadline: roundScore(deadline * TASK_SELECT_WEIGHTS.deadline),
    priority: roundScore(priority * TASK_SELECT_WEIGHTS.priority),
    projectScore: roundScore(projectScore * TASK_SELECT_WEIGHTS.projectScore),
    timeFit: roundScore(timeFit * TASK_SELECT_WEIGHTS.timeFit),
    energyFit: roundScore(energyFit * TASK_SELECT_WEIGHTS.energyFit),
  };

  const score = roundScore(
    breakdown.deadline +
      breakdown.priority +
      breakdown.projectScore +
      breakdown.timeFit +
      breakdown.energyFit,
  );

  const reasonCodes: SelectReasonCode[] = [];
  if (candidate.dueDate) {
    const days = daysUntilDue(candidate.dueDate, now);
    if (days < 0) {
      reasonCodes.push('overdue');
    } else if (days === 0) {
      reasonCodes.push('dueToday');
    } else if (days === 1) {
      reasonCodes.push('dueTomorrow');
    } else if (days <= 7) {
      reasonCodes.push('dueSoon');
    }
  }
  if (candidate.priority === 'urgent') {
    reasonCodes.push('urgentPriority');
  } else if (candidate.priority === 'high') {
    reasonCodes.push('highPriority');
  }
  if ((candidate.projectScore ?? DEFAULT_PROJECT_PRIORITY_SCORE) >= 70) {
    reasonCodes.push('projectPriority');
  }
  if (candidate.status === 'in_progress') {
    reasonCodes.push('inProgress');
  }
  reasonCodes.push('timeFit');
  if (energy && ENERGY_RANK[candidate.energy] <= ENERGY_RANK[energy]) {
    reasonCodes.push('energyFit');
  }

  return { score, breakdown, reasonCodes };
}

function maxAllowedMinutes(available: number, slackPercent: number): number {
  return available * (1 + slackPercent / 100);
}

function remainingMinutesBeforeCalendar(
  now: Date,
  availableMinutes: number,
  events: CalendarWindowEvent[] | undefined,
): number | null {
  if (!events || events.length === 0) {
    return null;
  }
  const windowEnd = new Date(now.getTime() + availableMinutes * 60_000);
  const overlapping = events.filter((event) => {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    return start < windowEnd && end > now;
  });
  if (overlapping.length === 0) {
    return null;
  }
  const nextStart = Math.min(
    ...overlapping.map((event) => new Date(event.startsAt).getTime()),
  );
  if (nextStart <= now.getTime()) {
    return 0;
  }
  return Math.max(0, Math.floor((nextStart - now.getTime()) / 60_000));
}

function isCandidateStatus(status: TaskStatus): boolean {
  return (CANDIDATE_TASK_STATUSES as readonly string[]).includes(status);
}

/**
 * Pure ranking: no I/O. Pass already-loaded candidates and window constraints.
 */
export function rankTasks(
  candidates: SelectCandidate[],
  input: RankTasksInput,
): RankTasksResult {
  const slack = input.slackPercent ?? TASK_SELECT_SLACK_PERCENT;
  const limit = input.limit ?? TASK_SELECT_LIMIT;
  const available = Math.max(1, input.availableMinutes);
  const maxFit = maxAllowedMinutes(available, slack);
  const remaining = remainingMinutesBeforeCalendar(
    input.now,
    available,
    input.calendarEvents,
  );

  const excluded: { candidate: SelectCandidate; code: ExcludeCode; score: number }[] =
    [];
  const survivors: RankedPick[] = [];

  for (const candidate of candidates) {
    const scored = scoreCandidate(
      candidate,
      input.now,
      available,
      input.energy,
    );

    if (!isCandidateStatus(candidate.status) || candidate.status === 'waiting') {
      excluded.push({
        candidate,
        code: candidate.status === 'waiting' ? 'waiting' : 'not_candidate',
        score: scored.score,
      });
      continue;
    }
    if (candidate.hasUnmetDependency) {
      excluded.push({ candidate, code: 'dependency', score: scored.score });
      continue;
    }
    if (
      input.energy &&
      ENERGY_RANK[candidate.energy] > ENERGY_RANK[input.energy]
    ) {
      excluded.push({ candidate, code: 'energy', score: scored.score });
      continue;
    }
    if (!contextMatches(candidate.context, input.context)) {
      excluded.push({ candidate, code: 'context', score: scored.score });
      continue;
    }
    if (
      candidate.estimatedMinutes != null &&
      candidate.estimatedMinutes > maxFit
    ) {
      excluded.push({ candidate, code: 'overtime', score: scored.score });
      continue;
    }
    if (remaining !== null) {
      const calendarMax = maxAllowedMinutes(remaining, slack);
      if (
        remaining === 0 ||
        (candidate.estimatedMinutes != null &&
          candidate.estimatedMinutes > calendarMax)
      ) {
        excluded.push({ candidate, code: 'calendar', score: scored.score });
        continue;
      }
    }

    survivors.push({
      task: candidate,
      score: scored.score,
      breakdown: scored.breakdown,
      reasonCodes: scored.reasonCodes,
    });
  }

  survivors.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.task.title.localeCompare(b.task.title);
  });

  const skipOrder: ExcludeCode[] = [
    'overtime',
    'calendar',
    'energy',
    'context',
    'waiting',
  ];
  let skipped: SkippedNote | null = null;
  for (const code of skipOrder) {
    const matches = excluded.filter((row) => row.code === code);
    if (matches.length === 0) {
      continue;
    }
    matches.sort((a, b) => b.score - a.score);
    const top = matches[0];
    skipped = {
      title: top.candidate.title,
      estimatedMinutes: top.candidate.estimatedMinutes,
      availableMinutes: available,
      code: code as SkipCode,
    };
    break;
  }

  return {
    picks: survivors.slice(0, limit),
    skipped,
  };
}
