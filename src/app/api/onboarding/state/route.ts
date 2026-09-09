import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** Current agent interview state (refresh-safe onboarding). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

    const state = await db.agentState.findUnique({ where: { learnerId } });
    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!state || !learner) return apiError("Learner not found", 404);

    return json({
      phase: state.phase,
      roundsCompleted: state.roundsCompleted,
      history: JSON.parse(state.historyJson || "[]"),
      extracted: JSON.parse(state.extractedJson || "{}"),
      learner: {
        id: learner.id,
        name: learner.name,
        goalStatement: learner.goalStatement,
        targetRole: learner.targetRole,
        domain: learner.domain,
        goalSkillId: learner.goalSkillId,
        hoursPerWeek: learner.hoursPerWeek,
        timelineWeeks: learner.timelineWeeks,
        learningStyle: learner.learningStyle,
        motivation: learner.motivation,
        onboardingStage: learner.onboardingStage,
      },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to load state", 500);
  }
}
