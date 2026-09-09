import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { loadSkillGraph } from "@/lib/engine/data";
import { fuseEvidence } from "@/lib/evidence/fuse";

export const dynamic = "force-dynamic";

/** GET: all skill assessments for the learner. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

    const assessments = await db.skillAssessment.findMany({
      where: { learnerId },
      orderBy: [{ evidencedLevel: "desc" }, { claimedLevel: "desc" }],
    });
    return json({ assessments });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to load skills", 500);
  }
}

interface SetClaimsBody {
  learnerId: string;
  claims: Array<{ skillId: string; level: number }>;
}

/** POST: set self-reported (claimed) levels for skills — review screen. */
export async function POST(request: Request) {
  try {
    const body = await readJson<SetClaimsBody>(request);
    if (!body.learnerId || !Array.isArray(body.claims)) return apiError("learnerId and claims[] are required");

    const graph = await loadSkillGraph();
    const valid = body.claims
      .filter((c) => graph.skills[c.skillId] && c.level >= 0 && c.level <= 5)
      .map((c) => ({
        skillId: c.skillId,
        skillName: graph.skills[c.skillId].name,
        level: Math.round(c.level),
        quote: `Self-reported during onboarding claims review: level ${Math.round(c.level)}/5`,
        strength: 1,
      }));

    if (!valid.length) return apiError("No valid skill claims provided");

    const updates = await fuseEvidence(body.learnerId, "interview", valid);
    return json({ applied: valid.length, assessmentUpdates: updates });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to set claims", 500);
  }
}
