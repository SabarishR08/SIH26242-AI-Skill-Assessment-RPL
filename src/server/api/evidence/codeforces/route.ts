import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { fetchCodeforcesStats, codeforcesClaims } from "@/lib/evidence/competitive";
import { fuseEvidence, logEvidence } from "@/lib/evidence/fuse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  learnerId: string;
  handle: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const handle = (body.handle || "").trim().replace(/^@/, "");
    if (!body.learnerId || !handle) return apiError("learnerId and handle are required");

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const stats = await fetchCodeforcesStats(handle);
    const claims = codeforcesClaims(stats);

    await logEvidence(
      body.learnerId,
      "codeforces",
      stats.handle,
      `Codeforces: ${stats.rank ?? "unrated"}${stats.maxRating ? `, peak rating ${stats.maxRating}` : ""}`,
      claims,
      `https://codeforces.com/profile/${stats.handle}`,
    );
    const updates = claims.length ? await fuseEvidence(body.learnerId, "codeforces", claims) : [];

    return json({ stats, claims, assessmentUpdates: updates });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Codeforces ingestion failed", 500);
  }
}
