import { db } from "@/lib/db";
import { apiError, handleApiError, json, readJson } from "@/lib/api-helpers";
import { createGateQuiz } from "@/lib/calibration/quiz";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  milestoneId: string;
}

/** Create (or return existing pending) gate quiz for a milestone. */
export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId || !body.milestoneId) return apiError("learnerId and milestoneId are required", 400);

    const milestone = await db.milestone.findUnique({
      where: { id: body.milestoneId },
      include: { path: true },
    });
    if (!milestone) return apiError("Milestone not found", 404);
    if (milestone.path && milestone.path.learnerId !== body.learnerId) {
      return apiError("Milestone does not belong to this learner", 403);
    }
    if (milestone.path && milestone.path.isActive === false) {
      return apiError("Milestone does not belong to the active path", 400);
    }
    if (milestone.status === "complete") {
      return apiError("Milestone is already complete", 400);
    }

    const existing = await db.quiz.findFirst({
      where: { learnerId: body.learnerId, milestoneId: body.milestoneId, kind: "milestone_gate", status: "pending" },
      include: { questions: true },
    });
    if (existing) {
      const priorAttempts = await db.quizAttempt.count({ where: { quizId: existing.id } });
      if (priorAttempts >= 3) {
        await db.quiz.update({ where: { id: existing.id }, data: { status: "failed" } });
      } else if (existing.questions.length > 0) {
        const ordered = [...existing.questions].sort((a, b) => a.order - b.order);
        return json({
          quiz: {
            quizId: existing.id,
            kind: existing.kind,
            skillName: existing.skillName,
            mode: "cached",
            questions: ordered.map((q) => ({
              prompt: q.prompt,
              options: JSON.parse(q.optionsJson) as string[],
              skillFocus: q.skillFocus,
            })),
          },
        });
      } else {
        await db.quiz.delete({ where: { id: existing.id } });
      }
    }

    const created = await createGateQuiz(body.learnerId, body.milestoneId);
    return json({
      quiz: {
        quizId: created.quizId,
        kind: "milestone_gate",
        skillName: (await db.milestone.findUnique({ where: { id: body.milestoneId } }))?.title ?? "",
        mode: created.mode,
        questions: created.questions.map((q) => ({
          prompt: q.prompt,
          options: q.options,
          skillFocus: q.skillFocus ?? null,
        })),
      },
    });
  } catch (e) {
    return handleApiError(e, "Failed to create gate quiz");
  }
}
