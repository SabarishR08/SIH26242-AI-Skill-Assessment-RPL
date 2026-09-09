import { apiError, json } from "@/lib/api-helpers";
import { detectGaps } from "@/lib/calibration/quiz";

export const dynamic = "force-dynamic";

/** Calibration candidates: claimed >= evidenced + 2. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");
    const gaps = await detectGaps(learnerId);
    return json({ gaps });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to detect gaps", 500);
  }
}
