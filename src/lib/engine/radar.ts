/**
 * Skill radar computation — the "claims vs evidence vs requirements" engine.
 *
 * For every skill in the learner's target domain we compare three series:
 *
 *   claimed   — what the learner says they know (self-report from interview)
 *   evidenced — what external proof supports (GitHub, quizzes, projects)
 *   required  — the level the goal actually demands (derived from the skill's
 *               depth in the prerequisite DAG: deeper skills in the closure
 *               of the goal demand higher mastery)
 *
 * The gap between claimed and evidenced is the Dunning-Kruger surface; the
 * gap between evidenced and required is the actual learning load.
 */
import type { SkillGraph } from "./types";

export interface RadarSkillPoint {
  skillId: string;
  skillName: string;
  claimed: number;
  evidenced: number;
  required: number;
  /** claimed - evidenced: positive means over-claimed (calibration candidate). */
  overclaim: number;
  /** required - evidenced: positive means genuine learning gap. */
  gap: number;
}

export interface RadarSeries {
  points: RadarSkillPoint[];
  /** Aggregate axes (0-5) for the summary radar chart. */
  axes: Array<{
    axis: string;
    claimed: number;
    evidenced: number;
    required: number;
  }>;
}

export interface AssessmentLike {
  skillId: string;
  claimedLevel: number;
  evidencedLevel: number;
}

/** Required level grows with graph depth: 3 + depth/2, capped at 5. */
export function requiredLevelForDepth(depth: number): number {
  return Math.min(5, 3 + Math.round(depth / 2));
}

export function computeRadar(
  graph: SkillGraph,
  assessments: AssessmentLike[],
  targetSkillId: string,
  depths: Record<string, number>,
): RadarSeries {
  const byId = new Map(assessments.map((a) => [a.skillId, a]));
  const points: RadarSkillPoint[] = [];

  const walk = (id: string, visited: Set<string>) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = graph.skills[id];
    if (!node) return;
    const a = byId.get(id);
    const depth = depths[id] ?? 0;
    const required = requiredLevelForDepth(depth);
    const claimed = a?.claimedLevel ?? 0;
    const evidenced = a?.evidencedLevel ?? 0;
    points.push({
      skillId: id,
      skillName: node.name,
      claimed,
      evidenced,
      required,
      overclaim: Math.max(0, claimed - evidenced),
      gap: Math.max(0, required - evidenced),
    });
    for (const p of node.prereqs) walk(p, visited);
  };
  walk(targetSkillId, new Set());

  // Aggregate into 6 summary axes by depth band, so the radar stays readable
  // even when the closure contains 20+ skills.
  const bandOf = (d: number) => Math.min(5, Math.floor(d / 2));
  const bands: Record<string, { c: number[]; e: number[]; r: number[] }> = {};
  for (const p of points) {
    const band = bandOf(depths[p.skillId] ?? 0);
    (bands[band] ||= { c: [], e: [], r: [] });
    bands[band].c.push(p.claimed);
    bands[band].e.push(p.evidenced);
    bands[band].r.push(p.required);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const bandLabels = ["Foundations", "Core practice", "Applied work", "Integration", "Specialist", "Mastery"];

  const axes = Object.keys(bands)
    .map(Number)
    .sort((a, b) => a - b)
    .map((band) => ({
      axis: bandLabels[band] ?? `Level ${band + 1}`,
      claimed: Math.round(avg(bands[band].c) * 10) / 10,
      evidenced: Math.round(avg(bands[band].e) * 10) / 10,
      required: Math.round(avg(bands[band].r) * 10) / 10,
    }));

  // PF-30: Recharts Radar requires at least 3 axes to render a 2D polygon rather than collapsing to a line
  if (points.length > 0 && axes.length < 3) {
    const existingAxes = new Set(axes.map((a) => a.axis));
    for (let i = 0; i < bandLabels.length && axes.length < 3; i++) {
      const label = bandLabels[i];
      if (!existingAxes.has(label)) {
        axes.push({
          axis: label,
          claimed: 0,
          evidenced: 0,
          required: requiredLevelForDepth(i * 2),
        });
        existingAxes.add(label);
      }
    }
  }

  return { points, axes };
}
