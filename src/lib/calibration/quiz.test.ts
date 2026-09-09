import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  learner: {
    findUnique: vi.fn().mockResolvedValue({ id: "learner-1", name: "Alex" }),
  },
  quiz: {
    create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "quiz-1", ...data })),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  quizQuestion: {
    createMany: vi.fn().mockResolvedValue({ count: 4 }),
  },
  quizAttempt: {
    create: vi.fn().mockResolvedValue({ id: "attempt-1" }),
  },
  skillAssessment: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue({ id: "a1", claimedLevel: 2, evidencedLevel: 0, tier: "claimed" }),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
  milestone: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  learningPath: {
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/ai/llm", () => ({
  chatJson: vi.fn().mockResolvedValue(null), // Force deterministic generation
  asArray: vi.fn(),
  asString: vi.fn(),
  asInt: vi.fn(),
}));

import { createCalibrationQuiz, gradeQuiz } from "./quiz";

describe("Quiz with Code Inspection Challenges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates code debugging challenge for programming skills in deterministic mode", async () => {
    const res = await createCalibrationQuiz("learner-1", {
      skillId: "wd_python",
      skillName: "Python Programming",
      claimedLevel: 3,
      evidencedLevel: 0,
      gap: 3,
      tier: "claimed",
    });

    expect(res.questions.length).toBeGreaterThan(0);
    const codeQuestion = res.questions.find((q) => q.skillFocus === "Code Debugging" || q.prompt.includes("```"));
    expect(codeQuestion).toBeDefined();
    expect(codeQuestion?.prompt).toContain("```python");
    expect(codeQuestion?.options.length).toBeGreaterThanOrEqual(3);
  });

  it("correctly grades quiz and identifies pass/fail on code questions", async () => {
    mockDb.quiz.findUnique.mockResolvedValue({
      id: "quiz-1",
      kind: "calibration",
      skillId: "wd_python",
      skillName: "Python Programming",
      passScore: 0.75,
      learnerId: "learner-1",
      questions: [
        { id: "q1", order: 0, prompt: "Q1", optionsJson: "[]", correctIndex: 0, explanation: "Exp 1" },
        { id: "q2", order: 1, prompt: "Q2", optionsJson: "[]", correctIndex: 1, explanation: "Exp 2" },
        { id: "q3", order: 2, prompt: "Q3", optionsJson: "[]", correctIndex: 2, explanation: "Exp 3" },
        { id: "q4", order: 3, prompt: "Q4", optionsJson: "[]", correctIndex: 3, explanation: "Exp 4" },
      ],
    });

    const passResult = await gradeQuiz("quiz-1", [0, 1, 2, 3]);
    expect(passResult.passed).toBe(true);
    expect(passResult.score).toBe(1);

    const failResult = await gradeQuiz("quiz-1", [3, 2, 1, 0]);
    expect(failResult.passed).toBe(false);
    expect(failResult.score).toBe(0);
  });
});
