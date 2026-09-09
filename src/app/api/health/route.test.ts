import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  learner: {
    count: vi.fn().mockResolvedValue(5),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockEngineData = vi.hoisted(() => ({
  graph: {
    skills: { js: { id: "js" }, react: { id: "react" } },
  },
  catalogue: {
    courses: [{ course_id: "c1" }, { course_id: "c2" }],
  },
  resources: {
    resources: [{ resource_id: "r1" }],
  },
}));

vi.mock("@/lib/engine/data", () => ({
  loadEngineData: vi.fn().mockResolvedValue(mockEngineData),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

import { GET } from "./route";

describe("/api/health GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.learner.count.mockResolvedValue(5);
  });

  it("returns status ok with connected db", async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.status).toBe("ok");
    expect(data.service).toBe("PathFinder AI");
    expect(data.db).toBe("connected");
    expect(data.time).toBeDefined();
  });

  it("reports catalogue stats from engine data", async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.catalogue.courses).toBe(2);
    expect(data.catalogue.skills).toBe(2);
    expect(data.catalogue.resources).toBe(1);
  });

  it("reports db as unavailable when count throws", async () => {
    mockDb.learner.count.mockRejectedValue(new Error("Connection refused"));
    const res = await GET();
    const data = await res.json();

    expect(data.db).toBe("unavailable");
    expect(data.status).toBe("ok");
  });

  it("reports fallback llm when no API keys set", async () => {
    const origGateway = process.env.AI_GATEWAY_API_KEY;
    const origGroq = process.env.GROQ_API_KEY;
    const origOpenai = process.env.OPENAI_API_KEY;
    const origNvidia = process.env.NVIDIA_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.NVIDIA_API_KEY;

    // Reset env-check cache so it re-evaluates
    const { resetEnvCache } = await import("@/lib/env-check");
    resetEnvCache();

    const res = await GET();
    const data = await res.json();

    expect(data.llm).toBe("zai-sdk-or-fallback");

    // Restore
    if (origGateway) process.env.AI_GATEWAY_API_KEY = origGateway;
    if (origGroq) process.env.GROQ_API_KEY = origGroq;
    if (origOpenai) process.env.OPENAI_API_KEY = origOpenai;
    if (origNvidia) process.env.NVIDIA_API_KEY = origNvidia;
    resetEnvCache();
  });

  it("reports fallback when engine data fails to load", async () => {
    const { loadEngineData } = await import("@/lib/engine/data");
    (loadEngineData as any).mockRejectedValueOnce(new Error("File not found"));

    const res = await GET();
    const data = await res.json();

    expect(data.status).toBe("ok");
    expect(data.catalogue).toEqual({ courses: 0, skills: 0, resources: 0 });
  });
});
