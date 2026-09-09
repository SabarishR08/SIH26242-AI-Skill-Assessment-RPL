import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── All mock data hoisted so vi.mock factories can reference them ──────────

const mockDb = vi.hoisted(() => ({
  learner: {
    findUnique: vi.fn().mockResolvedValue({ id: "learner-1", name: "Test" }),
  },
  learningPath: {
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockImplementation((args: any) =>
      Promise.resolve({ id: "path-1", version: 1, ...args.data })
    ),
    updateMany: vi.fn().mockResolvedValue(undefined),
  },
  skillAssessment: {
    findMany: vi.fn().mockResolvedValue([
      { skillId: "js", claimedLevel: 4, evidencedLevel: 4, tier: "proven" },
      { skillId: "ts", claimedLevel: 3, evidencedLevel: 2, tier: "claimed" },
    ]),
  },
  milestone: {
    createMany: vi.fn().mockResolvedValue(undefined),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue(undefined),
  },
  $transaction: vi.fn().mockImplementation((cb: (tx: any) => any) => cb(mockDb)),
}));

const mockSkillGraph = vi.hoisted(() => ({
  domains: ["Frontend", "Backend"],
  skills: {
    js: { id: "js", name: "JavaScript", prereqs: [], domain: "Frontend" },
    react: { id: "react", name: "React", prereqs: ["js"], domain: "Frontend" },
    ts: { id: "ts", name: "TypeScript", prereqs: ["js"], domain: "Frontend" },
    node: { id: "node", name: "Node.js", prereqs: ["js"], domain: "Backend" },
    next: { id: "next", name: "Next.js", prereqs: ["react", "ts"], domain: "Frontend" },
  },
  byDomain: {
    Frontend: [
      { id: "js", name: "JavaScript", prereqs: [], domain: "Frontend" },
      { id: "react", name: "React", prereqs: ["js"], domain: "Frontend" },
      { id: "ts", name: "TypeScript", prereqs: ["js"], domain: "Frontend" },
      { id: "next", name: "Next.js", prereqs: ["react", "ts"], domain: "Frontend" },
    ],
    Backend: [{ id: "node", name: "Node.js", prereqs: ["js"], domain: "Backend" }],
  },
}));

const mockCatalogue = vi.hoisted(() => ({
  courses: [
    { course_id: "c1", Title: "JS Basics", Rating: 4.8, Viewers: 1000, DurationMonths: 2, Level: "beginner", skillsList: ["js"], domain: "Frontend", URL: "", ShortIntro: "", Category: "", SubCategory: "", CourseType: "", Skills: "", Instructors: "", Site: "" },
    { course_id: "c2", Title: "React Intro", Rating: 4.5, Viewers: 800, DurationMonths: 3, Level: "intermediate", skillsList: ["react"], domain: "Frontend", URL: "", ShortIntro: "", Category: "", SubCategory: "", CourseType: "", Skills: "", Instructors: "", Site: "" },
  ],
  byId: {
    c1: { course_id: "c1", Title: "JS Basics", Rating: 4.8, Viewers: 1000, DurationMonths: 2, Level: "beginner", skillsList: ["js"], domain: "Frontend", URL: "", ShortIntro: "", Category: "", SubCategory: "", CourseType: "", Skills: "", Instructors: "", Site: "" },
    c2: { course_id: "c2", Title: "React Intro", Rating: 4.5, Viewers: 800, DurationMonths: 3, Level: "intermediate", skillsList: ["react"], domain: "Frontend", URL: "", ShortIntro: "", Category: "", SubCategory: "", CourseType: "", Skills: "", Instructors: "", Site: "" },
  },
  coursesForSkill: { js: ["c1"], react: ["c2"] } as Record<string, string[]>,
  skillMonths: { js: 2, react: 3, ts: 2, node: 3, next: 4 } as Record<string, number>,
}));

const mockResources = vi.hoisted(() => ({
  resources: [],
  bySkill: {} as Record<string, any[]>,
}));

