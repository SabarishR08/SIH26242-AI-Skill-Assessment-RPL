import { describe, expect, it } from "vitest";
import { EQUIVALENCE_CONFIDENCE_DISCOUNT, mergeEquivalent } from "./fuse";

const proven = { claimedLevel: 0, evidencedLevel: 4, tier: "proven", confidence: 0.9 };

describe("equivalent-skill transfer", () => {
  it("creates the twin when it has no assessment yet, at a discounted confidence", () => {
    const merged = mergeEquivalent(proven, null);
    expect(merged).toEqual({
      claimedLevel: 0,
      evidencedLevel: 4,
      tier: "proven",
      confidence: 0.9 * EQUIVALENCE_CONFIDENCE_DISCOUNT,
    });
  });

  it("never lowers a twin that already has stronger direct evidence", () => {
    const stronger = { claimedLevel: 3, evidencedLevel: 5, tier: "proven", confidence: 0.95 };
    expect(mergeEquivalent(proven, stronger)).toBeNull();
  });

  it("raises a weaker twin without discarding its own claimed level", () => {
    const weaker = { claimedLevel: 5, evidencedLevel: 1, tier: "claimed", confidence: 0.4 };
    const merged = mergeEquivalent(proven, weaker);
    expect(merged).toMatchObject({ claimedLevel: 5, evidencedLevel: 4, tier: "proven" });
    expect(merged!.confidence).toBeCloseTo(0.81, 5);
  });

  it("keeps the stronger tier when levels are equal", () => {
    const verified = { claimedLevel: 0, evidencedLevel: 4, tier: "verified", confidence: 0.8 };
    // proven (rank 4) beats verified (rank 3)
    expect(mergeEquivalent(proven, verified)?.tier).toBe("proven");
    // ...and a weaker source never demotes a proven twin
    expect(mergeEquivalent(verified, proven)).toBeNull();
  });

  it("does nothing for an empty source", () => {
    expect(mergeEquivalent({ claimedLevel: 0, evidencedLevel: 0, tier: "none", confidence: 0.1 }, null)).toBeNull();
  });

  it("caps confidence at the same ceiling the fusion code uses", () => {
    const merged = mergeEquivalent({ ...proven, confidence: 1 }, null);
    expect(merged!.confidence).toBeLessThanOrEqual(0.97);
  });
});
