import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  quiz: {
    findUnique: vi.fn(),
  },
  quizAttempt: {
    count: vi.fn().mockResolvedValue(0),
  },
  milestone: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockGradeQuiz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/calibration/quiz", () => ({
  gradeQuiz: mockGradeQuiz,
}));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/quiz/quiz-1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/quiz/[id]/submit POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when learnerId is omitted (PF-01b)", async () => {
    const res = await POST(makeRequest({ answers: [0, 1, 2, 3] }), {
      params: Promise.resolve({ id: "quiz-1" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("learnerId is required");
  });

  it("returns 403 when learnerId does not match quiz owner", async () => {
    mockDb.quiz.findUnique.mockResolvedValue({
      id: "quiz-1",
      learnerId: "victim-learner",
      status: "pending",
    });

    const res = await POST(makeRequest({ learnerId: "attacker-learner", answers: [0, 1, 2, 3] }), {
      params: Promise.resolve({ id: "quiz-1" }),
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Unauthorized: quiz belongs to another learner");
  });

  it("processes answers successfully when learnerId matches", async () => {
    mockDb.quiz.findUnique.mockResolvedValue({
      id: "quiz-1",
      learnerId: "valid-learner",
      status: "pending",
    });
    mockGradeQuiz.mockResolvedValue({
      score: 1.0,
      passed: true,
      attemptsCount: 1,
      attemptsRemaining: 2,
      isTerminal: true,
      breakdown: [],
      verdict: "Passed",
    });

    const res = await POST(makeRequest({ learnerId: "valid-learner", answers: [0, 1, 2, 3] }), {
      params: Promise.resolve({ id: "quiz-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.passed).toBe(true);
  });
});
