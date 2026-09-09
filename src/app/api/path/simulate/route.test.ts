import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  db: {
    learner: {
      findUnique: vi.fn(),
    },
    learningPath: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/path/generate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/path/generate")>();
  return {
    ...actual,
    knownSkillIdsFor: vi.fn().mockResolvedValue({ known: [], levels: {} }),
  };
});

import { db } from "@/lib/db";

describe("POST /api/path/simulate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if learnerId is missing", async () => {
    const req = new Request("http://localhost:3000/api/path/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("learnerId is required");
  });

  it("returns 404 if learner is not found", async () => {
    vi.mocked(db.learner.findUnique).mockResolvedValue(null as any);
    const req = new Request("http://localhost:3000/api/path/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId: "nonexistent" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns simulated scenario and diff without modifying database", async () => {
    vi.mocked(db.learner.findUnique).mockResolvedValue({
      id: "learner-1",
      goalSkillId: "wd_python",
      hoursPerWeek: 10,
    } as any);

    vi.mocked(db.learningPath.findFirst).mockResolvedValue({
      id: "path-1",
      scenario: "balanced",
      hoursPerWeek: 10,
      totalHours: 40,
      milestones: [
        {
          order: 1,
          phase: "1. Foundations",
          title: "Python Core",
          estimatedHours: 12,
          status: "in_progress",
          targetEndAt: new Date("2026-03-01"),
        },
      ],
    } as any);

    const req = new Request("http://localhost:3000/api/path/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnerId: "learner-1",
        scenario: "intensive",
        hoursPerWeek: 20,
        simulateFailure: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.simulation).toBeDefined();
    expect(body.simulation.scenario).toBe("intensive");
    expect(body.simulation.hoursPerWeek).toBe(20);
    expect(body.simulation.milestones.length).toBeGreaterThan(0);
    expect(body.simulation.diff).toBeDefined();
    expect(body.current).toBeDefined();
    expect(body.current.scenario).toBe("balanced");
  });
});