const mockGeneratedPath = vi.hoisted(() => ({
  algorithm: "dfs-topological" as const,
  targetSkillId: "next",
  domain: "Frontend",
  skills: [
    { skillId: "js", skillName: "JavaScript", domain: "Frontend", depth: 0, estimatedHours: 28, courses: [], resources: [] },
    { skillId: "ts", skillName: "TypeScript", domain: "Frontend", depth: 1, estimatedHours: 28, courses: [], resources: [] },
    { skillId: "react", skillName: "React", domain: "Frontend", depth: 1, estimatedHours: 42, courses: [], resources: [] },
    { skillId: "next", skillName: "Next.js", domain: "Frontend", depth: 2, estimatedHours: 56, courses: [], resources: [] },
  ],
  totalEstimatedHours: 154,
  edges: [["js", "ts"], ["js", "react"], ["ts", "next"], ["react", "next"]] as Array<[string, string]>,
  catalogue: mockCatalogue,
  graph: mockSkillGraph,
  resources: mockResources,
}));

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/engine", () => ({
  buildGeneratedPath: vi.fn().mockResolvedValue(mockGeneratedPath),
  computeDepths: vi.fn().mockReturnValue({ js: 0, react: 1, ts: 1, node: 1, next: 2 }),
  phasePartitions: vi.fn().mockReturnValue([["js"], ["ts", "react"], ["next"]]),
}));

