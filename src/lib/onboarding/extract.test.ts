import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractProfile } from "./extract";

const mockDb = vi.hoisted(() => ({
  agentState: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

describe("extractProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts hours, timeline, role, and domain from conversation history", async () => {
    mockDb.agentState.findUnique.mockResolvedValue({
      learnerId: "l-test-1",
      historyJson: JSON.stringify([
        { role: "assistant", content: "What is your primary goal?" },
        { role: "user", content: "I want to become a data scientist in six months, studying 12 hours a week." },
        { role: "assistant", content: "What is your current background?" },
        { role: "user", content: "I have some experience with basic Python and statistics." },
      ]),
    });

    const profile = await extractProfile("l-test-1");

    expect(profile.hoursPerWeek).toBe(12);
    // 6 months is ~24-26 weeks
    expect(profile.timelineWeeks).toBeGreaterThanOrEqual(24);
    expect(profile.domain).toBe("Data Science");
    expect(profile.goalSkillId).toBe("ds_datascience");
  });

  it("extracts web development goals and numbers cleanly", async () => {
    mockDb.agentState.findUnique.mockResolvedValue({
      learnerId: "l-test-2",
      historyJson: JSON.stringify([
        { role: "assistant", content: "What do you want to build?" },
        { role: "user", content: "I want to master React and full stack web development in 16 weeks, 15 hours a week." },
      ]),
    });

    const profile = await extractProfile("l-test-2");

    expect(profile.hoursPerWeek).toBe(15);
    expect(profile.timelineWeeks).toBe(16);
    expect(profile.domain).toBe("Web Development");
  });
});
