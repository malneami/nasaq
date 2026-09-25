import { z } from 'zod';

export const TASK_STATUSES = [
  'inbox',
  'next',
  'scheduled',
  'in_progress',
  'waiting',
  'completed',
  'cancelled',
] as const;

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const TASK_TYPES = [
  'deep_work',
  'call',
  'meeting',
  'communication',
  'computer',
  'clinical',
  'home',
  'errand',
  'quick_task',
] as const;

export const ENERGY_LEVELS = ['low', 'medium', 'high'] as const;

export const taskFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  lifeAreaIds: z.array(z.string().uuid()),
  owner: z.string().trim().max(120).optional().or(z.literal('')),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  dueDate: z.string().optional().or(z.literal('')),
  estimatedMinutes: z.string().optional().or(z.literal('')),
  energy: z.enum(ENERGY_LEVELS),
  type: z.enum(TASK_TYPES),
  context: z.string().trim().max(80).optional().or(z.literal('')),
});

export type TaskFormInput = z.infer<typeof taskFormSchema>;

export const quickTaskAddSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: z.string().uuid().optional().or(z.literal('')),
  estimatedMinutes: z.string().optional().or(z.literal('')),
  energy: z.enum(ENERGY_LEVELS).optional(),
  type: z.enum(TASK_TYPES).optional(),
});

export type QuickTaskAddInput = z.infer<typeof quickTaskAddSchema>;

export const waitingFromTaskSchema = z.object({
  item: z.string().trim().min(1).max(500),
  org: z.string().trim().max(120).optional().or(z.literal('')),
});

export type WaitingFromTaskInput = z.infer<typeof waitingFromTaskSchema>;

export const selectTasksInputSchema = z.object({
  minutes: z.number().int().min(1).max(24 * 60),
  energy: z.enum(ENERGY_LEVELS).optional(),
  context: z.string().trim().max(80).optional(),
});

export type SelectTasksInput = z.infer<typeof selectTasksInputSchema>;
