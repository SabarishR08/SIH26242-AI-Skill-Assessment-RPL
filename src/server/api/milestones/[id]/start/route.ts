import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { ensureProjectSpec } from "@/lib/projects/spec";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
}

/**
 * Start a milestone: mark in_progress, lazily generate its project spec
 * (if any). Gate quizzes are created on demand via /api/quiz/gate.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson<Body>(request).catch(() => ({}) as Body);
    if (!body.learnerId) return apiError("learnerId is required");

    const milestone = await db.milestone.findUnique({ where: { id } });
    if (!milestone) return apiError("Milestone not found", 404);

    const path = await db.learningPath.findUnique({ where: { id: milestone.pathId } });
    if (!path || path.learnerId !== body.learnerId) return apiError("Milestone does not belong to this learner", 403);
    if (milestone.status === "locked") return apiError("Milestone is locked — complete the previous phase first");
    if (milestone.status === "complete") return apiError("Milestone already completed");

    let project: Record<string, unknown> | null = null;
    if (milestone.hasProject) {
      try {
        const spec = await ensureProjectSpec(milestone.id);
        project = {
          specId: spec.specId,
          title: spec.brief.title,
          brief: spec.brief.brief,
          requirements: spec.brief.requirements,
          rubric: spec.brief.rubric,
          zpd: spec.brief.zpd,
          estimatedHours: spec.brief.zpd.estimatedHours,
          mode: spec.mode,
        };
      } catch (e) {
        project = { error: e instanceof Error ? e.message : "Spec generation failed" };
      }
    }

    await db.milestone.update({ where: { id }, data: { status: "in_progress" } });
    await db.activityLog.create({
      data: {
        learnerId: body.learnerId,
        kind: "milestone_started",
        detailJson: JSON.stringify({ milestoneId: id, title: milestone.title }),
      },
    });

    return json({ milestoneId: id, status: "in_progress", project });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to start milestone", 500);
  }
}
