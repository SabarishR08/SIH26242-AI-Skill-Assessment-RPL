import { describe, it, expect, vi, beforeEach } from "vitest";

function getFetchMock() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  agentState: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  learner: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  skillAssessment: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockLoadSkillGraph = vi.hoisted(() => vi.fn());
vi.mock("@/lib/engine/data", () => ({ loadSkillGraph: mockLoadSkillGraph }));

const mockFuseEvidence = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockLogEvidence = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/evidence/fuse", () => ({
  fuseEvidence: mockFuseEvidence,
  logEvidence: mockLogEvidence,
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FAKE_GRAPH = {
  skills: {
    js: { id: "js", name: "JavaScript", domain: "web", prereqs: [] },
    react: { id: "react", name: "React", domain: "web", prereqs: ["js"] },
    python: { id: "python", name: "Python", domain: "data", prereqs: [] },
  },
  domains: ["web", "data"],
  byDomain: {
    web: [
      { id: "js", name: "JavaScript" },
      { id: "react", name: "React" },
    ],
    data: [{ id: "python", name: "Python" }],
  },
};

function makeAgentState(overrides: Record<string, unknown> = {}) {
  return {
    learnerId: "learner-1",
    phase: "intro",
    historyJson: JSON.stringify([]),
    extractedJson: JSON.stringify({ name: "Alice" }),
    roundsCompleted: 0,
    ...overrides,
  };
}

