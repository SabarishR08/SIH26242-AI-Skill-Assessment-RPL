import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  agentState: {
    findUnique: vi.fn(),
  },
  learner: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// ─── Tests ──────────────────────────────────────────────────────────────────

import { GET } from "./route";

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("/api/onboarding/state GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns learner and agent state", async () => {
    mockDb.agentState.findUnique.mockResolvedValue({
      phase: "goal",
      roundsCompleted: 3,
      historyJson: JSON.stringify([
        { role: "assistant", content: "Hi!" },
        { role: "user", content: "I want to learn React" },
      ]),
      extractedJson: JSON.stringify({ name: "Sabarish", goalStatement: "Learn React" }),
    });
    mockDb.learner.findUnique.mockResolvedValue({
      id: "learner-1",
      name: "Sabarish",
      goalStatement: "Learn React",
      targetRole: "Frontend Dev",
      domain: "Frontend",
      goalSkillId: "react",
      hoursPerWeek: 10,
      timelineWeeks: 12,
      learningStyle: "project-based",
      motivation: "career switch",
      onboardingStage: "interview",
    });

    const res = await GET(makeRequest("http://localhost/api/onboarding/state?learnerId=learner-1"));
    const data = await res.json();

    expect(data.phase).toBe("goal");
    expect(data.roundsCompleted).toBe(3);
    expect(data.history).toHaveLength(2);
    expect(data.extracted.name).toBe("Sabarish");
    expect(data.learner.id).toBe("learner-1");
    expect(data.learner.goalStatement).toBe("Learn React");
    expect(data.learner.hoursPerWeek).toBe(10);
  });

  it("returns 400 when learnerId is missing", async () => {
    const res = await GET(makeRequest("http://localhost/api/onboarding/state"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("learnerId is required");
  });

  it("returns 404 when learner not found", async () => {
    mockDb.agentState.findUnique.mockResolvedValue(null);
    mockDb.learner.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost/api/onboarding/state?learnerId=missing"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Learner not found");
  });

  it("returns 404 when agent state not found", async () => {
    mockDb.agentState.findUnique.mockResolvedValue(null);
    mockDb.learner.findUnique.mockResolvedValue({ id: "learner-1" });

    const res = await GET(makeRequest("http://localhost/api/onboarding/state?learnerId=learner-1"));
    expect(res.status).toBe(404);
  });

  it("handles empty history and extracted JSON gracefully", async () => {
    mockDb.agentState.findUnique.mockResolvedValue({
      phase: "intro",
      roundsCompleted: 0,
      historyJson: "[]",
      extractedJson: "{}",
    });
    mockDb.learner.findUnique.mockResolvedValue({
      id: "learner-1",
      name: "Test",
      goalStatement: null,
      targetRole: null,
      domain: null,
      goalSkillId: null,
      hoursPerWeek: 10,
      timelineWeeks: null,
      learningStyle: null,
      motivation: null,
      onboardingStage: "intake",
    });

    const res = await GET(makeRequest("http://localhost/api/onboarding/state?learnerId=learner-1"));
    const data = await res.json();

    expect(data.phase).toBe("intro");
    expect(data.history).toEqual([]);
    expect(data.extracted).toEqual({});
    expect(data.learner.onboardingStage).toBe("intake");
  });

  it("returns 500 when db throws", async () => {
    mockDb.agentState.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost/api/onboarding/state?learnerId=learner-1"));
    expect(res.status).toBe(500);
  });
});
