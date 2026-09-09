import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { gradeQuiz } from "@/lib/calibration/quiz";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  answers: number[];
  learnerId?: string;
}

/** Submit quiz answers → grade → side effects (tier updates, milestone completion). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson<Body>(request);
    if (!body.learnerId) return apiError("learnerId is required", 400);
    if (!Array.isArray(body.answers)) return apiError("answers[] is required", 400);

    const quiz = await db.quiz.findUnique({ where: { id } });
    if (!quiz) return apiError("Quiz not found", 404);

    if (quiz.learnerId !== body.learnerId) {
      return apiError("Unauthorized: quiz belongs to another learner", 403);
    }

    if (quiz.status !== "pending") {
      return apiError(`Quiz is no longer pending (current status: ${quiz.status})`, 400);
    }

    const priorAttempts = await db.quizAttempt.count({ where: { quizId: id } });
    if (priorAttempts >= 3) {
      return apiError("Maximum quiz attempts (3) already reached", 400);
    }

    const result = await gradeQuiz(id, body.answers);

    let milestoneCompleted = false;
    let replanHappened = false;
    if (quiz?.kind === "milestone_gate" && !result.passed && result.isTerminal && quiz.milestoneId) {
      // Terminal failed gate → adaptive replan inserts remediation.
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
