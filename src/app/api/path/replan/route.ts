import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { replanPath, type ReplanReason } from "@/lib/path/replan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  reason: ReplanReason;
  milestoneId?: string;
  comment?: string;
}

const VALID_REASONS: ReplanReason[] = ["quiz_failed", "too_hard", "too_easy", "too_theoretical", "not_relevant", "goal_changed", "drift"];

/** Manual/feedback-triggered replan with diff. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId || !body.reason) return apiError("learnerId and reason are required");
    if (!VALID_REASONS.includes(body.reason)) return apiError(`reason must be one of: ${VALID_REASONS.join(", ")}`);

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const outcome = await replanPath(body.learnerId, body.reason, {
      failedMilestoneId: body.milestoneId,
      feedbackComment: body.comment,
    });
    return json(outcome);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to replan", 500);
  }
}
