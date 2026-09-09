import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMilestones = [
  {
    id: "m1",
    pathId: "path-1",
    order: 1,
    phase: "1. Foundations",
    title: "Computer Programming",
    description: "Foundations",
    skillIdsJson: JSON.stringify(["wd_programming"]),
    skillNamesJson: JSON.stringify(["Computer Programming"]),
    estimatedHours: 50,
    status: "in_progress",
    hasProject: false,
    hasGateQuiz: true,
    targetStartAt: new Date(2026, 0, 1),
    targetEndAt: new Date(2026, 1, 1),
  },
  {
    id: "m2",
    pathId: "path-1",
    order: 2,
    phase: "2. Core Practice",
    title: "Python Programming",
    description: "Core",
    skillIdsJson: JSON.stringify(["wd_python"]),
    skillNamesJson: JSON.stringify(["Python Programming"]),
    estimatedHours: 60,
    status: "locked",
    hasProject: true,
    hasGateQuiz: true,
    targetStartAt: new Date(2026, 1, 2),
    targetEndAt: new Date(2026, 2, 1),
  },
];

let createdMilestones: any[] = [];
let updatedMilestones: any[] = [];

const mockDb = vi.hoisted(() => ({
  learner: {
    findUnique: vi.fn().mockResolvedValue({ id: "learner-1", name: "Alex", goalSkillId: "wd_python", hoursPerWeek: 10 }),
  },
  learningPath: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  milestone: {
    findMany: vi.fn(),
    update: vi.fn().mockImplementation(({ where, data }: any) => {
      updatedMilestones.push({ id: where.id, data });
      return Promise.resolve({ id: where.id, ...data });
    }),
    create: vi.fn().mockImplementation(({ data }: any) => {
      const created = { id: `m-new-${createdMilestones.length}`, ...data };
      createdMilestones.push(created);
      return Promise.resolve(created);
    }),
  },
  feedbackItem: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("./generate", () => ({
  knownSkillIdsFor: vi.fn().mockResolvedValue({ known: [], levels: {} }),
  generatePath: vi.fn().mockImplementation(async () => {
    return {
      pathId: "path-new",
      version: 2,
      totalSkills: 2,
      totalHours: 110,
      milestones: [],
      algorithm: "dfs-topological",
      etaDate: "2026-03-01",
    };
  }),
}));

vi.mock("@/lib/engine/time", () => ({
  scheduleMilestones: vi.fn().mockImplementation((items: any[]) =>
    items.map((it: any, i: number) => ({
      item: it.item,
      hours: it.hours,
      startAt: new Date(2026, 0, 1 + i * 7),
      endAt: new Date(2026, 0, 7 + i * 7),
    }))
  ),
}));

import { replanPath } from "./replan";

describe("replanPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdMilestones = [];
    updatedMilestones = [];

    const activePath = {
      id: "path-1",
      learnerId: "learner-1",
      version: 1,
      scenario: "balanced",
      isActive: true,
      milestones: [...mockMilestones],
    };

    const newGeneratedPath = {
      id: "path-new",
      learnerId: "learner-1",
      version: 2,
      scenario: "balanced",
      isActive: true,
      milestones: [
        { ...mockMilestones[0], id: "m-new-1", pathId: "path-new", status: "available" },
        { ...mockMilestones[1], id: "m-new-2", pathId: "path-new", status: "locked" },
      ],
    };

    mockDb.learningPath.findFirst.mockResolvedValue(activePath);
    mockDb.learningPath.findUnique.mockResolvedValue(newGeneratedPath);
    mockDb.milestone.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.pathId === "path-new") {
        return [...newGeneratedPath.milestones, ...createdMilestones];
      }
      return [];
    });
  });

  it("inserts consolidation milestone with correct sequential order on too_hard", async () => {
    const outcome = await replanPath("learner-1", "too_hard", { failedMilestoneId: "m1" });

    expect(outcome.diff.added.length).toBeGreaterThan(0);
    expect(outcome.diff.added[0].phase).toContain("Consolidation");

    const consolidation = createdMilestones.find((m) => m.phase.includes("Consolidation"));
    expect(consolidation).toBeDefined();
    expect(consolidation.order).toBe(2);

    const shiftedM2 = updatedMilestones.find((u) => u.id === "m-new-2");
    expect(shiftedM2).toBeDefined();
    expect(shiftedM2.data.order).toBe(3);
  });

  it("inserts remediation milestone with gate quiz on quiz_failed", async () => {
    const outcome = await replanPath("learner-1", "quiz_failed", { failedMilestoneId: "m1" });

    expect(outcome.diff.added.length).toBeGreaterThan(0);
    expect(outcome.diff.added[0].phase).toContain("Remediation");

    const remediation = createdMilestones.find((m) => m.phase.includes("Remediation"));
    expect(remediation).toBeDefined();
    expect(remediation.hasGateQuiz).toBe(true);
    expect(remediation.status).toBe("available");
  });
});
