import { describe, expect, it } from "vitest";
import { strengthFor } from "./tagger";

describe("strengthFor", () => {
  const threshold = 0.9; // the trained model's operating point

  it("maps a barely-passing probability to a weak claim", () => {
    expect(strengthFor(threshold, threshold)).toBe(2);
  });

  it("maps a confident probability to the strongest claim", () => {
    expect(strengthFor(1, threshold)).toBe(5);
  });

  it("increases monotonically with probability", () => {
    const steps = [0.9, 0.93, 0.96, 0.99, 1].map((p) => strengthFor(p, threshold));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it("stays inside the 1-5 scale the evidence pipeline expects", () => {
    for (const p of [0, 0.5, 0.89, 0.9, 1]) {
      const s = strengthFor(p, threshold);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(5);
    }
  });

  it("handles a degenerate threshold of 1 without dividing by zero", () => {
    expect(Number.isFinite(strengthFor(1, 1))).toBe(true);
  });
});
