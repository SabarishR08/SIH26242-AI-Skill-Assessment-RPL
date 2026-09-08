/**
 * Loader for trained-model artefacts produced by the `ml/` bundle.
 *
 * Artefacts are plain JSON dropped into `data/ml/` (or the directory named by
 * PATHFINDER_ML_DIR). Every loader returns null when the file is absent, so
 * the deterministic engine keeps working exactly as before a training run.
 * Results are cached per server process like the rest of the engine data.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export interface MlManifest {
  schema: string;
  run: { run_id: string; started_at: string; finished_at: string | null; smoke: boolean };
  stages?: Record<string, unknown>;
}

export interface SkillNeighbor {
  skillId: string;
  name: string;
  domain: string;
  score: number;
}

export interface EquivalentSkillPair {
  a: string;
  b: string;
  name: string;
  score: number;
}

export interface SkillCourseScore {
  courseId: string;
  score: number;
  source: "existing" | "semantic" | "fallback";
}

export function mlDir(): string {
  return process.env.PATHFINDER_ML_DIR || path.join(process.cwd(), "data", "ml");
}

const cache = new Map<string, unknown>();

async function readOptional<T>(name: string): Promise<T | null> {
  const key = path.join(mlDir(), name);
  if (cache.has(key)) return cache.get(key) as T | null;
  let value: T | null = null;
  try {
    value = JSON.parse(await fs.readFile(key, "utf-8")) as T;
  } catch {
    value = null;
  }
  cache.set(key, value);
  return value;
}

/** Drop cached artefacts (tests, or after copying a new run in). */
export function resetMlCache(): void {
  cache.clear();
}

/**
 * Minimum cosine score for a semantically-matched course to be shown as a
 * recommendation. The trained run reports the threshold that maximises
 * course→skill F1 on held-out courses (0.54 for run 20260907-234539); below
 * it the retriever is guessing.
 *
 * The `fallback` source exists only so every skill has *something* in the
 * artefact — for the 42 AI-domain skills the Coursera catalogue genuinely
 * has no matching course, and those rows score 0.33-0.51. Surfacing them
 * would be a worse recommendation than showing nothing, so they are filtered
 * out here and those skills fall through to their free resources instead.
 */
export const MIN_COURSE_SCORE = 0.54;

export interface SearchIndex {
  model: string;
  dim: number;
  skills: Array<{ id: string; name: string; domain: string; vec: number[] }>;
}

export interface TaggerWeights {
  embedding_model: string;
  dim: number;
  skill_ids: string[];
  /** [skills x dim] logistic coefficients. */
  W: number[][];
  b: number[];
  /** Probability threshold that maximised micro-F1 on held-out courses. */
  threshold: number;
  cosine_threshold: number;
  trained_skill_ids: string[];
}

export const loadMlManifest = () => readOptional<MlManifest>("manifest.json");
export const loadSearchIndex = () => readOptional<SearchIndex>("search_index.json");
export const loadTaggerWeights = () => readOptional<TaggerWeights>("tagger_weights.json");
export const loadCourseSkillMappingV2 = () => readOptional<Record<string, string[]>>("course_skill_mapping.v2.json");
export const loadSkillCourseScores = () => readOptional<Record<string, SkillCourseScore[]>>("skill_course_scores.v2.json");
export const loadResourceSkillMappingV2 = () => readOptional<Record<string, string[]>>("resource_skill_mapping.v2.json");
export const loadSkillNeighbors = () => readOptional<Record<string, SkillNeighbor[]>>("skill_neighbors.json");
export const loadCourseNeighbors = () => readOptional<Record<string, Array<{ courseId: string; score: number }>>>("course_neighbors.json");
// Note: `suggested_edges.json` is deliberately not loaded by the app.
// Those are unreviewed candidate prerequisite edges; applying them
// automatically would let an embedding rewrite the skill DAG. They are meant
// to be read by a human and, if accepted, edited into data/skill_graph.json.
export const loadEquivalentSkills = () => readOptional<EquivalentSkillPair[]>("equivalent_skills.json");

/** True when at least a manifest from a training run is present. */
export async function mlArtifactsAvailable(): Promise<boolean> {
  return (await loadMlManifest()) !== null;
}

/**
 * skillId -> equivalent skill ids (the same competence duplicated across
 * domains, e.g. `ds_python` / `ml_python`, both literally "Python
 * Programming"). Symmetric and one-hop; empty object when no trained run.
 */
export async function loadEquivalenceMap(): Promise<Record<string, string[]>> {
  const pairs = await loadEquivalentSkills();
  const map: Record<string, string[]> = {};
  for (const p of pairs ?? []) {
    (map[p.a] ||= []).push(p.b);
    (map[p.b] ||= []).push(p.a);
  }
  return map;
}

/**
 * skill -> course ids the retriever actually vouches for, best score first.
 * Returns null when no trained run is installed, so callers keep the static
 * mapping. Rows below MIN_COURSE_SCORE are dropped (see the constant).
 */
export async function loadVouchedCoursesForSkill(
  minScore = MIN_COURSE_SCORE,
): Promise<Record<string, string[]> | null> {
  const scores = await loadSkillCourseScores();
  if (!scores) return null;
  const out: Record<string, string[]> = {};
  for (const [skillId, rows] of Object.entries(scores)) {
    const kept = rows
      .filter((r) => r.source === "existing" || r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.courseId);
    if (kept.length) out[skillId] = kept;
  }
  return out;
}
