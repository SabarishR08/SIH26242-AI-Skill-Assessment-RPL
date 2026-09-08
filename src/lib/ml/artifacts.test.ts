import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadCourseSkillMappingV2,
  loadMlManifest,
  loadSkillNeighbors,
  loadVouchedCoursesForSkill,
  mlArtifactsAvailable,
  mlDir,
  resetMlCache,
} from "./artifacts";

describe("ml artifacts loader", () => {
  let dir: string;
  const prev = process.env.PATHFINDER_ML_DIR;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "pf-ml-"));
    process.env.PATHFINDER_ML_DIR = dir;
    resetMlCache();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.PATHFINDER_ML_DIR;
    else process.env.PATHFINDER_ML_DIR = prev;
    resetMlCache();
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null for every artefact when nothing has been trained", async () => {
    expect(mlDir()).toBe(dir);
    expect(await loadMlManifest()).toBeNull();
    expect(await loadCourseSkillMappingV2()).toBeNull();
    expect(await loadSkillNeighbors()).toBeNull();
    expect(await mlArtifactsAvailable()).toBe(false);
  });

  it("reads artefacts dropped into the directory and caches them", async () => {
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ schema: "pathfinder-ml-output/1", run: { run_id: "x", started_at: "", finished_at: null, smoke: true } }));
    writeFileSync(path.join(dir, "course_skill_mapping.v2.json"), JSON.stringify({ C0001: ["ds_python", "rag_python"] }));
    expect(await mlArtifactsAvailable()).toBe(true);
    const mapping = await loadCourseSkillMappingV2();
    expect(mapping?.C0001).toEqual(["ds_python", "rag_python"]);

    // cached: replacing the file on disk is not visible until reset
    writeFileSync(path.join(dir, "course_skill_mapping.v2.json"), JSON.stringify({ C0001: ["ds_python"] }));
    expect((await loadCourseSkillMappingV2())?.C0001).toHaveLength(2);
    resetMlCache();
    expect((await loadCourseSkillMappingV2())?.C0001).toHaveLength(1);
  });

  it("treats malformed files as absent", async () => {
    writeFileSync(path.join(dir, "skill_neighbors.json"), "{not json");
    expect(await loadSkillNeighbors()).toBeNull();
  });

  describe("vouched courses", () => {
    it("is null without a trained run, so callers keep the static mapping", async () => {
      expect(await loadVouchedCoursesForSkill()).toBeNull();
    });

    it("keeps existing pairs, keeps semantic pairs above threshold, drops low-score filler", async () => {
      writeFileSync(
        path.join(dir, "skill_course_scores.v2.json"),
        JSON.stringify({
          // A real skill: hand-mapped course kept regardless of score, plus a
          // confident semantic match.
          ds_python: [
            { courseId: "C_SEM", score: 0.81, source: "semantic" },
            { courseId: "C_OLD", score: 0.2, source: "existing" },
          ],
          // An AI-domain skill the catalogue has nothing for: only filler.
          pe_prompt_fundamentals: [
            { courseId: "C_JUNK", score: 0.36, source: "fallback" },
            { courseId: "C_JUNK2", score: 0.33, source: "fallback" },
          ],
        }),
      );
      const vouched = await loadVouchedCoursesForSkill();
      // best score first, low-confidence hand-mapped row still retained
      expect(vouched?.ds_python).toEqual(["C_SEM", "C_OLD"]);
      // nothing is better than a bad recommendation — skill falls through to
      // its free resources instead
      expect(vouched?.pe_prompt_fundamentals).toBeUndefined();
    });

    it("honours a custom threshold", async () => {
      writeFileSync(
        path.join(dir, "skill_course_scores.v2.json"),
        JSON.stringify({ ds_python: [{ courseId: "C1", score: 0.4, source: "semantic" }] }),
      );
      expect((await loadVouchedCoursesForSkill())?.ds_python).toBeUndefined();
      resetMlCache();
      expect((await loadVouchedCoursesForSkill(0.3))?.ds_python).toEqual(["C1"]);
    });
  });
});
