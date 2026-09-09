import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { createCalibrationQuiz, detectGaps } from "@/lib/calibration/quiz";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { loadSkillGraph } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  /** Specific gap to quiz; omit to auto-pick the largest gap. */
  skillId?: string;
}

/** Generate a calibration quiz for a gap skill (LLM or graph-derived). */
export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId) return apiError("learnerId is required", 400);

    let gap = body.skillId ? (await detectGaps(body.learnerId)).find((g) => g.skillId === body.skillId) : undefined;
    
    // If specific skillId was requested but not in top gaps list, build targeted calibration
    if (!gap && body.skillId) {
      const assessment = await db.skillAssessment.findUnique({
        where: { learnerId_skillId: { learnerId: body.learnerId, skillId: body.skillId } },
      });
      if (assessment) {
        gap = {
          skillId: assessment.skillId,
          skillName: assessment.skillName,
          claimedLevel: Math.max(1, assessment.claimedLevel),
          evidencedLevel: assessment.evidencedLevel,
          gap: Math.max(1, assessment.claimedLevel - assessment.evidencedLevel),
          tier: assessment.tier,
        };
      } else {
        const graph = await loadSkillGraph();
        const skill = graph.skills[body.skillId];
        if (skill) {
          gap = {
            skillId: skill.id,
            skillName: skill.name,
            claimedLevel: 3,
            evidencedLevel: 0,
            gap: 3,
            tier: "claimed",
          };
        }
      }
    }

    // Only fallback to top gap if caller did not provide a specific skill
    if (!gap && !body.skillId) {
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
