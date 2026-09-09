/**
 * Path generation — assembles engine output into milestone-based roadmaps.
 *
 * Pipeline:
 *   1. Known skills = assessments with evidencedLevel >= 3 (proof-backed).
 *   2. Engine orders the prerequisite closure (DFS topo or Kahn/SPT).
 *   3. Skills are grouped into milestones by graph-depth bands.
 *   4. Time model schedules milestones against the learner's weekly hours.
 *   5. Scenario variants tune: algorithm, breadth, project cadence.
 *
 * Project specs and gate quizzes are generated lazily (on milestone open)
 * to keep generation sub-second.
 */
import { db } from "@/lib/db";
import { buildGeneratedPath, computeDepths, phasePartitions } from "@/lib/engine";
import { scheduleMilestones, milestoneHours } from "@/lib/engine/time";
import { loadSkillNeighbors } from "@/lib/ml/artifacts";
import type { MilestoneDraft } from "./types";

export type Scenario = "balanced" | "intensive" | "exploratory";

export const SCENARIO_META: Record<Scenario, { label: string; tagline: string; description: string }> = {
  balanced: {
    label: "Balanced",
    tagline: "Steady climb, project every other phase",
    description: "Classic prerequisite ordering (DFS topological). A hands-on project every second phase, gate quiz at every phase end. The default recommendation for most learners.",
  },
  intensive: {
    label: "Intensive",
    tagline: "Quick wins first, compressed schedule",
    description: "SPT-scheduled ordering (Kahn + min-heap) front-loads short skills so you bank visible progress early. Focused course picks, projects at the midpoint and finale only. Best when your deadline is tight.",
  },
  exploratory: {
    label: "Exploratory",
    tagline: "Breadth around the goal, portfolio capstone",
    description: "Same prerequisite ordering, plus an adjacent-skills phase sampling sibling skills in your domain, ending in a portfolio-grade capstone. Best when you want options, not just the fastest route.",
  },
};

const DEPTH_THEMES: Array<{ maxDepth: number; theme: string }> = [
  { maxDepth: 0, theme: "Foundations" },
  { maxDepth: 1, theme: "Core Practice" },
  { maxDepth: 2, theme: "Applied Work" },
  { maxDepth: 3, theme: "Integration" },
  { maxDepth: 4, theme: "Specialisation" },
  { maxDepth: Infinity, theme: "Mastery" },
];

function themeForDepth(depth: number): string {
  return DEPTH_THEMES.find((t) => depth <= t.maxDepth)?.theme ?? "Mastery";
}

export interface PathGenerationInput {
  learnerId: string;
  goalSkillId: string;
  scenario: Scenario;
  hoursPerWeek: number;
  /** Skills already known (evidencedLevel >= 3). */
  knownSkillIds: string[];
  /** skillId -> evidenced level, for course level affinity + ZPD. */
  evidencedLevels: Record<string, number>;
}

export interface GenerationOutcome {
  pathId: string;
  version: number;
  totalSkills: number;
  totalHours: number;
  milestones: MilestoneDraft[];
  algorithm: string;
  etaDate: string;
}

