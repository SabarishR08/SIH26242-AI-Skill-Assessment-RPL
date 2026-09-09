import { db } from "@/lib/db";
import { apiError, handleApiError, json } from "@/lib/api-helpers";
import { generateWeeklyReport } from "@/lib/coach";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Generate (or return cached for this week) the coach report. */
export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const report = await generateWeeklyReport(learnerId);
    return json(report);
  } catch (e) {
    return handleApiError(e, "Failed to generate weekly report");
  }
}
