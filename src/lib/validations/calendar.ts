import { z } from 'zod';

export const EVENT_TYPES = [
  'shift',
  'meeting',
  'family',
  'appointment',
  'deep_work',
  'recovery',
  'protected',
  'other',
] as const;

export const SHIFT_KINDS = ['day', 'evening', 'night'] as const;

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    eventType: z.enum(EVENT_TYPES),
    startYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startHm: z.string().regex(/^\d{2}:\d{2}$/),
    endYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endHm: z.string().regex(/^\d{2}:\d{2}$/),
    allDay: z.boolean().default(false),
    isProtected: z.boolean().default(false),
    notes: z.string().max(2000).optional().nullable(),
    shiftKind: z.enum(SHIFT_KINDS).optional().nullable(),
    projectId: z.string().uuid().optional().nullable(),
    contactId: z.string().uuid().optional().nullable(),
    recurrenceFreq: z.enum(['none', 'daily', 'weekly']).default('none'),
    recurrenceInterval: z.number().int().min(1).max(30).default(1),
  })
  .superRefine((value, ctx) => {
    if (value.eventType === 'shift' && !value.shiftKind) {
      ctx.addIssue({
        code: 'custom',
        path: ['shiftKind'],
        message: 'shiftKindRequired',
      });
    }
  });

export type EventFormInput = z.infer<typeof eventFormSchema>;

export const protectedBlockSchema = z.object({
  label: z.string().trim().min(1).max(120),
  eventType: z.enum(['family', 'protected', 'recovery', 'other']).default('protected'),
  weekday: z.number().int().min(0).max(6),
  startHm: z.string().regex(/^\d{2}:\d{2}$/),
  endHm: z.string().regex(/^\d{2}:\d{2}$/),
  isProtected: z.boolean().default(true),
});

export type ProtectedBlockInput = z.infer<typeof protectedBlockSchema>;

export const moveEventSchema = z.object({
  eventId: z.string().uuid(),
  startIso: z.string().datetime(),
  endIso: z.string().datetime(),
});
