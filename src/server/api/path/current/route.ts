import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";
import { loadSkillGraph, loadCatalogue } from "@/lib/engine/data";
import { recommendCourses, resourcesForSkills } from "@/lib/engine/courses";
import { buildGeneratedPath } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * The active path with full milestone detail: skills, courses, resources,
 * project + gate state, schedule. Also returns the DAG edge list for the
 * skill-graph visualisation.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const path = await db.learningPath.findFirst({
      where: { learnerId, isActive: true },
      include: { milestones: true },
    });
    if (!path) return json({ path: null });

    const ordered = [...path.milestones].sort((a, b) => a.order - b.order);
    const graph = await loadSkillGraph();
    const catalogue = await loadCatalogue();

    // Skill status map for the DAG: mastered/available/locked.
    const assessments = await db.skillAssessment.findMany({ where: { learnerId } });
    const masteredSkills = assessments.filter((a) => a.evidencedLevel >= 3).map((a) => a.skillId);
    const pathSkillSet = new Set(ordered.flatMap((m) => JSON.parse(m.skillIdsJson) as string[]));

    const completedSkills = new Set(
      ordered.filter((m) => m.status === "complete").flatMap((m) => JSON.parse(m.skillIdsJson) as string[]),
    );

    const milestoneDetails = await Promise.all(
      ordered.map(async (m) => {
        const skillIds = JSON.parse(m.skillIdsJson) as string[];
        const skillNames = JSON.parse(m.skillNamesJson) as string[];
        const coursesBySkill: Record<string, Array<{ courseId: string; title: string; url: string; rating: number | null; site: string; level: string; duration: string }>> = {};
        for (const sid of skillIds) {
          coursesBySkill[sid] = recommendCourses(catalogue, sid, { perSkill: 2, evidencedLevel: assessments.find((a) => a.skillId === sid)?.evidencedLevel ?? 0 }).map((c) => ({
            courseId: c.course_id,
            title: c.Title,
            url: c.URL,
            rating: c.Rating,
            site: c.Site,
            level: c.Level,
            duration: c.DurationRaw,
          }));
        }
        const { loadResources } = await import("@/lib/engine/data");
        const resources = resourcesForSkills(await loadResources(), skillIds, { perSkill: 2 });
        const spec = await db.projectSpec.findUnique({ where: { milestoneId: m.id } });
        const quiz = await db.quiz.findFirst({ where: { milestoneId: m.id }, orderBy: { createdAt: "desc" } });
        const submissions = spec
          ? await db.projectSubmission.findMany({ where: { projectId: spec.id }, orderBy: { submittedAt: "desc" }, take: 3 })
          : [];

        return {
          id: m.id,
          order: m.order,
          phase: m.phase,
          title: m.title,
          description: m.description,
          skillIds,
          skillNames,
          estimatedHours: m.estimatedHours,
          status: m.status,
          hasProject: m.hasProject,
          hasGateQuiz: m.hasGateQuiz,
          targetStartAt: m.targetStartAt?.toISOString() ?? null,
          targetEndAt: m.targetEndAt?.toISOString() ?? null,
          completedAt: m.completedAt?.toISOString() ?? null,
          courses: coursesBySkill,
          resources: Object.values(resources).flat().map((r) => ({
            resource_id: r.resource_id,
            title: r.title,
            url: r.url,
            format: r.format,
            difficulty: r.difficulty,
            provider: r.provider,
            description: r.description_raw,
          })),
          project: spec
            ? {
                specId: spec.id,
                title: spec.title,
                brief: spec.brief,
                requirements: JSON.parse(spec.requirementsJson),
                rubric: JSON.parse(spec.rubricJson),
                zpd: JSON.parse(spec.zpdJson),
                estimatedHours: spec.estimatedHours,
                submissions: submissions.map((s) => ({
                  id: s.id,
                  repoUrl: s.repoUrl,
                  status: s.status,
                  evaluation: s.evaluationJson ? JSON.parse(s.evaluationJson) : null,
                  submittedAt: s.submittedAt.toISOString(),
                })),
              }
            : null,
          gateQuiz: quiz ? { id: quiz.id, status: quiz.status } : null,
        };
      }),
    );

    // Edges among path skills for the DAG view.
    const edges: Array<[string, string]> = [];
    for (const sid of pathSkillSet) {
      const node = graph.skills[sid];
      if (!node) continue;
      for (const p of node.prereqs) if (pathSkillSet.has(p)) edges.push([p, sid]);
    }

    // Include mastered skills' edges into path skills for context.
    for (const sid of masteredSkills) {
      const node = graph.skills[sid];
      if (!node) continue;
      for (const dep of Object.values(graph.skills)) {
        if (pathSkillSet.has(dep.id) && dep.prereqs.includes(sid)) edges.push([sid, dep.id]);
      }
    }

    const generated = await buildGeneratedPath({
      targetSkillId: path.snapshotJson ? JSON.parse(path.snapshotJson).goalSkillId : learner.goalSkillId!,
      knownSkillIds: masteredSkills,
      algorithm: path.algorithm as "dfs-topological" | "kahn-spt",
      coursesPerSkill: 0,
    });

    const progress = {
      completed: ordered.filter((m) => m.status === "complete").length,
      total: ordered.length,
      percent: ordered.length ? Math.round((ordered.filter((m) => m.status === "complete").length / ordered.length) * 100) : 0,
      hoursRemaining: ordered.filter((m) => m.status !== "complete").reduce((s, m) => s + m.estimatedHours, 0),
      etaDate: ordered.find((m) => m.status !== "complete")?.targetEndAt?.toISOString().slice(0, 10) ?? null,
    };

    return json({
      path: {
        id: path.id,
        version: path.version,
        scenario: path.scenario,
        algorithm: path.algorithm,
        replanReason: path.replanReason,
        generatedAt: path.generatedAt.toISOString(),
        hoursPerWeek: path.hoursPerWeek,
        totalHours: path.totalHours,
        totalSkills: path.totalSkills,
        milestones: milestoneDetails,
        edges,
        skills: generated.skills.map((s) => ({ id: s.skillId, name: s.skillName, domain: s.domain, depth: s.depth, hours: s.estimatedHours })),
        progress,
      },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to load path", 500);
  }
}
