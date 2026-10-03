import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRepoEvidence } from "./evaluate";

// These tests exercise fetchRepoEvidence's parsing logic. They mock `fetch`
// rather than hitting github.com: a unit test must not depend on a live
// repository name (renames break it), on anonymous API rate limits (shared CI
// runners flake), or on network availability.
const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

function textResponse(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body } as unknown as Response;
}

describe("fetchRepoEvidence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses repository evidence from the GitHub API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("/languages")) {
          return jsonResponse({ TypeScript: 4096, CSS: 512 });
        }
        if (url.includes("/git/trees/")) {
          return jsonResponse({
            tree: [
              { path: "package.json", type: "blob" },
              { path: "README.md", type: "blob" },
              { path: "src/app/viva/page.tsx", type: "blob" },
              { path: "src/lib/rpl/qualification-packs.ts", type: "blob" },
              { path: "src", type: "tree" },
            ],
          });
        }
        if (url.endsWith("/readme")) {
          return jsonResponse({ content: b64("# PathFinder RPL\nAI-assisted assessment for RPL."), encoding: "base64" });
        }
        if (url.includes("/contents/")) {
          return jsonResponse({ content: b64("export const pass = true;\n"), encoding: "base64", size: 26 });
        }
        return jsonResponse({
          name: "SIH26242-AI-Skill-Assessment-RPL",
          description: "AI-Assisted Skill Assessment Tool for Recognition of Prior Learning",
          default_branch: "main",
          stargazers_count: 7,
          pushed_at: "2026-10-03T12:00:00Z",
        });
      }),
    );

    const evidence = await fetchRepoEvidence("https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL");

    expect(evidence.url).toBe("https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL");
    expect(evidence.name).toBe("SIH26242-AI-Skill-Assessment-RPL");
    expect(evidence.defaultBranch).toBe("main");
    expect(evidence.languages).toEqual({ TypeScript: 4096, CSS: 512 });
    // Only blobs become files — directories are filtered out.
    expect(Array.isArray(evidence.fileTree)).toBe(true);
    expect(evidence.fileTree).toContain("package.json");
    expect(evidence.fileTree).not.toContain("src");
    expect(evidence.readmeExcerpt).toContain("PathFinder RPL");
    expect(evidence.dependencyHints).toContain("package.json");
    expect(evidence.sourceFiles.length).toBeGreaterThan(0);
  });

  it("falls back to the public repository page when the API is unavailable", async () => {
    // Unauthenticated/rate-limited API returns 404 for the repo metadata, so the
    // function must fall back to scraping the public page.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.startsWith("https://api.github.com")) {
          return jsonResponse({ message: "Not Found" }, false, 404);
        }
        if (url.includes("/raw/HEAD/README.md")) {
          return textResponse("# PathFinder RPL\nFallback readme.");
        }
        if (url.includes("/raw/HEAD/package.json")) {
          return textResponse("{}", true);
        }
        if (url.includes("/raw/HEAD/src/")) {
          return textResponse("export const pass = true;\n");
        }
        if (url === "https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL") {
          return textResponse(
            '<html><head><meta name="description" content="AI-Assisted Skill Assessment Tool for Recognition of Prior Learning - SabarishR08/SIH26242-AI-Skill-Assessment-RPL">' +
              "</head><body>" +
              '<span aria-label="TypeScript 92.3%"></span>' +
              '<a href="/SabarishR08/SIH26242-AI-Skill-Assessment-RPL/blob/main/package.json"></a>' +
              '<a href="/SabarishR08/SIH26242-AI-Skill-Assessment-RPL/blob/main/src/lib/rpl/qualification-packs.ts"></a>' +
              "</body></html>",
          );
        }
        return textResponse("", false, 404);
      }),
    );

    const evidence = await fetchRepoEvidence("https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL");

    expect(evidence.name).toBe("SIH26242-AI-Skill-Assessment-RPL");
    expect(evidence.defaultBranch).toBe("HEAD");
    // Fallback path reports GitHub's own language percentages (one decimal).
    expect(evidence.languages).toEqual({ TypeScript: 92.3 });
    expect(evidence.fileTree).toContain("package.json");
    expect(evidence.readmeExcerpt).toContain("Fallback readme");
    expect(evidence.dependencyHints).toContain("package.json");
  });

  it("throws clear error for nonexistent repository", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Not Found" }, false, 404)),
    );

    await expect(
      fetchRepoEvidence("https://github.com/SabarishR08/this-repo-does-not-exist-at-all-xyz123"),
    ).rejects.toThrow(/Repository not found or not accessible/);
  });
});