vi.mock("@/lib/engine/time", () => ({
  scheduleMilestones: vi.fn().mockImplementation((items: any[], _hpw: number, _start: Date) =>
    items.map((it: any, i: number) => ({
      item: it.item,
      hours: it.hours,
      startAt: new Date(2026, 0, 1 + i * 7),
      endAt: new Date(2026, 0, 7 + i * 7),
    }))
  ),
  milestoneHours: vi.fn().mockImplementation((input: any) => {
    let h = input.skillHours;
    if (input.hasProject) h += 8;
    if (input.hasQuiz) h += 1;
    return Math.round(h);
  }),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

import { generatePath, knownSkillIdsFor, SCENARIO_META, type Scenario } from "./generate";

describe("generatePath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.learner.findUnique.mockResolvedValue({ id: "learner-1", name: "Test" });
    mockDb.learningPath.count.mockResolvedValue(0);
    mockDb.learningPath.create.mockImplementation((args: any) =>
      Promise.resolve({ id: "path-1", version: 1, ...args.data })
    );
    mockDb.learningPath.updateMany.mockResolvedValue(undefined);
    mockDb.skillAssessment.findMany.mockResolvedValue([
      { skillId: "js", claimedLevel: 4, evidencedLevel: 4, tier: "proven" },
      { skillId: "ts", claimedLevel: 3, evidencedLevel: 2, tier: "claimed" },
    ]);
    mockDb.milestone.createMany.mockResolvedValue(undefined);
    mockDb.activityLog.create.mockResolvedValue(undefined);
  });

  it("generates a path with milestones for balanced scenario", async () => {
    const result = await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "balanced",
      hoursPerWeek: 10,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    expect(result.pathId).toBe("path-1");
    expect(result.version).toBe(1);
    expect(result.totalSkills).toBe(4);
    expect(result.algorithm).toBe("dfs-topological");
    expect(result.milestones).toHaveLength(3);
    expect(result.etaDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("creates milestones in the database with correct structure", async () => {
    await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "balanced",
      hoursPerWeek: 10,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    expect(mockDb.milestone.createMany).toHaveBeenCalledTimes(1);
    const call = mockDb.milestone.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(3);
    expect(call.data[0].status).toBe("available");
    expect(call.data[1].status).toBe("locked");
    expect(call.data[2].status).toBe("locked");
    for (const m of call.data) {
      expect(m.hasGateQuiz).toBe(true);
      expect(m.pathId).toBe("path-1");
    }
  });

  it("uses kahn-spt algorithm for intensive scenario", async () => {
    const result = await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "intensive",
      hoursPerWeek: 15,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    expect(result.algorithm).toBe("kahn-spt");
  });

  it("assigns sequential order to milestones", async () => {
    const result = await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "balanced",
      hoursPerWeek: 10,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    const orders = result.milestones.map((m) => m.order);
    expect(orders).toEqual([1, 2, 3]);
  });

  it("deactivates previous paths for the learner", async () => {
    await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "balanced",
      hoursPerWeek: 10,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    expect(mockDb.learningPath.updateMany).toHaveBeenCalledWith({
      where: { learnerId: "learner-1", id: { not: "path-1" } },
      data: { isActive: false },
    });
  });

  it("logs the path generation activity", async () => {
    await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "balanced",
      hoursPerWeek: 10,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    expect(mockDb.activityLog.create).toHaveBeenCalledTimes(1);
    const logCall = mockDb.activityLog.create.mock.calls[0][0];
    expect(logCall.data.kind).toBe("path_generated");
    expect(logCall.data.learnerId).toBe("learner-1");
  });

  it("snapshots assessment data into the path", async () => {
    await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "balanced",
      hoursPerWeek: 10,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    const pathCreate = mockDb.learningPath.create.mock.calls[0][0];
    const snapshot = JSON.parse(pathCreate.data.snapshotJson);
    expect(snapshot.goalSkillId).toBe("next");
    expect(snapshot.assessments).toHaveLength(2);
    expect(snapshot.assessments[0].skillId).toBe("js");
  });

  it("includes project milestones on even phases for balanced scenario", async () => {
    const result = await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "balanced",
      hoursPerWeek: 10,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    expect(result.milestones[1].hasProject).toBe(true);
    expect(result.milestones[2].hasProject).toBe(true);
  });

  it("only includes midpoint and finale projects for intensive scenario", async () => {
    const result = await generatePath({
      learnerId: "learner-1",
      goalSkillId: "next",
      scenario: "intensive",
      hoursPerWeek: 15,
      knownSkillIds: [],
      evidencedLevels: {},
    });

    expect(result.milestones[1].hasProject).toBe(true);
    expect(result.milestones[2].hasProject).toBe(true);
    expect(result.milestones[0].hasProject).toBe(false);
  });
});

describe("knownSkillIdsFor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.skillAssessment.findMany.mockResolvedValue([
      { skillId: "js", claimedLevel: 4, evidencedLevel: 4, tier: "proven" },
      { skillId: "ts", claimedLevel: 3, evidencedLevel: 2, tier: "claimed" },
      { skillId: "react", claimedLevel: 5, evidencedLevel: 3, tier: "verified" },
    ]);
  });

  it("returns skills with evidencedLevel >= 3 as known", async () => {
    const { known } = await knownSkillIdsFor("learner-1");
    expect(known).toContain("js");
    expect(known).toContain("react");
    expect(known).not.toContain("ts");
  });

  it("returns evidence levels for all assessments", async () => {
    const { levels } = await knownSkillIdsFor("learner-1");
    expect(levels).toEqual({ js: 4, ts: 2, react: 3 });
  });

  it("returns empty arrays when no assessments exist", async () => {
    mockDb.skillAssessment.findMany.mockResolvedValue([]);
    const { known, levels } = await knownSkillIdsFor("learner-1");
    expect(known).toEqual([]);
    expect(levels).toEqual({});
  });
});

describe("SCENARIO_META", () => {
  it("defines all three scenarios", () => {
    expect(SCENARIO_META.balanced).toBeDefined();
    expect(SCENARIO_META.intensive).toBeDefined();
    expect(SCENARIO_META.exploratory).toBeDefined();
  });

  it("each scenario has label, tagline, and description", () => {
    for (const scenario of ["balanced", "intensive", "exploratory"] as Scenario[]) {
      expect(typeof SCENARIO_META[scenario].label).toBe("string");
      expect(typeof SCENARIO_META[scenario].tagline).toBe("string");
      expect(typeof SCENARIO_META[scenario].description).toBe("string");
      expect(SCENARIO_META[scenario].label.length).toBeGreaterThan(0);
      expect(SCENARIO_META[scenario].description.length).toBeGreaterThan(20);
    }
  });
});
