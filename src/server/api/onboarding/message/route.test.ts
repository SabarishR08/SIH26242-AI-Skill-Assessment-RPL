import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  learner: {
    findUnique: vi.fn(),
  },
  agentState: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockRunAgentStream = vi.hoisted(() => vi.fn());
const mockPersistAgentTurn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/onboarding/agent", () => ({
  runAgentStream: mockRunAgentStream,
  persistAgentTurn: mockPersistAgentTurn,
  PHASE_ORDER: ["intro", "goal", "background", "time", "style", "wrap_up", "done"],
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/onboarding/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/onboarding/message POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when learnerId is missing", async () => {
    const res = await POST(makeRequest({ message: "hello" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("learnerId and message are required");
  });

  it("returns 400 when message is empty", async () => {
    const res = await POST(makeRequest({ learnerId: "l1", message: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is whitespace only", async () => {
    const res = await POST(makeRequest({ learnerId: "l1", message: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when learner not found", async () => {
    mockDb.learner.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ learnerId: "missing", message: "hello" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Learner not found");
  });

  it("returns SSE response with delta and done events", async () => {
    mockDb.learner.findUnique.mockResolvedValue({ id: "l1", name: "Test" });
    mockRunAgentStream.mockResolvedValue({ fullReply: "I can help with that!" });
    mockPersistAgentTurn.mockResolvedValue({ phase: "intro", extracted: { name: "Test" }, roundsInPhase: 1 });

    const res = await POST(makeRequest({ learnerId: "l1", message: "I want to learn React" }));
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // First event should be delta
    const deltaEvent = JSON.parse(lines[0].slice(6));
    expect(deltaEvent.type).toBe("delta");
    expect(deltaEvent.text).toContain("I can help with that!");

    // Last event should be done
    const doneEvent = JSON.parse(lines[lines.length - 1].slice(6));
    expect(doneEvent.type).toBe("done");
    expect(doneEvent.reply).toContain("I can help with that!");
    expect(doneEvent.phase).toBe("intro");
  });

  it("advances phase when user sends skip", async () => {
    mockDb.learner.findUnique.mockResolvedValue({ id: "l1", name: "Test" });
    mockDb.agentState.findUnique.mockResolvedValue({ phase: "intro" });
    mockDb.agentState.update.mockResolvedValue({});
    mockRunAgentStream.mockResolvedValue({ fullReply: "OK, moving on." });
    mockPersistAgentTurn.mockResolvedValue({ phase: "goal", extracted: {}, roundsInPhase: 0 });

    const res = await POST(makeRequest({ learnerId: "l1", message: "skip" }));
    expect(res.status).toBe(200);

    // Phase should have been advanced
    expect(mockDb.agentState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phase: "goal" }),
      })
    );
  });

  it("does not advance phase when message does not contain skip", async () => {
    mockDb.learner.findUnique.mockResolvedValue({ id: "l1", name: "Test" });
    mockRunAgentStream.mockResolvedValue({ fullReply: "Tell me more about your goal." });
    mockPersistAgentTurn.mockResolvedValue({ phase: "intro", extracted: {}, roundsInPhase: 1 });

    await POST(makeRequest({ learnerId: "l1", message: "I want to learn React" }));

    // Phase update should NOT have been called for skip
    expect(mockDb.agentState.update).not.toHaveBeenCalled();
  });

  it("returns SSE error event when agent stream throws", async () => {
    mockDb.learner.findUnique.mockResolvedValue({ id: "l1", name: "Test" });
    mockRunAgentStream.mockRejectedValue(new Error("Groq API error"));

    const res = await POST(makeRequest({ learnerId: "l1", message: "hello" }));
    // Error is caught inside the SSE generator, not the outer try/catch
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    // Should have an error event in the stream
    const errorEvent = lines.map((l) => JSON.parse(l.slice(6))).find((e: any) => e.error);
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.error).toContain("Groq API error");
  });
});
