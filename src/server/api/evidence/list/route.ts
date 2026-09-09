import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** All evidence collected for a learner, newest first. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

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
    return apiError(e instanceof Error ? e.message : "Failed to list evidence", 500);
  }
}
