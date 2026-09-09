import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { ensureProjectSpec } from "@/lib/projects/spec";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  milestoneId: string;
}

/** Ensure (lazily generate) the project spec for a milestone. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.milestoneId) return apiError("milestoneId is required");

    const milestone = await db.milestone.findUnique({ where: { id: body.milestoneId } });
    if (!milestone) return apiError("Milestone not found", 404);
    if (!milestone.hasProject) return apiError("This milestone has no project");

    const spec = await ensureProjectSpec(body.milestoneId);
    return json({
      specId: spec.specId,
      title: spec.brief.title,
      brief: spec.brief.brief,
      requirements: spec.brief.requirements,
      rubric: spec.brief.rubric,
      zpd: spec.brief.zpd,
      estimatedHours: spec.brief.zpd.estimatedHours,
      mode: spec.mode,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to build spec", 500);
  }
}
