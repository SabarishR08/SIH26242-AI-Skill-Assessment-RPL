import { db } from "@/lib/db";
import { apiError, handleApiError, json } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** All evidence collected for a learner, newest first. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required", 400);

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const evidence = await db.evidenceItem.findMany({
      where: { learnerId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return json({
      evidence: evidence.map((e) => ({
        id: e.id,
        source: e.source,
        sourceRef: e.sourceRef,
        summary: e.summary,
        strength: e.strength,
        url: e.url,
        createdAt: e.createdAt.toISOString(),
        claims: JSON.parse(e.skillClaims || "[]"),
      })),
    });
  } catch (e) {
    return handleApiError(e, "Failed to list evidence");
  }
}
