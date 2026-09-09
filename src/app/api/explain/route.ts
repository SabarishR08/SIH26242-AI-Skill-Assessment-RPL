import { apiError, handleApiError, json, readJson } from "@/lib/api-helpers";
import { explainSkill, explainCourse, explainProject } from "@/lib/explain";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  learnerId: string;
  subject: "skill" | "course" | "project";
  /** skillId | courseId | milestoneId */
  id: string;
}

/** Evidence-cited explanations for any recommendation. */
export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId || !body.subject || !body.id) {
      return apiError("learnerId, subject (skill|course|project) and id are required");
    }

    let explanation;
    if (body.subject === "skill") explanation = await explainSkill(body.learnerId, body.id);
    else if (body.subject === "course") explanation = await explainCourse(body.learnerId, body.id);
    else if (body.subject === "project") explanation = await explainProject(body.learnerId, body.id);
    else return apiError("subject must be skill, course or project");

    return json({ explanation });
  } catch (e) {
    return handleApiError(e, "Failed to explain");
  }
}
