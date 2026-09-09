import { db } from "@/lib/db";
import { apiError, handleApiError, json, readJson } from "@/lib/api-helpers";
import { buildGeneratedPath, computeDepths, phasePartitions } from "@/lib/engine";
import { scheduleMilestones, milestoneHours } from "@/lib/engine/time";
import { knownSkillIdsFor, type Scenario, SCENARIO_META } from "@/lib/path/generate";
import type { MilestoneDraft } from "@/lib/path/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface SimulateBody {
  learnerId: string;
  scenario?: Scenario;
  hoursPerWeek?: number;
  simulateFailure?: boolean;
  additionalKnownSkillId?: string;
}

function themeForDepth(depth: number): string {
  const DEPTH_THEMES = [
    { maxDepth: 0, theme: "Foundations" },
    { maxDepth: 1, theme: "Core Practice" },
    { maxDepth: 2, theme: "Applied Work" },
    { maxDepth: 3, theme: "Integration" },
    { maxDepth: 4, theme: "Specialisation" },
    { maxDepth: Infinity, theme: "Mastery" },
  ];
  return DEPTH_THEMES.find((t) => depth <= t.maxDepth)?.theme ?? "Mastery";
}

export async function POST(request: Request) {
  try {
    const body = await readJson<SimulateBody>(request);
    if (!body.learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const activePath = await db.learningPath.findFirst({
      where: { learnerId: body.learnerId, isActive: true },
      include: { milestones: true },
    });

    const goalSkillId = learner.goalSkillId ?? activePath?.scenario ?? "";
    if (!goalSkillId) return apiError("No goal skill set on learner profile");

    const scenario: Scenario = body.scenario ?? ((activePath?.scenario as Scenario) || "balanced");
    const hoursPerWeek = Math.max(1, Math.min(80, body.hoursPerWeek ?? activePath?.hoursPerWeek ?? learner.hoursPerWeek ?? 10));

    let { known, levels } = await knownSkillIdsFor(body.learnerId);
    if (body.additionalKnownSkillId) {
      known = Array.from(new Set([...known, body.additionalKnownSkillId]));
      levels = { ...levels, [body.additionalKnownSkillId]: 3 };
    }

    const algorithm = scenario === "intensive" ? "kahn-spt" : "dfs-topological";
    const generated = await buildGeneratedPath({
      targetSkillId: goalSkillId,
      knownSkillIds: known,
      algorithm,
      coursesPerSkill: scenario === "intensive" ? 1 : 2,
      evidencedLevels: levels,
    });

    const depths = computeDepths(generated.graph);
    const phases = phasePartitions(
      generated.skills.map((s) => s.skillId),
      depths,
    );

    const drafts: MilestoneDraft[] = [];
    let phaseIndex = 1;

    for (const phaseSkills of phases) {
      if (!phaseSkills.length) continue;
      const named = phaseSkills.map((id) => generated.graph.skills[id]?.name ?? id);
      const primaryDepth = Math.max(...phaseSkills.map((id) => depths[id] ?? 0));
      const skillMeta = phaseSkills.map((id) => generated.skills.find((s) => s.skillId === id)).filter(Boolean);
      const hours = skillMeta.reduce((sum, s) => sum + (s?.estimatedHours ?? 8), 0);
      const meanLevel =
        phaseSkills.reduce((sum, id) => sum + (levels[id] ?? 0), 0) / Math.max(1, phaseSkills.length);
      const hasProject =
        scenario === "intensive"
          ? phaseIndex === Math.ceil(phases.length / 2) || phaseIndex === phases.length
          : phaseIndex % 2 === 0 || phaseIndex === phases.length;
      const totalHours = milestoneHours({ skillHours: hours, hasProject, hasQuiz: true });

      drafts.push({
        order: phaseIndex,
        phase: `${phaseIndex}. ${themeForDepth(primaryDepth)}`,
        title: named.slice(0, 3).join(" · ") + (named.length > 3 ? ` +${named.length - 3}` : ""),
        description: `Build ${themeForDepth(primaryDepth).toLowerCase()} strength in ${named.join(", ")}.`,
        skillIds: phaseSkills,
        skillNames: named,
        estimatedHours: totalHours,
        hasProject,
        hasGateQuiz: true,
        meanEvidencedLevel: meanLevel,
      });
      phaseIndex += 1;
    }

    // If simulateFailure is requested, inject a simulated remediation phase
    if (body.simulateFailure && drafts.length > 0) {
      const failed = drafts[0];
      const reviewHours = Math.max(4, Math.round(failed.estimatedHours * 0.4));
      drafts.unshift({
        order: 0,
        phase: `Simulated Remediation: ${failed.title}`,
        title: `Refresher: ${failed.title}`,
        description: `Simulated consequence of failing the gate assessment: targeted fundamentals review inserted.`,
        skillIds: failed.skillIds,
        skillNames: failed.skillNames,
        estimatedHours: reviewHours,
        hasProject: false,
        hasGateQuiz: true,
        meanEvidencedLevel: 0,
      });
      drafts.forEach((d, i) => (d.order = i + 1));
    }

    const scheduled = scheduleMilestones(
      drafts.map((d) => ({ item: d, hours: d.estimatedHours })),
      hoursPerWeek,
      new Date(),
    );

    // Compute diff against active path
    const oldMilestones = activePath ? [...activePath.milestones].sort((a, b) => a.order - b.order) : [];
    const oldTitles = new Set(oldMilestones.map((m) => m.title));
    const newTitles = new Set(drafts.map((d) => d.title));

    const added = drafts
      .filter((d) => !oldTitles.has(d.title))
      .map((d) => ({ phase: d.phase, title: d.title, reason: "Added under simulated scenario" }));

    const removed = oldMilestones
      .filter((m) => !newTitles.has(m.title) && m.status !== "complete")
      .map((m) => ({ phase: m.phase, title: m.title, reason: "Bypassed under simulated scenario" }));

    const keptCount = drafts.filter((d) => oldTitles.has(d.title)).length;

    const oldLatest = oldMilestones.reduce(
      (latest, m) => (m.targetEndAt && m.targetEndAt > latest ? m.targetEndAt : latest),
      new Date(0),
    );
    const newLatest = scheduled.length ? scheduled[scheduled.length - 1].endAt : new Date();
    const etaShiftDays = oldLatest.getTime() > 0 ? Math.round((newLatest.getTime() - oldLatest.getTime()) / (24 * 60 * 60 * 1000)) : 0;

    const simTotalHours = drafts.reduce((sum, d) => sum + d.estimatedHours, 0);

    return json({
      simulation: {
        scenario,
        meta: SCENARIO_META[scenario],
        hoursPerWeek,
        totalHours: simTotalHours,
        totalWeeks: Math.ceil(simTotalHours / hoursPerWeek),
        etaDate: newLatest.toISOString().slice(0, 10),
        milestonesCount: drafts.length,
        milestones: drafts.map((d, i) => ({
          order: d.order,
          phase: d.phase,
          title: d.title,
          estimatedHours: d.estimatedHours,
          hasProject: d.hasProject,
          hasGateQuiz: d.hasGateQuiz,
          targetStartAt: scheduled[i]?.startAt.toISOString(),
          targetEndAt: scheduled[i]?.endAt.toISOString(),
        })),
        diff: {
          added,
          removed,
          keptCount,
          etaShiftDays,
          reasons: [
            scenario !== activePath?.scenario ? `Switched scenario from ${activePath?.scenario} to ${scenario}` : null,
            hoursPerWeek !== activePath?.hoursPerWeek ? `Pace changed from ${activePath?.hoursPerWeek}h to ${hoursPerWeek}h/week` : null,
            body.simulateFailure ? "Simulated gate quiz failure (remediation inserted)" : null,
            body.additionalKnownSkillId ? "Simulated verified skill addition" : null,
          ].filter(Boolean) as string[],
        },
      },
      current: activePath
        ? {
            scenario: activePath.scenario,
            hoursPerWeek: activePath.hoursPerWeek,
            totalHours: activePath.totalHours,
            milestonesCount: activePath.milestones.length,
            etaDate: oldLatest.getTime() > 0 ? oldLatest.toISOString().slice(0, 10) : null,
          }
        : null,
    });
  } catch (e) {
    return handleApiError(e, "Failed to simulate path");
  }
}
