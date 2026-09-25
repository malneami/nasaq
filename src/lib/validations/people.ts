import { z } from 'zod';

export const RELATIONSHIP_CATEGORIES = [
  'partner',
  'investor',
  'advisor',
  'colleague',
  'client',
  'potential_client',
  'professional',
  'personal',
] as const;

export const COMMITMENT_DIRECTIONS = ['i_promised', 'they_promised'] as const;

export const COMMITMENT_STATUSES = [
  'open',
  'fulfilled',
  'overdue',
  'cancelled',
] as const;

export const WAITING_STATUSES = [
  'waiting',
  'received',
  'overdue',
  'cancelled',
] as const;

export const INTERACTION_CHANNELS = [
  'call',
  'email',
  'meeting',
  'message',
  'in_person',
  'other',
] as const;

export const contactFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  organization: z.string().trim().max(200).optional().or(z.literal('')),
  role: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  category: z.enum(RELATIONSHIP_CATEGORIES),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
  tags: z.string().trim().max(400).optional().or(z.literal('')),
  nextFollowUpAt: z.string().optional().or(z.literal('')),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const interactionFormSchema = z.object({
  channel: z.enum(INTERACTION_CHANNELS).optional(),
  summary: z.string().trim().min(1).max(2000),
  occurredAt: z.string().optional().or(z.literal('')),
});

export type InteractionFormInput = z.infer<typeof interactionFormSchema>;

export const commitmentFormSchema = z.object({
  description: z.string().trim().min(1).max(500),
  direction: z.enum(COMMITMENT_DIRECTIONS),
  contactId: z.string().uuid().optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
  followUpAt: z.string().optional().or(z.literal('')),
  status: z.enum(COMMITMENT_STATUSES).optional(),
});

export type CommitmentFormInput = z.infer<typeof commitmentFormSchema>;

export const waitingFormSchema = z.object({
  item: z.string().trim().min(1).max(500),
  contactId: z.string().uuid().optional().or(z.literal('')),
  org: z.string().trim().max(200).optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  expectedAt: z.string().optional().or(z.literal('')),
  followUpAt: z.string().optional().or(z.literal('')),
  status: z.enum(WAITING_STATUSES).optional(),
});

export type WaitingFormInput = z.infer<typeof waitingFormSchema>;

export const projectContactSchema = z.object({
  projectId: z.string().uuid(),
  role: z.string().trim().min(1).max(80).default('stakeholder'),
});

export type ProjectContactInput = z.infer<typeof projectContactSchema>;
