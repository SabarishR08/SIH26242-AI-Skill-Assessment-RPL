import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";
import { computeRadar } from "@/lib/engine/radar";
import { loadSkillGraph, computeDepths } from "@/lib/engine";
import { detectGaps } from "@/lib/calibration/quiz";

export const dynamic = "force-dynamic";

/** Radar (claimed vs evidenced vs required) + calibration gaps. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const [assessments, gaps] = await Promise.all([
      db.skillAssessment.findMany({ where: { learnerId } }),
      detectGaps(learnerId),
    ]);

    const graph = await loadSkillGraph();
    const depths = computeDepths(graph);

    // Goal skill: explicit goal, else the deepest assessment in the learner's domain.
    let goalSkillId = learner.goalSkillId;
    if (!goalSkillId) {
      const domainSkills = learner.domain && graph.byDomain[learner.domain] ? graph.byDomain[learner.domain] : [];
      const terminal = domainSkills.filter((s) => !Object.values(graph.skills).some((other) => other.prereqs.includes(s.id)));
      goalSkillId = terminal[terminal.length - 1]?.id ?? domainSkills[domainSkills.length - 1]?.id ?? "ds_datascience";
    }

    const radar = computeRadar(
      graph,
      assessments.map((a) => ({ skillId: a.skillId, claimedLevel: a.claimedLevel, evidencedLevel: a.evidencedLevel })),
      goalSkillId,
      depths,
    );

    return json({
      goalSkillId,
      goalSkillName: graph.skills[goalSkillId]?.name ?? goalSkillId,
      radar,
      gaps,
      tiers: {
        proven: assessments.filter((a) => a.tier === "proven").length,
        verified: assessments.filter((a) => a.tier === "verified").length,
        claimed: assessments.filter((a) => a.tier === "claimed").length,
        inferred: assessments.filter((a) => a.tier === "inferred").length,
      },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to compute radar", 500);
  }
}
