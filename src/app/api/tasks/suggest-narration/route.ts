import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/auth/session';
import { ENERGY_LEVELS } from '@/lib/validations/task';
import { narrateTaskSelection } from '@/lib/tasks/narrate';

const bodySchema = z.object({
  minutes: z.number().int().min(1).max(24 * 60),
  energy: z.enum(ENERGY_LEVELS).optional(),
  context: z.string().trim().max(80).optional(),
  locale: z.enum(['en', 'ar']).optional(),
  picks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        projectName: z.string().max(200).nullable(),
        estimatedMinutes: z.number().int().min(1).max(24 * 60).nullable(),
        reasonCodes: z.array(z.string()).max(12),
      }),
    )
    .min(1)
    .max(3),
  skipped: z
    .object({
      title: z.string().trim().min(1).max(200),
      code: z.string().max(40),
    })
    .nullable()
    .optional(),
});

export async function POST(request: Request) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  try {
    const narration = await narrateTaskSelection(parsed.data);
    return NextResponse.json({ narration });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Narration failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
