import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockDb = vi.hoisted(() => ({
  learner: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  learningPath: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true, remaining: 59, limit: 60, resetAt: Date.now() + 60000 }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));

describe("/api/profile/passport GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleLearner = {
    id: "cmttti8xv0043kk2bted581e4",
    name: "Jane Doe",
    targetRole: "Full Stack Engineer",
    domain: "Web Development",
    goalSkillId: "react",
    hoursPerWeek: 12,
    createdAt: new Date("2026-01-01"),
    passportId: "PF-PASS-1234567812345678",
    passportShareToken: "PF-SHARE-D0DB760822097871",
    assessments: [
      {
        skillId: "react",
        skillName: "React",
        claimedLevel: 4,
        evidencedLevel: 4,
        tier: "proven",
        lastVerifiedAt: new Date("2026-02-01"),
        updatedAt: new Date("2026-02-01"),
      },
      {
        skillId: "docker",
        skillName: "Docker",
        claimedLevel: 3,
        evidencedLevel: 0,
        tier: "claimed",
        lastVerifiedAt: null,
        updatedAt: new Date("2026-02-01"),
      },
    ],
    evidence: [],
    quizzes: [],
  };

  it("returns learner.id and shareToken when accessed by owner learnerId", async () => {
    mockDb.learner.findFirst.mockResolvedValue(sampleLearner);

    const req = new Request("http://localhost/api/profile/passport?learnerId=cmttti8xv0043kk2bted581e4");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.learner.id).toBe("cmttti8xv0043kk2bted581e4");
    expect(data.summary.shareToken).toBeDefined();
    expect(data.verifiedSkills).toHaveLength(1);
    expect(data.selfReportedSkills).toHaveLength(1);
  });

  it("omits learner.id and summary.shareToken when accessed by shareToken (NEW-02)", async () => {
    mockDb.learner.findFirst.mockResolvedValue(sampleLearner);

    const req = new Request("http://localhost/api/profile/passport?shareToken=PF-SHARE-D0DB760822097871");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    // learner.id MUST be undefined to prevent privilege escalation / write access
    expect(data.learner.id).toBeUndefined();
    // summary.shareToken MUST be undefined in the response
    expect(data.summary.shareToken).toBeUndefined();
    // Credential details remain verifiable
    expect(data.summary.passportId).toBeDefined();
    expect(data.jsonLdCredential).toBeDefined();
  });

  it("omits learner.id when passport query param contains share token", async () => {
    mockDb.learner.findFirst.mockResolvedValue(sampleLearner);

    const req = new Request("http://localhost/api/profile/passport?passport=PF-SHARE-D0DB760822097871");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.learner.id).toBeUndefined();
    expect(data.summary.shareToken).toBeUndefined();
  });
});
