import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { generatePath, knownSkillIdsFor, type Scenario } from "@/lib/path/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  scenario?: Scenario;
  goalSkillId?: string;
  hoursPerWeek?: number;
}

/** Generate and persist the selected scenario as the active path. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const goalSkillId = body.goalSkillId || learner.goalSkillId;
    if (!goalSkillId) return apiError("No goal skill set — complete the interview or pass goalSkillId");

    const scenario: Scenario = body.scenario ?? "balanced";
    const hoursPerWeek = Math.max(1, Math.min(80, body.hoursPerWeek ?? learner.hoursPerWeek));
    const { known, levels } = await knownSkillIdsFor(body.learnerId);

    if (learner.goalSkillId !== goalSkillId || learner.hoursPerWeek !== hoursPerWeek) {
      await db.learner.update({ where: { id: body.learnerId }, data: { goalSkillId, hoursPerWeek } });
    }
    if (learner.onboardingStage !== "complete") {
      await db.learner.update({ where: { id: body.learnerId }, data: { onboardingStage: "complete" } });
    }

    const outcome = await generatePath({
      learnerId: body.learnerId,
      goalSkillId,
      scenario,
      hoursPerWeek,
      knownSkillIds: known,
      evidencedLevels: levels,
    });

    return json({ ...outcome, scenario });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to generate path", 500);
  }
}
