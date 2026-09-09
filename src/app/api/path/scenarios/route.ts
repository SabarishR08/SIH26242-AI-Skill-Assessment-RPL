import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { previewScenarios, knownSkillIdsFor } from "@/lib/path/generate";
import { SCENARIO_META, type Scenario } from "@/lib/path/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  learnerId: string;
  goalSkillId?: string;
  hoursPerWeek?: number;
}

/** Preview the three scenarios (no persistence) — powers the scenario picker. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const goalSkillId = body.goalSkillId || learner.goalSkillId;
    if (!goalSkillId) return apiError("No goal skill set — complete the interview or pass goalSkillId");

    const hoursPerWeek = Math.max(1, Math.min(80, body.hoursPerWeek ?? learner.hoursPerWeek));
    const { known, levels } = await knownSkillIdsFor(body.learnerId);

    const previews = await previewScenarios({
      learnerId: body.learnerId,
      goalSkillId,
      hoursPerWeek,
      knownSkillIds: known,
      evidencedLevels: levels,
    });

    return json({
      previews: previews.map((p) => ({ ...p, ...SCENARIO_META[p.scenario as Scenario] })),
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to preview scenarios", 500);
  }
}
