/**
 * Course recommendation and free-resource retrieval.
 *
 * Ranking is deterministic: rating desc, then viewer count desc, then course
 * id for tie-breaking. Level affinity nudges courses whose declared Level
 * matches the learner's evidenced band (beginner/intermediate/advanced)
 * without overriding the rating signal entirely.
 */
import type { Course, CourseCatalogue, FreeResource, ResourceIndex } from "./types";

export interface CourseRecommendationOptions {
  perSkill?: number;
  /** learner's evidenced level for the skill (0-5) — used for level affinity. */
  evidencedLevel?: number;
}

export function inferCourseLevel(course: Partial<Course>): "Beginner" | "Intermediate" | "Advanced" {
  if (course.Level && course.Level.trim()) {
    const raw = course.Level.trim().toLowerCase();
    if (raw.includes("adv")) return "Advanced";
    if (raw.includes("int")) return "Intermediate";
    if (raw.includes("beg") || raw.includes("intro") || raw.includes("fund")) return "Beginner";
  }

  const text = `${course.Title || ""} ${course.ShortIntro || ""} ${course.SubCategory || ""}`.toLowerCase();

  // Advanced signals
  if (
    text.includes("advanced") ||
    text.includes("production") ||
    text.includes("deep learning") ||
    text.includes("expert") ||
    text.includes("reinforcement learning") ||
    text.includes("architecture") ||
    text.includes("optimization") ||
    text.includes("distributed") ||
    text.includes("kernel") ||
    text.includes("compiler") ||
    text.includes("generative adversarial")
  ) {
    return "Advanced";
  }

  // Beginner signals
  if (
    text.includes("beginner") ||
    text.includes("introduction") ||
    text.includes("intro") ||
    text.includes("fundamentals") ||
    text.includes("for everybody") ||
    text.includes("basics") ||
    text.includes("foundations") ||
    text.includes("getting started") ||
    text.includes("launch your career") ||
    text.includes("101") ||
    text.includes("principles")
  ) {
    return "Beginner";
  }

  // Default to Intermediate for general applied material
  return "Intermediate";
}

function levelBand(level: number): "beginner" | "intermediate" | "advanced" {
  if (level <= 1) return "beginner";
  if (level <= 3) return "intermediate";
  return "advanced";
}

export function recommendCourses(
  catalogue: CourseCatalogue,
  skillId: string,
  options: CourseRecommendationOptions = {},
): Course[] {
  const { perSkill = 2, evidencedLevel = 0 } = options;
  const ids = catalogue.coursesForSkill[skillId] || [];
  const courses = ids.map((id) => catalogue.byId[id]).filter(Boolean);
  if (courses.length <= perSkill) return courses;

  const band = levelBand(evidencedLevel);
  const scored = courses.map((c) => {
    // Affinity bonus (max +0.3) never outweighs a 0.1 rating difference by itself
    // but breaks ties in favour of level-appropriate material.
    let bonus = 0;
    const raw = (c.Level || "").toLowerCase();
    if (raw.includes(band)) bonus += 0.3;
    else if (raw && !raw.includes(band)) bonus -= 0.1;
    if (band === "beginner" && raw.includes("advanced")) bonus -= 0.4;
    return { course: c, score: (c.Rating ?? 0) + bonus };
  });
  scored.sort((a, b) => b.score - a.score || (b.course.Viewers ?? 0) - (a.course.Viewers ?? 0));
  return scored.slice(0, perSkill).map((s) => s.course);
}

export interface ResourceOptions {
  format?: "video" | "reading" | "interactive" | "reference" | null;
  perSkill?: number;
}

export function resourcesForSkills(
  index: ResourceIndex,
  skillIds: string[],
  options: ResourceOptions = {},
): Record<string, FreeResource[]> {
  const { format = null, perSkill = 3 } = options;
  const out: Record<string, FreeResource[]> = {};
  for (const sid of skillIds) {
    const matches = (index.bySkill[sid] || []).filter((r) => !format || r.format === format);
    if (matches.length) out[sid] = matches.slice(0, perSkill);
  }
  return out;
}

export function catalogueStats(catalogue: CourseCatalogue) {
  return {
    courses: catalogue.courses.length,
    skillsWithCourses: Object.keys(catalogue.coursesForSkill).length,
  };
}
