/**
 * Engine facade — assembles data + algorithms into the operations the API
 * layer needs. Server-side only (reads files); pure functions live in the
 * sibling modules and remain client-safe.
 */
import { computeDepths, inducedEdges } from "./graph";
import { recommendCourses, resourcesForSkills } from "./courses";
import { generatePathOptimal, generatePathStandard } from "./topo";
import { skillHours, DEFAULT_TIME_MODEL } from "./time";
import { loadCatalogue, loadEngineData, loadResources, loadSkillGraph } from "./data";
import { loadSkillNeighbors } from "@/lib/ml/artifacts";
import { searchSkillsSemantically } from "@/lib/ml/search";
import { HttpError } from "@/lib/api-helpers";
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
    throw new HttpError(`Unknown skill: ${targetSkillId}`, 400);
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
    const depth = depths[sid] ?? 0;
    return {
      skillId: sid,
      skillName: node?.name ?? sid,
      domain: node?.domain ?? "General",
      depth,
      estimatedHours: skillHours(months, DEFAULT_TIME_MODEL, depth),
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
const ACRONYMS: Record<string, string[]> = {
  ml: ["machine learning"],
  ai: ["artificial intelligence"],
  nlp: ["natural language processing"],
  dl: ["deep learning"],
  cv: ["computer vision"],
  db: ["database"],
  dbms: ["database"],
  k8s: ["kubernetes"],
  gcp: ["google cloud"],
  aws: ["amazon web services"],
  rl: ["reinforcement learning"],
  gan: ["generative adversarial"],
  rag: ["retrieval augmented"],
};

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

  const tokens = q.split(/\s+/).filter(Boolean);

  // Score candidate skills based on exact phrase, per-token word matching, domain name, and acronyms
  const scoredCandidates: Array<{ hit: SkillHit; score: number }> = [];

  for (const s of pool) {
    if (!q) {
      const h = hit(s.id, "name");
      if (h) scoredCandidates.push({ hit: h, score: 10 });
      continue;
    }

    const name = s.name.toLowerCase();
    const domainName = (s.domain || "").toLowerCase();
    const nameWords = name.split(/[\s,()/-]+/).filter(Boolean);

    let score = 0;

    // 1. Exact phrase matches on name
    if (name === q) {
      score += 150;
    } else if (name.startsWith(q)) {
      score += 100;
    } else if (name.includes(q)) {
      score += 70;
    }

    // 2. Domain matches (e.g. "Generative AI", "AI Engineering")
    if (domainName === q) {
      score += 90;
    } else if (domainName.includes(q)) {
      score += 60;
    }

    // 3. Token-by-token matching
    let tokenMatches = 0;
    for (const t of tokens) {
      let matchedThisToken = false;

      // Acronym expansions (e.g. "ml" -> "machine learning")
      const expansions = ACRONYMS[t];
      if (expansions) {
        for (const exp of expansions) {
          if (name.includes(exp)) {
            score += 50;
            matchedThisToken = true;
            break;
          }
        }
      }

      // Word boundary match in skill name
      if (nameWords.includes(t)) {
        score += 35;
        matchedThisToken = true;
      } else if (nameWords.some((w) => w.startsWith(t) && t.length >= 3)) {
        score += 20;
        matchedThisToken = true;
      }

      // Domain token match
      if (domainName.includes(t)) {
        score += 15;
        matchedThisToken = true;
      }

      if (matchedThisToken) tokenMatches++;
    }

    // Require at least one meaningful token match if multi-word query
    if (tokens.length > 1 && tokenMatches === 0 && score < 60) {
      score = 0;
    }

    if (score > 0) {
      const h = hit(s.id, "name");
      if (h) scoredCandidates.push({ hit: h, score });
    }
  }

  scoredCandidates.sort((a, b) => b.score - a.score || a.hit.depth - b.hit.depth || a.hit.name.localeCompare(b.hit.name));

  const literal = scoredCandidates.map((s) => s.hit);
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
