import { describe, it, expect } from "vitest";
import { inferCourseLevel } from "./courses";
import { skillSearch } from "./index";
import { calibrateZpd } from "./zpd";
import type { Course } from "./types";

describe("Batch 3: PF-16 (Course Level Matching)", () => {
  it("infers Beginner level from course title and intro keywords", () => {
    const course: Partial<Course> = {
      Title: "Introduction to Machine Learning",
      ShortIntro: "A beginner-friendly introduction to fundamental ML concepts.",
      SubCategory: "Machine Learning",
    };
    expect(inferCourseLevel(course)).toBe("Beginner");
  });

  it("infers Advanced level from advanced and production keywords", () => {
    const course: Partial<Course> = {
      Title: "Deep Learning and Generative Adversarial Networks in Production",
      ShortIntro: "Master advanced deep learning architectures and reinforcement learning.",
      SubCategory: "Machine Learning",
    };
    expect(inferCourseLevel(course)).toBe("Advanced");
  });

  it("defaults to Intermediate for applied practical coursework", () => {
    const course: Partial<Course> = {
      Title: "Applied Data Science with Python",
      ShortIntro: "Hands-on projects analyzing tabular data.",
      SubCategory: "Data Science",
    };
    expect(inferCourseLevel(course)).toBe("Intermediate");
  });
});

describe("Batch 3: PF-18 (Tokenized & Domain-Indexed Skill Search)", () => {
  it("matches natural multi-word goal phrases like 'Machine Learning Engineer'", async () => {
    const hits = await skillSearch("Machine Learning Engineer");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].name).toBe("Machine Learning");
  });

  it("matches domain queries like 'generative ai'", async () => {
    const hits = await skillSearch("generative ai");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.domain.toLowerCase().includes("generative") || h.name.toLowerCase().includes("genai"))).toBe(true);
  });

  it("matches acronym 'ML' without falsely matching 'HTML'", async () => {
    const hits = await skillSearch("ML");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).not.toBe("wd_html");
    expect(hits.some((h) => h.name.toLowerCase().includes("machine learning") || h.name.toLowerCase().includes("ml"))).toBe(true);
  });
});

describe("Batch 3: PF-23 (ZPD Beginner Floor & Requirement Hours)", () => {
  it("prevents level 0 from collapsing project sizing to 10h", () => {
    const spec = calibrateZpd(0, 10);
    expect(spec.estimatedHours).toBeGreaterThanOrEqual(14);
    expect(spec.requirementCount).toBeGreaterThanOrEqual(3);
    expect(spec.rationale).toContain("effective baseline");
  });
});
