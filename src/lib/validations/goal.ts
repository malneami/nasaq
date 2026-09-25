import { z } from 'zod';

export const GOAL_STATUSES = [
  'planned',
  'active',
  'achieved',
  'paused',
  'abandoned',
] as const;

export const goalFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  successMetric: z.string().trim().min(1).max(500),
  status: z.enum(GOAL_STATUSES),
  progress: z.number().int().min(0).max(100),
  startDate: z.string().optional().or(z.literal('')),
  targetDate: z.string().optional().or(z.literal('')),
  lifeAreaIds: z.array(z.string().uuid()).min(1),
  projectIds: z.array(z.string().uuid()),
});

export type GoalFormInput = z.infer<typeof goalFormSchema>;

export const lifeAreaFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().min(1),
  color: z.string().min(1),
});

export type LifeAreaFormInput = z.infer<typeof lifeAreaFormSchema>;
