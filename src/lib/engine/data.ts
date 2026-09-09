/**
 * Server-side data loading with process-level caching.
 *
 * The full catalogue (2,118 courses / 211 skills) parses once per server
 * process (~40ms) and every subsequent request hits the in-memory cache.
 * Pure computation functions in sibling modules accept the loaded structures
 * as arguments, so they stay usable from client components too.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Course, CourseCatalogue, FreeResource, ResourceIndex, SkillGraph, SkillNode } from "./types";
import { inferCourseLevel } from "./courses";
import { loadResourceSkillMappingV2, loadVouchedCoursesForSkill } from "@/lib/ml/artifacts";

const DATA_DIR = path.join(process.cwd(), "data");

let graphCache: SkillGraph | null = null;
let catalogueCache: CourseCatalogue | null = null;
let resourceCache: ResourceIndex | null = null;

interface RawGraph {
  [domain: string]: Array<{ id: string; name: string; prereqs: string[] }>;
}

interface RawCoursesFile {
  generated_at: string;
  courses: Course[];
}

interface RawResourcesFile {
  schema_version: string;
  resources: FreeResource[];
}

interface RawMapping {
  [courseId: string]: string[];
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function loadSkillGraph(): Promise<SkillGraph> {
  if (graphCache) return graphCache;
  const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, "skill_graph.json"), "utf-8")) as RawGraph;
  const skills: Record<string, SkillNode> = {};
  const byDomain: Record<string, SkillNode[]> = {};
  for (const [domain, list] of Object.entries(raw)) {
    byDomain[domain] = [];
    for (const s of list) {
      const node: SkillNode = { ...s, domain };
      skills[s.id] = node;
      byDomain[domain].push(node);
    }
  }
  graphCache = { domains: Object.keys(raw), skills, byDomain };
  return graphCache;
}

export async function loadCatalogue(): Promise<CourseCatalogue> {
  if (catalogueCache) return catalogueCache;
  const [coursesFile, mappingRaw] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, "courses.json"), "utf-8"),
    fs.readFile(path.join(DATA_DIR, "course_skill_mapping.json"), "utf-8"),
  ]);
  const { courses } = JSON.parse(coursesFile) as RawCoursesFile;
  const mapping = JSON.parse(mappingRaw) as RawMapping;

  const byId: Record<string, Course> = {};
  for (const c of courses) {
    if (!c.Level || !c.Level.trim()) {
      c.Level = inferCourseLevel(c);
    }
    byId[c.course_id] = c;
  }

  // A trained run (ml/ bundle) widens skill -> course coverage from 166 to
  // 211 skills. We take its vouched pairs when installed; without a run the
  // committed static mapping is used unchanged.
  const vouched = await loadVouchedCoursesForSkill();

  // skill -> courses, ranked by rating desc then viewers desc (missing values sink).
  const buckets: Record<string, Course[]> = {};
  if (vouched) {
    for (const [sid, courseIds] of Object.entries(vouched)) {
      for (const cid of courseIds) {
        const course = byId[cid];
        if (course) (buckets[sid] ||= []).push(course);
      }
    }
  } else {
    for (const [courseId, skillIds] of Object.entries(mapping)) {
      const course = byId[courseId];
      if (!course) continue;
      for (const sid of skillIds) {
        (buckets[sid] ||= []).push(course);
      }
    }
  }
  const coursesForSkill: Record<string, string[]> = {};
  const skillMonths: Record<string, number> = {};
  for (const [sid, list] of Object.entries(buckets)) {
    list.sort((a, b) => (b.Rating ?? 0) - (a.Rating ?? 0) || (b.Viewers ?? 0) - (a.Viewers ?? 0));
    coursesForSkill[sid] = list.map((c) => c.course_id);
    const months = list.map((c) => c.DurationMonths).filter((m): m is number => m != null);
    skillMonths[sid] = months.length ? median(months) : 2;
  }

  catalogueCache = { courses, byId, coursesForSkill, skillMonths };
  return catalogueCache;
}

export async function loadResources(): Promise<ResourceIndex> {
  if (resourceCache) return resourceCache;
  const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, "free_resources_mapping.json"), "utf-8")) as RawResourcesFile;
  // Free resources carry the 42 AI-domain skills the Coursera catalogue has
  // no real course for, so a trained run's widened resource mapping matters
  // more here than the course one.
  const resourceMapping = await loadResourceSkillMappingV2();
  const bySkill: Record<string, FreeResource[]> = {};
  for (const r of raw.resources) {
    const skillIds = resourceMapping?.[r.resource_id] ?? r.skill_ids;
    for (const sid of skillIds) {
      (bySkill[sid] ||= []).push(r);
    }
  }
  resourceCache = { resources: raw.resources, bySkill };
  return resourceCache;
}

export async function loadEngineData() {
  const [graph, catalogue, resources] = await Promise.all([loadSkillGraph(), loadCatalogue(), loadResources()]);
  return { graph, catalogue, resources };
}
