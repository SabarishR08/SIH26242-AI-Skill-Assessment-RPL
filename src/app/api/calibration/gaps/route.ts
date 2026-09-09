import { db } from "@/lib/db";
import { apiError, handleApiError, json } from "@/lib/api-helpers";
import { detectGaps } from "@/lib/calibration/quiz";

export const dynamic = "force-dynamic";

/** Calibration candidates: claimed >= evidenced + 2. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required", 400);

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const gaps = await detectGaps(learnerId);
    return json({ gaps });
  } catch (e) {
    return handleApiError(e, "Failed to detect gaps");
  }
}