export async function generatePath(input: PathGenerationInput): Promise<GenerationOutcome> {
  const { learnerId, goalSkillId, scenario, hoursPerWeek, knownSkillIds, evidencedLevels } = input;

  const algorithm = scenario === "intensive" ? "kahn-spt" : "dfs-topological";
  const generated = await buildGeneratedPath({
    targetSkillId: goalSkillId,
    knownSkillIds,
    algorithm,
    coursesPerSkill: scenario === "intensive" ? 1 : 2,
    evidencedLevels,
  });

  const depths = computeDepths(generated.graph);
  const phases = phasePartitions(
    generated.skills.map((s) => s.skillId),
    depths,
  );

  // Exploratory: append an adjacent-skills phase from the goal's domain
  // siblings (same depth band, not already on the path).
  let adjacentSkills: string[] = [];
  if (scenario === "exploratory") {
    const goalDepth = depths[goalSkillId] ?? 0;
    const onPath = new Set(generated.skills.map((s) => s.skillId));
    const eligible = (id: string) =>
      !onPath.has(id) && !knownSkillIds.includes(id) && id !== goalSkillId && (depths[id] ?? 0) <= goalDepth;

    // A trained run knows which skills are actually *near* the goal. Without
    // it we fall back to "same domain, sorted by depth", which picks the
    // deepest siblings whether or not they have anything to do with the goal.
    const neighbours = await loadSkillNeighbors();
    if (neighbours) {
      const seen = new Set<string>();
      const candidates: Array<{ id: string; score: number }> = [];
      // Nearest to the goal first, then nearest to what the path already covers.
      const anchors = [goalSkillId, ...generated.skills.slice(-3).map((s) => s.skillId)];
      for (const anchor of anchors) {
        for (const n of neighbours[anchor] ?? []) {
          if (seen.has(n.skillId) || !eligible(n.skillId)) continue;
          seen.add(n.skillId);
          candidates.push({ id: n.skillId, score: n.score });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      adjacentSkills = candidates.slice(0, 3).map((c) => c.id);
    }

    if (!adjacentSkills.length) {
      adjacentSkills = Object.values(generated.graph.skills)
        .filter((s) => s.domain === generated.domain && eligible(s.id))
        .sort((a, b) => (depths[b.id] ?? 0) - (depths[a.id] ?? 0))
        .slice(0, 3)
        .map((s) => s.id);
    }
  }

  const drafts: MilestoneDraft[] = [];
  let phaseIndex = 1;

  const buildDraft = (skillIds: string[], opts: { theme: string; adjacent?: boolean }): MilestoneDraft => {
    const skillMeta = skillIds.map((id) => generated.skills.find((s) => s.skillId === id)).filter(Boolean);
    const named = skillIds.map((id) => generated.graph.skills[id]?.name ?? id);
    const primaryDepth = Math.max(...skillIds.map((id) => depths[id] ?? 0));
    const hours = skillMeta.reduce((sum, s) => sum + (s?.estimatedHours ?? 8), 0);
    const meanLevel =
      skillIds.reduce((sum, id) => sum + (evidencedLevels[id] ?? 0), 0) / Math.max(1, skillIds.length);
    const isFinalPhase = opts.adjacent || (adjacentSkills.length === 0 && phaseIndex === phases.length);
    const hasProject = scenario === "exploratory" && isFinalPhase
      ? true // PF-26: exploratory ending in a portfolio-grade capstone project
      : opts.adjacent
        ? false
        : scenario === "intensive"
          ? phaseIndex === Math.ceil(phases.length / 2) || phaseIndex === phases.length
          : phaseIndex % 2 === 0 || phaseIndex === phases.length;
    const totalHours = milestoneHours({ skillHours: hours, hasProject, hasQuiz: true });
    return {
      order: 0, // assigned below
      phase: `${phaseIndex}. ${opts.theme}${opts.adjacent ? " (Adjacent)" : ""}`,
      title: named.slice(0, 3).join(" · ") + (named.length > 3 ? ` +${named.length - 3}` : ""),
      description: `Build ${opts.theme.toLowerCase()} strength in ${named.join(", ")}. ${
        hasProject ? "This phase ends with a hands-on project." : "This phase ends with a gate quiz."
      } Mean evidenced level ${meanLevel.toFixed(1)}/5.`,
      skillIds,
      skillNames: named,
      estimatedHours: totalHours,
      hasProject,
      hasGateQuiz: true,
      meanEvidencedLevel: meanLevel,
    };
  };

  let lastThemeIdx = 0;
  for (const phaseSkills of phases) {
    if (!phaseSkills.length) continue;
    const primaryDepth = Math.max(...phaseSkills.map((id) => depths[id] ?? 0));
    let themeIdx = DEPTH_THEMES.findIndex((t) => primaryDepth <= t.maxDepth);
    if (themeIdx === -1) themeIdx = DEPTH_THEMES.length - 1;
    // PF-19: Enforce monotonic progression: phase themes must never step backward
    themeIdx = Math.max(themeIdx, lastThemeIdx);
    lastThemeIdx = themeIdx;
    const theme = DEPTH_THEMES[themeIdx].theme;
    drafts.push(buildDraft(phaseSkills, { theme }));
    phaseIndex += 1;
  }

  if (adjacentSkills.length) {
    drafts.push(buildDraft(adjacentSkills, { theme: "Adjacent Skills", adjacent: true }));
    phaseIndex += 1;
  }

  drafts.forEach((d, i) => (d.order = i + 1));
  const firstMilestoneAvailable = drafts.length ? 1 : 0;

  // Schedule against weekly hours.
  const scheduled = scheduleMilestones(
    drafts.map((d) => ({ item: d, hours: d.estimatedHours })),
    hoursPerWeek,
    new Date(),
  );

  const learner = await db.learner.findUnique({ where: { id: learnerId } });
  const assessments = await db.skillAssessment.findMany({ where: { learnerId } });

  const executeWrite = async (tx: any) => {
    const existingCount = await tx.learningPath.count({ where: { learnerId } });

    const newPath = await tx.learningPath.create({
      data: {
        learnerId,
        version: existingCount + 1,
        scenario,
        algorithm,
        isActive: true,
        totalSkills: generated.skills.length,
        totalHours: drafts.reduce((s, d) => s + d.estimatedHours, 0),
        hoursPerWeek,
        snapshotJson: JSON.stringify({
          goalSkillId,
          knownSkillIds,
          evidencedLevels,
          assessments: assessments.map((a: any) => ({
            skillId: a.skillId,
            claimed: a.claimedLevel,
            evidenced: a.evidencedLevel,
            tier: a.tier,
          })),
          generatedAt: new Date().toISOString(),
        }),
      },
    });

    await tx.learningPath.updateMany({
      where: { learnerId, id: { not: newPath.id } },
      data: { isActive: false },
    });

    await tx.milestone.createMany({
      data: drafts.map((d, i) => ({
        pathId: newPath.id,
        order: d.order,
        phase: d.phase,
        title: d.title,
        description: d.description,
        skillIdsJson: JSON.stringify(d.skillIds),
        skillNamesJson: JSON.stringify(d.skillNames),
        estimatedHours: d.estimatedHours,
        status: d.order === firstMilestoneAvailable ? "available" : "locked",
        hasProject: d.hasProject,
        hasGateQuiz: d.hasGateQuiz,
        targetStartAt: scheduled[i].startAt,
        targetEndAt: scheduled[i].endAt,
      })),
    });

    await tx.activityLog.create({
      data: {
        learnerId,
        kind: "path_generated",
        detailJson: JSON.stringify({
          pathId: newPath.id,
          scenario,
          version: newPath.version,
          milestones: drafts.length,
          totalHours: newPath.totalHours,
          goalSkillId,
        }),
      },
    });

    return newPath;
  };

  const path = typeof db.$transaction === "function"
    ? await db.$transaction(executeWrite)
    : await executeWrite(db);

  const lastEnd = scheduled.length ? scheduled[scheduled.length - 1].endAt : new Date();

  return {
    pathId: path.id,
    version: path.version,
    totalSkills: generated.skills.length,
    totalHours: path.totalHours,
    milestones: drafts,
    algorithm,
    etaDate: lastEnd.toISOString().slice(0, 10),
  };
}

/** The set of skills the engine treats as already known. */
export async function knownSkillIdsFor(learnerId: string): Promise<{ known: string[]; levels: Record<string, number> }> {
  const assessments = await db.skillAssessment.findMany({ where: { learnerId } });
  const known = assessments.filter((a) => a.evidencedLevel >= 3).map((a) => a.skillId);
  const levels: Record<string, number> = {};
  for (const a of assessments) levels[a.skillId] = a.evidencedLevel;
  return { known, levels };
}

/** Scenario preview (no persistence) for the scenario picker UI. */
export async function previewScenarios(input: Omit<PathGenerationInput, "scenario">): Promise<
  Array<{ scenario: Scenario; totalSkills: number; totalHours: number; etaWeeks: number; algorithm: string; milestones: number }>
> {
  const outcomes: Array<{ scenario: Scenario; totalSkills: number; totalHours: number; etaWeeks: number; algorithm: string; milestones: number }> = [];
  for (const scenario of ["balanced", "intensive", "exploratory"] as Scenario[]) {
    const generated = await buildGeneratedPath({
      targetSkillId: input.goalSkillId,
      knownSkillIds: input.knownSkillIds,
      algorithm: scenario === "intensive" ? "kahn-spt" : "dfs-topological",
      coursesPerSkill: scenario === "intensive" ? 1 : 2,
      evidencedLevels: input.evidencedLevels,
    });
    const depths = computeDepths(generated.graph);
    const phases = phasePartitions(generated.skills.map((s) => s.skillId), depths);

    let adjacentCount = 0;
    let adjacentHours = 0;
    if (scenario === "exploratory") {
      const knownSet = new Set(input.knownSkillIds ?? []);
      const pathSet = new Set(generated.skills.map((s) => s.skillId));
      const eligible = (id: string) => !knownSet.has(id) && !pathSet.has(id);
      let adjacent = (generated.graph.skills[input.goalSkillId]?.prereqs ?? []).flatMap(
        (p) => generated.graph.skills[p]?.prereqs ?? []
      ).filter(eligible).slice(0, 3);
      if (!adjacent.length) {
        adjacent = Object.values(generated.graph.skills)
          .filter((s) => s.domain === generated.domain && eligible(s.id))
          .sort((a, b) => (depths[b.id] ?? 0) - (depths[a.id] ?? 0))
          .slice(0, 3)
          .map((s) => s.id);
      }
      if (adjacent.length) {
        adjacentCount = 1;
        adjacentHours = milestoneHours({ skillHours: adjacent.length * 8, hasProject: true, hasQuiz: true });
      }
    }

    let totalHours = 0;
    phases.forEach((phaseSkills, idx) => {
      const pIndex = idx + 1;
      const skillMeta = phaseSkills.map((id) => generated.skills.find((s) => s.skillId === id)).filter(Boolean);
      const hours = skillMeta.reduce((sum, s) => sum + (s?.estimatedHours ?? 8), 0);
      const isFinalPhase = adjacentCount === 0 && pIndex === phases.length;
      const hasProject = scenario === "exploratory" && isFinalPhase
        ? true
        : scenario === "intensive"
          ? pIndex === Math.ceil(phases.length / 2) || pIndex === phases.length
          : pIndex % 2 === 0 || pIndex === phases.length;
      totalHours += milestoneHours({ skillHours: hours, hasProject, hasQuiz: true });
    });
    totalHours += adjacentHours;

    const totalMilestones = phases.length + adjacentCount;
    outcomes.push({
      scenario,
      totalSkills: generated.skills.length + (adjacentCount > 0 ? 3 : 0),
      totalHours,
      etaWeeks: Math.max(1, Math.round(totalHours / Math.max(1, input.hoursPerWeek))),
      algorithm: generated.algorithm,
      milestones: totalMilestones,
    });
  }
  return outcomes;
}
