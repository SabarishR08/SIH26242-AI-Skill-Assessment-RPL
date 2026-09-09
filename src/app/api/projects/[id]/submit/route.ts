import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { evaluateProjectSubmission } from "@/lib/projects/evaluate";
import { applyProjectVerdict } from "@/lib/evidence/fuse";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body {
  repoUrl: string;
}

/**
 * Submit a repo URL for evaluation against the project rubric.
 * Pass → skills become PROVEN, milestone completes, path advances.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson<Body>(request);
    if (!body.repoUrl?.trim()) return apiError("repoUrl is required");

    const spec = await db.projectSpec.findUnique({ where: { id }, include: { milestone: true } });
    if (!spec) return apiError("Project spec not found", 404);
    const path = await db.learningPath.findUnique({ where: { id: spec.milestone.pathId } });
    if (!path) return apiError("Path not found", 404);
    const learnerId = path.learnerId;

    const evaluation = await evaluateProjectSubmission(id, body.repoUrl.trim());

    await db.activityLog.create({
      data: {
        learnerId,
        kind: evaluation.verdict === "passed" ? "project_passed" : "project_needs_work",
        detailJson: JSON.stringify({
          specId: id,
          repoUrl: body.repoUrl,
          score: evaluation.overallScore,
          mode: evaluation.evaluatorMode,
        }),
      },
    });

    let milestoneCompleted = false;
    if (evaluation.verdict === "passed") {
      const skillIds = JSON.parse(spec.milestone.skillIdsJson) as string[];
      await applyProjectVerdict(learnerId, skillIds, Math.max(3, Math.round(evaluation.overallScore * 5)));

      if (spec.milestone.status !== "complete") {
        await db.milestone.update({
          where: { id: spec.milestone.id },
          data: { status: "complete", completedAt: new Date() },
        });
        const { unlockNext } = await import("@/lib/path/replan");
        await unlockNext(spec.milestone.pathId);
        await db.activityLog.create({
          data: {
            learnerId,
            kind: "milestone_completed",
            detailJson: JSON.stringify({ milestoneId: spec.milestone.id, title: spec.milestone.title, via: "project" }),
          },
        });
        milestoneCompleted = true;
      }
    }

    return json({ evaluation, milestoneCompleted });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Project evaluation failed", 500);
  }
}
