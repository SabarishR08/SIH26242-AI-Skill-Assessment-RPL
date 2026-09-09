import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { createCalibrationQuiz, detectGaps } from "@/lib/calibration/quiz";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  /** Specific gap to quiz; omit to auto-pick the largest gap. */
  skillId?: string;
}

/** Generate a calibration quiz for a gap skill (LLM or graph-derived). */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId) return apiError("learnerId is required");

    let gap = body.skillId ? (await detectGaps(body.learnerId)).find((g) => g.skillId === body.skillId) : undefined;
    if (!gap) {
      const gaps = await detectGaps(body.learnerId);
      gap = gaps[0];
    }
    if (!gap) return json({ quiz: null, message: "No calibration gaps — every claim is either evidenced or modest." });

    const quiz = await createCalibrationQuiz(body.learnerId, gap);
    return json({
      quiz: {
        quizId: quiz.quizId,
        skillId: gap.skillId,
        skillName: gap.skillName,
        claimedLevel: gap.claimedLevel,
        evidencedLevel: gap.evidencedLevel,
        mode: quiz.mode,
        questions: quiz.questions.map((q) => ({
          prompt: q.prompt,
          options: q.options,
          skillFocus: q.skillFocus ?? null,
        })),
      },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to create quiz", 500);
  }
}
