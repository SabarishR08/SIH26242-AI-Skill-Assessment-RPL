import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  quiz: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  milestone: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockCreateGateQuiz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/calibration/quiz", () => ({
  createGateQuiz: mockCreateGateQuiz,
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/quiz/gate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/quiz/gate POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when learnerId is missing", async () => {
    const res = await POST(makeRequest({ milestoneId: "m1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("learnerId and milestoneId are required");
  });

  it("returns 400 when milestoneId is missing", async () => {
    const res = await POST(makeRequest({ learnerId: "l1" }));
    expect(res.status).toBe(400);
  });

  it("returns cached quiz when one already exists", async () => {
    mockDb.quiz.findFirst.mockResolvedValue({
      id: "quiz-existing",
      kind: "milestone_gate",
      skillName: "React",
      questions: [
        { order: 1, prompt: "Q1?", optionsJson: JSON.stringify(["A", "B", "C", "D"]), skillFocus: "hooks" },
        { order: 0, prompt: "Q0?", optionsJson: JSON.stringify(["X", "Y", "Z"]), skillFocus: "basics" },
      ],
    });

    const res = await POST(makeRequest({ learnerId: "l1", milestoneId: "m1" }));
    const data = await res.json();

    expect(data.quiz.mode).toBe("cached");
    expect(data.quiz.quizId).toBe("quiz-existing");
    expect(data.quiz.questions).toHaveLength(2);
    // Questions should be ordered by order field
    expect(data.quiz.questions[0].prompt).toBe("Q0?");
    expect(data.quiz.questions[1].prompt).toBe("Q1?");
  });

  it("creates a new quiz when no cached one exists", async () => {
    mockDb.quiz.findFirst.mockResolvedValue(null);
    mockCreateGateQuiz.mockResolvedValue({
      quizId: "quiz-new",
      questions: [
        { prompt: "New Q1?", options: ["A", "B", "C"], correctIndex: 0, explanation: "Because", skillFocus: "test" },
      ],
      mode: "deterministic",
    });
    mockDb.milestone.findUnique.mockResolvedValue({ title: "Phase 1: React" });

    const res = await POST(makeRequest({ learnerId: "l1", milestoneId: "m1" }));
    const data = await res.json();

    expect(data.quiz.mode).toBe("deterministic");
    expect(data.quiz.quizId).toBe("quiz-new");
    expect(data.quiz.skillName).toBe("Phase 1: React");
    expect(mockCreateGateQuiz).toHaveBeenCalledWith("l1", "m1");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/quiz/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 500 when createGateQuiz throws", async () => {
    mockDb.quiz.findFirst.mockResolvedValue(null);
    mockCreateGateQuiz.mockRejectedValue(new Error("Milestone not found"));

    const res = await POST(makeRequest({ learnerId: "l1", milestoneId: "m1" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Milestone not found");
  });
});
