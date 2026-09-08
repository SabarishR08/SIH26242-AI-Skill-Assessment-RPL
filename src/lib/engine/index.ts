/**
 * Engine facade — assembles data + algorithms into the operations the API
 * layer needs. Server-side only (reads files); pure functions live in the
 * sibling modules and remain client-safe.
 */
import { computeDepths, inducedEdges } from "./graph";
import { recommendCourses, resourcesForSkills } from "./courses";
import { generatePathOptimal, generatePathStandard } from "./topo";
import { skillHours } from "./time";
import { loadCatalogue, loadEngineData, loadResources, loadSkillGraph } from "./data";
import { loadSkillNeighbors } from "@/lib/ml/artifacts";
import { searchSkillsSemantically } from "@/lib/ml/search";
import type { Course, CourseCatalogue, FreeResource, GeneratedPath, ResourceIndex, SkillGraph } from "./types";

export * from "./types";
export { loadCatalogue, loadEngineData, loadResources, loadSkillGraph };
export { computeRadar, requiredLevelForDepth } from "./radar";
export type { RadarSeries, RadarSkillPoint, AssessmentLike } from "./radar";
export { calibrateZpd, tierLabel } from "./zpd";
export type { ZpdSpec } from "./zpd";
export { computeDepths, descendants, ancestorClosure, inducedEdges, phasePartitions } from "./graph";
export { generatePathOptimal, generatePathStandard } from "./topo";
export { skillHours, milestoneHours, scheduleMilestones, humanDuration, formatDate, DEFAULT_TIME_MODEL } from "./time";
export type { TimeModelConstants, ScheduleItem } from "./time";
export { recommendCourses, resourcesForSkills } from "./courses";

export interface BuildPathOptions {
  targetSkillId: string;
  knownSkillIds: string[];
  algorithm?: "dfs-topological" | "kahn-spt";
  coursesPerSkill?: number;
  /** skillId -> evidenced level map, for course level-affinity. */
  evidencedLevels?: Record<string, number>;
}

export async function buildGeneratedPath(options: BuildPathOptions): Promise<GeneratedPath & {
  catalogue: CourseCatalogue;
  graph: SkillGraph;
  resources: ResourceIndex;
}> {
  const { graph, catalogue, resources } = await loadEngineData();
  const { targetSkillId, knownSkillIds, algorithm = "dfs-topological", coursesPerSkill = 2, evidencedLevels = {} } = options;

  if (!graph.skills[targetSkillId]) {
    throw new Error(`Unknown skill: ${targetSkillId}`);
  }

  const weights: Record<string, number> = {};
  for (const [sid, months] of Object.entries(catalogue.skillMonths)) {
    weights[sid] = months || 2;
  }

  const result =
    algorithm === "kahn-spt"
      ? generatePathOptimal(graph, targetSkillId, knownSkillIds, weights)
      : generatePathStandard(graph, targetSkillId, knownSkillIds);

  const depths = computeDepths(graph);
  const resourceMap = resourcesForSkills(resources, result.orderedSkillIds, { perSkill: 3 });

  const planned = result.orderedSkillIds.map((sid) => {
    const node = graph.skills[sid];
    const months = catalogue.skillMonths[sid] ?? 2;
    return {
      skillId: sid,
      skillName: node?.name ?? sid,
      domain: node?.domain ?? "General",
      depth: depths[sid] ?? 0,
      estimatedHours: skillHours(months),
      courses: recommendCourses(catalogue, sid, { perSkill: coursesPerSkill, evidencedLevel: evidencedLevels[sid] ?? 0 }),
      resources: resourceMap[sid] ?? [],
    };
  });

  const closureSet = new Set(result.orderedSkillIds);
  return {
    algorithm: result.algorithm,
    targetSkillId,
    domain: graph.skills[targetSkillId]?.domain ?? "General",
    skills: planned,
    totalEstimatedHours: planned.reduce((s, p) => s + p.estimatedHours, 0),
    edges: inducedEdges(graph, closureSet),
    catalogue,
    graph,
    resources,
  };
}

export interface SkillHit {
  id: string;
  name: string;
  domain: string;
  depth: number;
  /**
   * How the hit was found: a literal name match, a neighbour of one
   * (`related`), or the embedding index (`semantic`). Name matches always
   * rank first, so a trained run can only ever add results, never displace
   * the ones a plain search already returned.
   */
  via: "name" | "related" | "semantic";
}

const SKILL_SEARCH_LIMIT = 25;

/**
 * Search the skill catalogue.
 *
 * Substring matching alone misses everything phrased differently — "LLM",
 * "vector search" and "prompting" all return nothing against catalogue names.
 * When a trained run is installed we widen the result set in two ways, both
 * strictly additive:
 *
 *   1. `skill_neighbors.json` — the nearest skills to each literal match
 *   2. the ONNX query encoder + `search_index.json`, when the encoder is
 *      installed, which matches on meaning rather than spelling
 */
export async function skillSearch(query: string, domain?: string | null): Promise<SkillHit[]> {
  const graph = await loadSkillGraph();
  const depths = computeDepths(graph);
  const q = query.trim().toLowerCase();
  const inDomain = (id: string) => !domain || graph.skills[id]?.domain === domain;
  const pool = domain && graph.byDomain[domain] ? graph.byDomain[domain] : Object.values(graph.skills);

  const hit = (id: string, via: SkillHit["via"]): SkillHit | null => {
    const node = graph.skills[id];
    if (!node) return null;
    return { id, name: node.name, domain: node.domain, depth: depths[id] ?? 0, via };
  };

  const byDepthThenName = (a: SkillHit, b: SkillHit) => a.depth - b.depth || a.name.localeCompare(b.name);

  const literal = pool
    .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
    .map((s) => hit(s.id, "name"))
    .filter((h): h is SkillHit => h !== null)
    .sort(byDepthThenName);

  const results: SkillHit[] = literal.slice(0, SKILL_SEARCH_LIMIT);
  const seen = new Set(results.map((r) => r.id));
  if (!q || results.length >= SKILL_SEARCH_LIMIT) return results;

  // 1. Neighbours of what we already matched.
  const neighbours = await loadSkillNeighbors();
  if (neighbours) {
    const related: Array<{ h: SkillHit; score: number }> = [];
    for (const base of literal.slice(0, 5)) {
      for (const n of neighbours[base.id] ?? []) {
        if (seen.has(n.skillId) || !inDomain(n.skillId)) continue;
        const h = hit(n.skillId, "related");
        if (h) {
          seen.add(n.skillId);
          related.push({ h, score: n.score });
        }
      }
    }
    related.sort((a, b) => b.score - a.score);
    results.push(...related.slice(0, SKILL_SEARCH_LIMIT - results.length).map((r) => r.h));
  }
  if (results.length >= SKILL_SEARCH_LIMIT) return results;

  // 2. Meaning-based matches for queries the catalogue never spells out.
  // Ask for a full page: some of what comes back is already in `seen`, and
  // the loop below stops as soon as the page is full.
  const semantic = await searchSkillsSemantically(query, SKILL_SEARCH_LIMIT);
  for (const s of semantic) {
    if (seen.has(s.skillId) || !inDomain(s.skillId)) continue;
    const h = hit(s.skillId, "semantic");
    if (h) {
      seen.add(s.skillId);
      results.push(h);
    }
    if (results.length >= SKILL_SEARCH_LIMIT) break;
  }
  return results;
}

export type { Course, FreeResource };
