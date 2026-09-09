import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  quiz: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  quizAttempt: {
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: "att-1" }),
  },
  milestone: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  learningPath: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  skillAssessment: {
    findUnique: vi.fn().mockResolvedValue({ claimedLevel: 3, evidencedLevel: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/path/replan", () => ({ unlockNext: vi.fn().mockResolvedValue(undefined) }));

import { gradeQuiz } from "./quiz";

describe("Milestone Dual Gates & Completion Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does NOT complete milestone when gate quiz passes if milestone has an unpassed project", async () => {
    mockDb.quiz.findUnique.mockResolvedValue({
      id: "quiz-gate-1",
      kind: "milestone_gate",
      milestoneId: "m1",
      passScore: 0.75,
      learnerId: "learner-1",
      questions: [
        { id: "q1", order: 0, prompt: "Q1", optionsJson: "[]", correctIndex: 0, explanation: "Exp 1" },
        { id: "q2", order: 1, prompt: "Q2", optionsJson: "[]", correctIndex: 0, explanation: "Exp 2" },
        { id: "q3", order: 2, prompt: "Q3", optionsJson: "[]", correctIndex: 0, explanation: "Exp 3" },
        { id: "q4", order: 3, prompt: "Q4", optionsJson: "[]", correctIndex: 0, explanation: "Exp 4" },
      ],
    });

    mockDb.milestone.findUnique.mockResolvedValue({
      id: "m1",
      title: "Fullstack Architecture",
      pathId: "path-1",
      status: "in_progress",
      hasProject: true,
      hasGateQuiz: true,
      skillIdsJson: JSON.stringify(["wd_react"]),
      skillNamesJson: JSON.stringify(["React"]),
      project: {
        id: "proj-1",
        submissions: [], // No submissions yet
      },
    });

    const result = await gradeQuiz("quiz-gate-1", [0, 0, 0, 0]);
    expect(result.passed).toBe(true);

    // Milestone must NOT be updated to complete!
    const milestoneUpdates = mockDb.milestone.update.mock.calls;
    const completedUpdate = milestoneUpdates.find((call: any) => call[0]?.data?.status === "complete");
    expect(completedUpdate).toBeUndefined();
  });

  it("completes milestone when gate quiz passes and project submission has passed", async () => {
    mockDb.quiz.findUnique.mockResolvedValue({
      id: "quiz-gate-2",
      kind: "milestone_gate",
      milestoneId: "m2",
      passScore: 0.75,
      learnerId: "learner-1",
      questions: [
        { id: "q1", order: 0, prompt: "Q1", optionsJson: "[]", correctIndex: 0, explanation: "Exp 1" },
        { id: "q2", order: 1, prompt: "Q2", optionsJson: "[]", correctIndex: 0, explanation: "Exp 2" },
        { id: "q3", order: 2, prompt: "Q3", optionsJson: "[]", correctIndex: 0, explanation: "Exp 3" },
        { id: "q4", order: 3, prompt: "Q4", optionsJson: "[]", correctIndex: 0, explanation: "Exp 4" },
      ],
    });

    mockDb.milestone.findUnique.mockResolvedValue({
      id: "m2",
      title: "Cloud Infrastructure",
      pathId: "path-1",
      status: "in_progress",
      hasProject: true,
      hasGateQuiz: true,
      skillIdsJson: JSON.stringify(["cloud_docker"]),
      skillNamesJson: JSON.stringify(["Docker"]),
      project: {
        id: "proj-2",
        submissions: [{ id: "sub-1", status: "passed" }],
      },
    });

    mockDb.learningPath.findUnique.mockResolvedValue({ id: "path-1", replanReason: "quiz_failed" });

    const result = await gradeQuiz("quiz-gate-2", [0, 0, 0, 0]);
    expect(result.passed).toBe(true);

    // Milestone MUST be updated to complete
    expect(mockDb.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m2" },
        data: expect.objectContaining({ status: "complete" }),
      })
    );

    // Replan reason 'quiz_failed' must be cleared
    expect(mockDb.learningPath.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "path-1" },
        data: { replanReason: null },
      })
    );
  });

  it("withholds correctIndex and explanation on failing quiz attempts to prevent answer harvesting (PF-01)", async () => {
    mockDb.quiz.findUnique.mockResolvedValue({
      id: "quiz-gate-3",
      kind: "milestone_gate",
      milestoneId: "m3",
      passScore: 0.75,
      learnerId: "learner-1",
      questions: [
        { id: "q1", order: 0, prompt: "Q1", optionsJson: "[]", correctIndex: 0, explanation: "Secret 1" },
        { id: "q2", order: 1, prompt: "Q2", optionsJson: "[]", correctIndex: 0, explanation: "Secret 2" },
        { id: "q3", order: 2, prompt: "Q3", optionsJson: "[]", correctIndex: 0, explanation: "Secret 3" },
        { id: "q4", order: 3, prompt: "Q4", optionsJson: "[]", correctIndex: 0, explanation: "Secret 4" },
      ],
    });

    // Failing answers
    const result = await gradeQuiz("quiz-gate-3", [1, 2, 3, 1]);
    expect(result.passed).toBe(false);

    // Breakdown must NOT contain correctIndex or explanation
    for (const b of result.breakdown) {
      expect(b.correctIndex).toBeUndefined();
      expect(b.explanation).toBeUndefined();
    }
  });
});
