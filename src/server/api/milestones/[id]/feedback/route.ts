import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { replanPath, type ReplanReason } from "@/lib/path/replan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FeedbackKind = "too_hard" | "too_easy" | "too_theoretical" | "not_relevant" | "pace_right" | "other";

const KIND_TO_REASON: Record<Exclude<FeedbackKind, "pace_right" | "other">, ReplanReason> = {
  too_hard: "too_hard",
  too_easy: "too_easy",
  too_theoretical: "too_theoretical",
  not_relevant: "not_relevant",
};

interface Body {
  learnerId: string;
  kind: FeedbackKind;
  comment?: string;
}

/**
 * Per-milestone feedback widget. pace_right/other are just logged;
 * actionable kinds trigger an adaptive replan and return the diff.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson<Body>(request);
    const VALID: FeedbackKind[] = ["too_hard", "too_easy", "too_theoretical", "not_relevant", "pace_right", "other"];
    if (!body.learnerId || !body.kind || !VALID.includes(body.kind)) {
      return apiError(`learnerId and kind (${VALID.join("|")}) are required`);
    }

    const milestone = await db.milestone.findUnique({ where: { id } });
    if (!milestone) return apiError("Milestone not found", 404);
    const path = await db.learningPath.findUnique({ where: { id: milestone.pathId } });
    if (!path || path.learnerId !== body.learnerId) return apiError("Milestone does not belong to this learner", 403);

    await db.feedbackItem.create({
      data: {
        learnerId: body.learnerId,
        milestoneId: id,
        kind: body.kind,
        comment: body.comment?.slice(0, 500) ?? null,
      },
    });
    await db.activityLog.create({
      data: {
        learnerId: body.learnerId,
        kind: "feedback",
        detailJson: JSON.stringify({ milestoneId: id, kind: body.kind, comment: body.comment?.slice(0, 200) ?? null }),
      },
    });

    if (body.kind === "pace_right" || body.kind === "other") {
      return json({ replanned: false, message: "Feedback logged — thanks, this tunes future recommendations." });
    }

    const outcome = await replanPath(body.learnerId, KIND_TO_REASON[body.kind], {
      failedMilestoneId: id,
      feedbackComment: body.comment,
    });

    await db.feedbackItem.updateMany({
      where: { learnerId: body.learnerId, milestoneId: id, kind: body.kind, applied: false },
      data: { applied: true, actionTaken: `Replanned path v${outcome.version}` },
    });

    return json({ replanned: true, ...outcome });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to record feedback", 500);
  }
}
