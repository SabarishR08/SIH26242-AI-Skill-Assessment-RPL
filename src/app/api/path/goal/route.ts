import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { replanPath, type ReplanReason } from "@/lib/path/replan";
import { skillSearch } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  /** New goal: either a skill id or free text (resolved via search). */
  goalSkillId?: string;
  goalText?: string;
}

/** Change the goal → regenerate the path with a diff. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    let goalSkillId = body.goalSkillId;
    if (!goalSkillId && body.goalText) {
      const hits = await skillSearch(body.goalText);
      goalSkillId = hits[0]?.id;
    }
    if (!goalSkillId) return apiError("Provide goalSkillId or goalText", 400);

    const { loadSkillGraph } = await import("@/lib/engine");
    const graph = await loadSkillGraph();
    const targetSkill = graph.skills[goalSkillId];

    const updateData: Record<string, unknown> = { goalSkillId };
    if (targetSkill) {
      updateData.domain = targetSkill.domain;
      updateData.targetRole = `${targetSkill.name} Specialist`;
      updateData.goalStatement = `Master ${targetSkill.name} in ${targetSkill.domain}`;
    }

    await db.learner.update({ where: { id: body.learnerId }, data: updateData as never });
    await db.activityLog.create({
      data: { learnerId: body.learnerId, kind: "goal_changed", detailJson: JSON.stringify({ goalSkillId, skillName: targetSkill?.name }) },
    });

    const outcome = await replanPath(body.learnerId, "goal_changed" satisfies ReplanReason, { newGoalSkillId: goalSkillId });
    return json(outcome);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to change goal", 500);
  }
}
