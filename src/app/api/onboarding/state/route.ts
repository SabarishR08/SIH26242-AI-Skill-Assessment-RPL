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

interface StateUpdateBody {
  learnerId: string;
  stage: string;
}

/** Update the learner's onboardingStage for persistent multi-step progress across page reloads. */
export async function POST(request: Request) {
  try {
    const { readJson } = await import("@/lib/api-helpers");
    const body = await readJson<StateUpdateBody>(request);
    if (!body.learnerId || !body.stage) return apiError("learnerId and stage are required", 400);

    const validStages = ["intake", "intro", "interview", "evidence", "claims", "calibration", "scenarios", "complete"];
    if (!validStages.includes(body.stage)) {
      return apiError("Invalid onboarding stage", 400);
    }

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const updated = await db.learner.update({
      where: { id: body.learnerId },
      data: { onboardingStage: body.stage },
    });

    return json({ learnerId: updated.id, onboardingStage: updated.onboardingStage });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to update onboarding stage", 500);
  }
}
