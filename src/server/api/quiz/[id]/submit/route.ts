import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { gradeQuiz } from "@/lib/calibration/quiz";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  answers: number[];
}

/** Submit quiz answers → grade → side effects (tier updates, milestone completion). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson<Body>(request);
    if (!Array.isArray(body.answers)) return apiError("answers[] is required");

    const result = await gradeQuiz(id, body.answers);
    const quiz = await db.quiz.findUnique({ where: { id } });

    let milestoneCompleted = false;
    let replanHappened = false;
    if (quiz?.kind === "milestone_gate" && !result.passed && quiz.milestoneId) {
      // Failed gate → adaptive replan inserts remediation.
      try {
        const { replanPath } = await import("@/lib/path/replan");
        await replanPath(quiz.learnerId, "quiz_failed", { failedMilestoneId: quiz.milestoneId });
        replanHappened = true;
      } catch {
        replanHappened = false;
      }
    }
    if (quiz?.kind === "milestone_gate" && result.passed) {
      const milestone = quiz.milestoneId ? await db.milestone.findUnique({ where: { id: quiz.milestoneId } }) : null;
      milestoneCompleted = milestone?.status === "complete";
    }

    return json({
      ...result,
      milestoneCompleted,
      replanHappened,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to grade quiz", 500);
  }
}
