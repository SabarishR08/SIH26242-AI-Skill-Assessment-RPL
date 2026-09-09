import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  learner: {
    create: vi.fn(),
  },
  agentState: {
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// ─── Tests ──────────────────────────────────────────────────────────────────

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/onboarding/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeEmptyBodyRequest(): Request {
  return new Request("http://localhost/api/onboarding/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/onboarding/start POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a learner with the provided name", async () => {
    mockDb.learner.create.mockResolvedValue({ id: "learner-1", name: "Sabarish" });
    mockDb.agentState.update.mockResolvedValue({});

    const res = await POST(makeRequest({ name: "Sabarish" }));
    const data = await res.json();

    expect(data.learnerId).toBe("learner-1");
    expect(data.name).toBe("Sabarish");
    expect(data.phase).toBe("intro");
    expect(data.greeting).toContain("Hey Sabarish");
    expect(data.greeting).toContain("Nexus");

    expect(mockDb.learner.create).toHaveBeenCalledTimes(1);
    const createCall = mockDb.learner.create.mock.calls[0][0];
    expect(createCall.data.name).toBe("Sabarish");
    expect(createCall.data.onboardingStage).toBe("interview");
  });

  it("uses 'Learner' as default name when empty body", async () => {
    mockDb.learner.create.mockResolvedValue({ id: "learner-2", name: "Learner" });
    mockDb.agentState.update.mockResolvedValue({});

    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(data.name).toBe("Learner");
    expect(data.greeting).not.toContain("Hey Learner"); // greeting omits "Learner" name
    expect(data.greeting).toContain("I'm Nexus");
  });

  it("truncates name to 60 characters", async () => {
    const longName = "A".repeat(100);
    mockDb.learner.create.mockImplementation((args: any) =>
      Promise.resolve({ id: "learner-3", name: args.data.name })
    );
    mockDb.agentState.update.mockResolvedValue({});

    const res = await POST(makeRequest({ name: longName }));
    const data = await res.json();

    expect(data.name.length).toBeLessThanOrEqual(60);
    const createCall = mockDb.learner.create.mock.calls[0][0];
    expect(createCall.data.name.length).toBeLessThanOrEqual(60);
  });

  it("persists the greeting in agent history", async () => {
    mockDb.learner.create.mockResolvedValue({ id: "learner-4", name: "Test" });
    mockDb.agentState.update.mockResolvedValue({});

    await POST(makeRequest({ name: "Test" }));

    expect(mockDb.agentState.update).toHaveBeenCalledTimes(1);
    const updateCall = mockDb.agentState.update.mock.calls[0][0];
    const history = JSON.parse(updateCall.data.historyJson);
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe("assistant");
    expect(history[0].content).toContain("Nexus");
  });

  it("handles invalid JSON gracefully with default name", async () => {
    mockDb.learner.create.mockResolvedValue({ id: "learner-5", name: "Learner" });
    mockDb.agentState.update.mockResolvedValue({});

    const req = new Request("http://localhost/api/onboarding/start", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.learnerId).toBe("learner-5");
    expect(data.name).toBe("Learner");
  });

  it("returns 500 when db create throws", async () => {
    mockDb.learner.create.mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(makeRequest({ name: "Test" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("DB connection failed");
  });
});
