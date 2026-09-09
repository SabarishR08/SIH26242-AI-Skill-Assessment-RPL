import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

interface Body {
  learnerId: string;
}

/**
 * Manually complete a milestone (allowed for consolidation phases with no
 * gate). Gated milestones complete via quiz pass or project pass instead.
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
    if (milestone.hasGateQuiz || milestone.hasProject) {
      return apiError("This milestone is gated — pass the gate quiz or project evaluation to complete it");
    }

    await db.milestone.update({ where: { id }, data: { status: "complete", completedAt: new Date() } });
    const { unlockNext } = await import("@/lib/path/replan");
    await unlockNext(milestone.pathId);
    await db.activityLog.create({
      data: {
        learnerId: body.learnerId,
        kind: "milestone_completed",
        detailJson: JSON.stringify({ milestoneId: id, title: milestone.title, via: "manual" }),
      },
    });

    return json({ milestoneId: id, status: "complete" });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to complete milestone", 500);
  }
}
