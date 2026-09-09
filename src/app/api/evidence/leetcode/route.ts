import { db } from "@/lib/db";
import { apiError, handleApiError, json, readJson } from "@/lib/api-helpers";
import { fetchLeetCodeStats, leetCodeClaims } from "@/lib/evidence/competitive";
import { fuseEvidence, logEvidence } from "@/lib/evidence/fuse";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  learnerId: string;
  username: string;
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = await readJson<Body>(request);
    const username = (body.username || "")
      .trim()
      .replace(/^@/, "")
      .replace(/^(https?:\/\/)?(www\.)?leetcode\.com\/(u\/)?/i, "")
      .replace(/\/.*$/, "")
      .trim();
    if (!body.learnerId || !username) return apiError("learnerId and username are required");

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const stats = await fetchLeetCodeStats(username);
    const claims = leetCodeClaims(stats);

    await logEvidence(
      body.learnerId,
      "leetcode",
      stats.username,
      `LeetCode: ${stats.total} solved (${stats.easy}E/${stats.medium}M/${stats.hard}H)${stats.ranking ? `, rank ${stats.ranking}` : ""}`,
      claims,
      `https://leetcode.com/u/${stats.username}/`,
    );
    const updates = claims.length ? await fuseEvidence(body.learnerId, "leetcode", claims) : [];

    return json({ stats, claims, assessmentUpdates: updates });
  } catch (e) {
    return handleApiError(e, "LeetCode ingestion failed");
  }
}
