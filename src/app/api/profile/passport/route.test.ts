import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

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

import { db } from "@/lib/db";

describe("GET /api/profile/passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when learnerId query param is missing", async () => {
    const req = new Request("http://localhost:3000/api/profile/passport");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("learnerId is required");
  });

  it("returns 404 when learner is not found", async () => {
    vi.mocked(db.learner.findUnique).mockResolvedValue(null as any);
    const req = new Request("http://localhost:3000/api/profile/passport?learnerId=nonexistent");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Learner not found");
  });

  it("returns passport with cryptographic hash, verified skills, and JSON-LD credential", async () => {
    vi.mocked(db.learner.findUnique).mockResolvedValue({
      id: "learner-1",
      name: "Alex",
      targetRole: "Full Stack Engineer",
      domain: "Engineering",
      goalSkillId: "wd_python",
      hoursPerWeek: 15,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      assessments: [
        {
          id: "a1",
          skillId: "py_core",
          skillName: "Python Core",
          claimedLevel: 3,
          evidencedLevel: 3,
          tier: "proven",
          notes: "GitHub repos verified",
          updatedAt: new Date("2026-01-10T00:00:00.000Z"),
          lastVerifiedAt: new Date("2026-01-10T00:00:00.000Z"),
        },
      ],
      evidence: [
        {
          id: "e1",
          source: "github",
          sourceRef: "alex/fastapi-app",
          summary: "Demonstrated idiomatic Python and FastAPI endpoints",
          skillClaims: JSON.stringify([{ skillId: "py_core", level: 3 }]),
          strength: 4,
          url: "https://github.com/alex/fastapi-app",
          createdAt: new Date("2026-01-05T00:00:00.000Z"),
        },
      ],
      quizzes: [
        {
          id: "q1",
          status: "passed",
          attempts: [{ passed: true, score: 0.9, createdAt: new Date() }],
        },
      ],
    } as any);

    vi.mocked(db.learningPath.findFirst).mockResolvedValue({
      id: "path-1",
      scenario: "balanced",
      milestones: [
        {
          id: "m1",
          project: {
            title: "Distributed Rate Limiter",
            submissions: [
              {
                id: "sub-1",
                repoUrl: "https://github.com/alex/rate-limiter",
                status: "passed",
                evaluationJson: JSON.stringify({ verdict: "passed", score: 92, strengths: ["Clean token bucket design"] }),
                submittedAt: new Date("2026-02-01T00:00:00.000Z"),
              },
            ],
          },
        },
      ],
    } as any);

    const req = new Request("http://localhost:3000/api/profile/passport?learnerId=learner-1");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.learner.name).toBe("Alex");
    expect(body.summary.passportId).toMatch(/^PF-PASS-[A-F0-9]{16}$/);
    expect(body.summary.totalVerifiedSkills).toBe(1);
    expect(body.summary.quizzesPassed).toBe(1);
    expect(body.summary.evaluationsCount).toBe(1);
    expect(body.verifiedSkills[0].skillName).toBe("Python Core");
    expect(body.evaluations[0].title).toBe("Distributed Rate Limiter");
    expect(body.jsonLdCredential["@context"]).toBeDefined();
    expect(body.jsonLdCredential.type).toContain("PathFinderSkillPassport");
    expect(body.jsonLdCredential.proof.verificationMethod).toBeDefined();
  });
});
