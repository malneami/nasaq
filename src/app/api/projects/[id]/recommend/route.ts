import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/session';
import { defaultPreferences } from '@/lib/db/schema';
import { getProfile } from '@/lib/db/queries/profiles';
import {
  countProjectsByState,
  getProject,
  listLatestProjectScores,
} from '@/lib/db/queries/projects';
import {
  createAiRecommendation,
  createAuditLog,
} from '@/lib/db/queries/system';
import { recommendProjectAction } from '@/lib/projects/recommend';
import {
  DEFAULT_SCORE_FACTORS,
  type ScoreFactors,
} from '@/lib/projects/score';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const project = await getProject(userId, id);
  if (!project) {
    return NextResponse.json({ error: 'notFound' }, { status: 404 });
  }

  const [profile, activeCount, scores] = await Promise.all([
    getProfile(userId),
    countProjectsByState(userId, 'active'),
    listLatestProjectScores(userId, [project.id]),
  ]);
  const latest = scores[0];
  const factors: ScoreFactors = latest
    ? {
        strategicFit: latest.strategicFit,
        expectedImpact: latest.expectedImpact,
        revenuePotential: latest.revenuePotential,
        networkValue: latest.networkValue,
        personalInterest: latest.personalInterest,
        timeRequirement: latest.timeRequirement,
        financialCost: latest.financialCost,
        complexity: latest.complexity,
        urgency: latest.urgency,
      }
    : DEFAULT_SCORE_FACTORS;

  try {
    const result = await recommendProjectAction({
      name: project.name,
      state: project.state,
      stage: project.stage,
      hasNextAction: Boolean(project.nextAction?.trim()),
      targetDate: project.targetDate
        ? project.targetDate.toISOString().slice(0, 10)
        : null,
      score: latest?.computedScore ?? 50,
      factors,
      activeCount,
      activeLimit:
        profile?.preferences?.active_project_limit ??
        defaultPreferences.active_project_limit,
    });

    const row = await createAiRecommendation(userId, {
      subjectType: 'project',
      subjectId: project.id,
      kind: 'portfolio_action',
      payload: {
        recommendation: result.recommendation,
        rationale: result.rationale,
        confidence: result.confidence,
      },
      confidence: result.confidence.toFixed(3),
      status: 'pending',
    });

    await createAuditLog(userId, {
      actor: 'ai',
      action: 'recommend',
      entityType: 'project',
      entityId: project.id,
      after: {
        recommendationId: row.id,
        recommendation: result.recommendation,
        confidence: result.confidence,
      },
    });

    return NextResponse.json({
      id: row.id,
      recommendation: result.recommendation,
      rationale: result.rationale,
      confidence: result.confidence,
      status: row.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Recommendation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