function makeLearner(overrides: Record<string, unknown> = {}) {
  return {
    id: "learner-1",
    name: "Alice",
    goalStatement: null,
    targetRole: null,
    domain: null,
    goalSkillId: null,
    hoursPerWeek: 10,
    timelineWeeks: null,
    learningStyle: null,
    motivation: null,
    constraintsJson: null,
    onboardingStage: "interview",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("persistAgentTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSkillGraph.mockResolvedValue(FAKE_GRAPH);
  });

  it("appends user and assistant messages to history", async () => {
    const { persistAgentTurn } = await import("./agent");
    const state = makeAgentState();
    mockDb.agentState.findUnique.mockResolvedValue(state);

    await persistAgentTurn("learner-1", "I want to learn React", "Great choice!", {}, false);

    const updateCall = mockDb.agentState.update.mock.calls[0][0];
    const history = JSON.parse(updateCall.data.historyJson);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: "user", content: "I want to learn React" });
    expect(history[1]).toEqual({ role: "assistant", content: "Great choice!" });
  });

  it("merges extracted profile fields", async () => {
    const { persistAgentTurn } = await import("./agent");
    const state = makeAgentState({
      extractedJson: JSON.stringify({ name: "Alice", domain: "web" }),
    });
    mockDb.agentState.findUnique.mockResolvedValue(state);

    const result = await persistAgentTurn(
      "learner-1",
      "cybersecurity",
      "Got it",
      { goalStatement: "Become a pentester", domain: "cybersecurity", hoursPerWeek: 15 },
      false,
    );

    expect(result.extracted.goalStatement).toBe("Become a pentester");
    expect(result.extracted.domain).toBe("cybersecurity");
    expect(result.extracted.hoursPerWeek).toBe(15);
    // Original name preserved
    expect(result.extracted.name).toBe("Alice");
  });

  it("deduplicates constraints", async () => {
    const { persistAgentTurn } = await import("./agent");
    const state = makeAgentState({
      extractedJson: JSON.stringify({ name: "Alice", constraints: ["budget", "time"] }),
    });
    mockDb.agentState.findUnique.mockResolvedValue(state);

    const result = await persistAgentTurn(
      "learner-1",
      "also limited time",
      "Noted",
      { constraints: ["time", "exams"] },
      false,
    );

    expect(result.extracted.constraints).toContain("budget");
    expect(result.extracted.constraints).toContain("time");
    expect(result.extracted.constraints).toContain("exams");
    expect(result.extracted.constraints).toHaveLength(3);
  });

  it("caps constraints at 10", async () => {
    const { persistAgentTurn } = await import("./agent");
    const existing = Array.from({ length: 8 }, (_, i) => `constraint-${i}`);
    const state = makeAgentState({
      extractedJson: JSON.stringify({ name: "Alice", constraints: existing }),
    });
    mockDb.agentState.findUnique.mockResolvedValue(state);

    const result = await persistAgentTurn(
      "learner-1",
      "more limits",
      "OK",
      { constraints: ["new-1", "new-2", "new-3"] },
      false,
    );

    expect(result.extracted.constraints!.length).toBeLessThanOrEqual(10);
  });

  it("updates timelineWeeks only when positive", async () => {
    const { persistAgentTurn } = await import("./agent");
    const state = makeAgentState({
      extractedJson: JSON.stringify({ name: "Alice", timelineWeeks: 12 }),
    });
    mockDb.agentState.findUnique.mockResolvedValue(state);

    const result = await persistAgentTurn(
      "learner-1",
      "6 months",
      "Got it",
      { timelineWeeks: 0 },
      false,
    );

    // 0 should not override existing 12
    expect(result.extracted.timelineWeeks).toBe(12);
  });

  it("resets roundsCompleted when wantsSkip is true", async () => {
    const { persistAgentTurn } = await import("./agent");
    const state = makeAgentState({ roundsCompleted: 5 });
    mockDb.agentState.findUnique.mockResolvedValue(state);

    await persistAgentTurn("learner-1", "skip", "Moving on", {}, true);

    const updateCall = mockDb.agentState.update.mock.calls[0][0];
    expect(updateCall.data.roundsCompleted).toBe(0);
  });

  it("increments roundsCompleted when not skipping", async () => {
    const { persistAgentTurn } = await import("./agent");
    const state = makeAgentState({ roundsCompleted: 3 });
    mockDb.agentState.findUnique.mockResolvedValue(state);

    await persistAgentTurn("learner-1", "answer", "Reply", {}, false);

    const updateCall = mockDb.agentState.update.mock.calls[0][0];
    expect(updateCall.data.roundsCompleted).toBe(4);
  });

  it("maps phase to correct onboardingStage", async () => {
    const { persistAgentTurn } = await import("./agent");

    const cases: Array<[string, string]> = [
      ["intro", "interview"],
      ["goal", "interview"],
      ["background", "interview"],
      ["wrap_up", "evidence"],
      ["done", "evidence"],
    ];

    for (const [phase, expectedStage] of cases) {
      vi.clearAllMocks();
      mockDb.agentState.findUnique.mockResolvedValue(makeAgentState({ phase }));

      await persistAgentTurn("learner-1", "msg", "reply", {}, false);

      const learnerUpdate = mockDb.learner.update.mock.calls[0]?.[0];
      if (learnerUpdate) {
        expect(learnerUpdate.data.onboardingStage).toBe(expectedStage);
      }
    }
  });

  it("truncates assistant reply to 2000 chars in history", async () => {
    const { persistAgentTurn } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(makeAgentState());

    const longReply = "x".repeat(3000);
    await persistAgentTurn("learner-1", "q", longReply, {}, false);

    const history = JSON.parse(mockDb.agentState.update.mock.calls[0][0].data.historyJson);
    expect(history[1].content).toHaveLength(2000);
  });

  it("throws when agent state not found", async () => {
    const { persistAgentTurn } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(null);

    await expect(
      persistAgentTurn("nonexistent", "msg", "reply", {}, false),
    ).rejects.toThrow("Agent state not found");
  });

  it("updates learner record with extracted profile data", async () => {
    const { persistAgentTurn } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(makeAgentState());

    await persistAgentTurn(
      "learner-1",
      "my goal is cybersecurity",
      "Got it",
      { goalStatement: "Become a SOC analyst", domain: "cybersecurity", hoursPerWeek: 20 },
      false,
    );

    const learnerUpdate = mockDb.learner.update.mock.calls[0]?.[0];
    expect(learnerUpdate).toBeDefined();
    expect(learnerUpdate.data.goalStatement).toBe("Become a SOC analyst");
    expect(learnerUpdate.data.domain).toBe("cybersecurity");
    expect(learnerUpdate.data.hoursPerWeek).toBe(20);
  });
});

