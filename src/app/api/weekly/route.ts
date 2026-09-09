import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";
import { generateWeeklyReport } from "@/lib/coach";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Generate (or return cached for this week) the coach report. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const report = await generateWeeklyReport(learnerId);
    return json(report);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to generate weekly report", 500);
  }
}
