import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dot, embed, embedOne, encoderAvailable, resetEncoder } from "./encoder";

/**
 * The encoder is optional (34 MB, git-ignored). What must hold in every
 * environment is that its absence is handled — every caller treats null as
 * "fall back", so these tests pin the degradation path rather than the model.
 */
describe("encoder", () => {
  const prevDir = process.env.PATHFINDER_ENCODER_DIR;
  const prevOff = process.env.PATHFINDER_ENCODER;

  beforeEach(() => resetEncoder());

  afterEach(() => {
    if (prevDir === undefined) delete process.env.PATHFINDER_ENCODER_DIR;
    else process.env.PATHFINDER_ENCODER_DIR = prevDir;
    if (prevOff === undefined) delete process.env.PATHFINDER_ENCODER;
    else process.env.PATHFINDER_ENCODER = prevOff;
    resetEncoder();
  });

  it("reports unavailable when no model is installed", async () => {
    process.env.PATHFINDER_ENCODER_DIR = "/nonexistent/encoder";
    expect(await encoderAvailable()).toBe(false);
  });

  it("returns null rather than throwing when unavailable", async () => {
    process.env.PATHFINDER_ENCODER_DIR = "/nonexistent/encoder";
    expect(await embed(["anything"])).toBeNull();
    expect(await embedOne("anything")).toBeNull();
  });

  it("can be switched off explicitly even when installed", async () => {
    process.env.PATHFINDER_ENCODER = "off";
    expect(await encoderAvailable()).toBe(false);
  });

  it("short-circuits empty input without loading the model", async () => {
    process.env.PATHFINDER_ENCODER_DIR = "/nonexistent/encoder";
    expect(await embed([])).toEqual([]);
  });

  describe("dot", () => {
    it("is cosine similarity for normalised vectors", () => {
      expect(dot([1, 0, 0], [1, 0, 0])).toBe(1);
      expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
      expect(dot([0.6, 0.8], [0.6, 0.8])).toBeCloseTo(1, 6);
    });

    it("does not overrun the shorter vector", () => {
      expect(dot([1, 1], [1, 1, 1])).toBe(2);
    });
  });
});