describe("runAgentStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSkillGraph.mockResolvedValue(FAKE_GRAPH);
  });

  it("throws when learner or state not found", async () => {
    const { runAgentStream } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(null);
    mockDb.learner.findUnique.mockResolvedValue(null);

    await expect(runAgentStream("learner-1", "hi")).rejects.toThrow(
      "Learner or agent state not found",
    );
  });

  it("calls Groq API with correct messages", async () => {
    const { runAgentStream } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(
      makeAgentState({ historyJson: JSON.stringify([{ role: "assistant", content: "Hello!" }]) }),
    );
    mockDb.learner.findUnique.mockResolvedValue(makeLearner());

    const mockReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi!"}}]}\n\ndata: [DONE]\n'),
        );
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockReadable,
    });

    const result = await runAgentStream("learner-1", "What's up?");

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const fetchBody = JSON.parse(getFetchMock().mock.calls[0][1]!.body as string);
    expect(fetchBody.messages[0].role).toBe("system");
    expect(fetchBody.messages[1].role).toBe("assistant");
    expect(fetchBody.messages[2].role).toBe("user");
    expect(fetchBody.messages[2].content).toBe("What's up?");
    expect(result.fullReply).toBe("Hi!");
  });

  it("routes through Vercel AI Gateway when AI_GATEWAY_API_KEY is set", async () => {
    const { runAgentStream } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(makeAgentState());
    mockDb.learner.findUnique.mockResolvedValue(makeLearner());

    const origKey = process.env.AI_GATEWAY_API_KEY;
    process.env.AI_GATEWAY_API_KEY = "gw_test_key";

    const mockReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n'));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockReadable });

    await runAgentStream("learner-1", "test");

    const fetchUrl = getFetchMock().mock.calls[0][0];
    expect(fetchUrl).toContain("ai-gateway.vercel.sh");
    expect(fetchUrl).toContain("chat/completions");

    const fetchBody = JSON.parse(getFetchMock().mock.calls[0][1]!.body as string);
    expect(fetchBody.model).toBe("groq/openai/gpt-oss-120b");

    process.env.AI_GATEWAY_API_KEY = origKey;
  });

  it("routes directly to Groq when no gateway key", async () => {
    const { runAgentStream } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(makeAgentState());
    mockDb.learner.findUnique.mockResolvedValue(makeLearner());

    const origGateway = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;

    const mockReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n'));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockReadable });

    await runAgentStream("learner-1", "test");

    const fetchUrl = getFetchMock().mock.calls[0][0];
    expect(fetchUrl).toContain("api.groq.com");

    process.env.AI_GATEWAY_API_KEY = origGateway;
  });

  it("assembles full reply from multiple SSE chunks", async () => {
    const { runAgentStream } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(makeAgentState());
    mockDb.learner.findUnique.mockResolvedValue(makeLearner());

    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
      "data: [DONE]\n",
    ].join("");

    const mockReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(chunks));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockReadable });

    const result = await runAgentStream("learner-1", "hi");
    expect(result.fullReply).toBe("Hello world!");
  });

  it("throws on non-ok API response", async () => {
    const { runAgentStream } = await import("./agent");
    mockDb.agentState.findUnique.mockResolvedValue(makeAgentState());
    mockDb.learner.findUnique.mockResolvedValue(makeLearner());

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });

    await expect(runAgentStream("learner-1", "hi")).rejects.toThrow("LLM API error 429");
  });
});
