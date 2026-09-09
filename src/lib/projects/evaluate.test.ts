import { describe, it, expect, vi } from "vitest";
import { fetchRepoEvidence } from "./evaluate";

describe("fetchRepoEvidence", () => {
  it("successfully parses valid GitHub URL and falls back if API rate-limited", async () => {
    // Test with public repository
    const evidence = await fetchRepoEvidence("https://github.com/SabarishR08/PathFinder-ai");
    expect(evidence.url).toBe("https://github.com/SabarishR08/PathFinder-ai");
    expect(evidence.name).toBeDefined();
    expect(Array.isArray(evidence.fileTree)).toBe(true);
    expect(evidence.fileTree.length).toBeGreaterThan(0);
    expect(evidence.readmeExcerpt).toBeTruthy();
    expect(evidence.dependencyHints).toContain("package.json");
  }, 20000);

  it("throws clear error for nonexistent repository", async () => {
    await expect(
      fetchRepoEvidence("https://github.com/SabarishR08/this-repo-does-not-exist-at-all-xyz123")
    ).rejects.toThrow(/Repository not found or not accessible/);
  }, 10000);
});
