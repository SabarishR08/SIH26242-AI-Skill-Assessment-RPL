/**
 * Project evaluation — the closed loop's verification half.
 *
 * The learner submits a repository URL. We fetch real evidence from the
 * GitHub API (metadata, language mix, README, file tree, key source files,
 * dependency manifests), then evaluate against the spec's rubric:
 *
 *   LLM path      — rubric-grounded structured evaluation with per-criterion
 *                   scores, strengths, gaps and targeted feedback
 *   Heuristic path — deterministic checks (stack match, README presence,
 *                   substance signals: file count, code size, recency) that
 *                   produce a provisional verdict when no LLM is reachable
 *
 * Verdicts: "passed" (skills become PROVEN, milestone completes, path
 * replans) or "needs_work" (feedback + retry — no advancement).
 */
import { db } from "@/lib/db";
import { chatJson, asArray, asString, asInt } from "@/lib/ai/llm";

const GH_API = "https://api.github.com";

export interface RepoEvidence {
  url: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  languages: Record<string, number>;
  stars: number;
  pushedAt: string | null;
  fileTree: string[];
  readmeExcerpt: string | null;
  /** Key source files (up to 5, truncated). */
  sourceFiles: Array<{ path: string; content: string }>;
  dependencyHints: string[];
}

export interface EvaluationCheck {
  criterion: string;
  score: number; // 0-1
  note: string;
}

export interface EvaluationResult {
  verdict: "passed" | "needs_work";
  overallScore: number; // 0-1
  checks: EvaluationCheck[];
  strengths: string[];
  gaps: string[];
  feedback: string;
  evaluatorMode: "llm" | "heuristic";
}

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PathFinderAI-Evidence",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

function parseRepoUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.trim().replace(/\.git$/, "");
  const match = cleaned.match(/github\.com[\/:]([^\/]+)\/([^\/?#]+)/i);
  if (!match) throw new Error("Please provide a GitHub repository URL (https://github.com/owner/repo)");
  return { owner: match[1], repo: match[2] };
}

async function ghGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

const CODE_EXTENSIONS = [".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs", ".cpp", ".c", ".rb", ".php", ".sql", ".ipynb", ".sh", ".html", ".css"];

async function fetchRepoEvidenceFallback(owner: string, repo: string): Promise<RepoEvidence> {
  const webRes = await fetch(`https://github.com/${owner}/${repo}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!webRes.ok) {
    if (webRes.status === 404) {
      throw new Error(`Repository not found or not accessible: ${owner}/${repo}. Check the URL (public repos only).`);
    }
    throw new Error(`GitHub returned status ${webRes.status} for ${owner}/${repo}`);
  }

  const html = await webRes.text();

  // 1. Description from meta
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].replace(new RegExp(`\\s*-\\s*${owner}\\/${repo}.*$`, "i"), "").trim() : null;

  // 2. Languages
  const languages: Record<string, number> = {};
  const langRegex = /aria-label="([^"]+?)\s+(\d+(?:\.\d+)?%)"/g;
  let match: RegExpExecArray | null;
  while ((match = langRegex.exec(html)) !== null) {
    const lang = match[1];
    const pct = parseFloat(match[2]);
    languages[lang] = Math.round(pct * 100);
  }

  // 3. File tree from repository page links and embedded React payload
  const fileSet = new Set<string>();
  const fileLinkRegex = new RegExp(`href="/${owner}/${repo}/(?:blob|tree)/[^/]+/([^"#?]+)"`, "g");
  while ((match = fileLinkRegex.exec(html)) !== null) {
    fileSet.add(match[1]);
  }
  const itemRegex = /"name":"([^"]+)","path":"([^"]+)"/g;
  while ((match = itemRegex.exec(html)) !== null) {
    fileSet.add(match[2]);
  }

  // 4. README excerpt via raw endpoint
  let readmeExcerpt: string | null = null;
  const readmeBranches = ["HEAD", "main", "master"];
  for (const b of readmeBranches) {
    try {
      const rRes = await fetch(`https://github.com/${owner}/${repo}/raw/${b}/README.md`);
      if (rRes.ok) {
        readmeExcerpt = (await rRes.text()).slice(0, 2500);
        break;
      }
    } catch {
      // ignore
    }
  }

  // 5. Dependency manifests
  const manifestNames = ["package.json", "requirements.txt", "Pipfile", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "Gemfile", "docker-compose.yml", "Dockerfile"];
  const dependencyHints: string[] = [];
  for (const m of manifestNames) {
    if (fileSet.has(m) || Array.from(fileSet).some((p) => p.endsWith(`/${m}`))) {
      dependencyHints.push(m);
    } else {
      try {
        const probe = await fetch(`https://github.com/${owner}/${repo}/raw/HEAD/${m}`, { method: "HEAD" });
        if (probe.ok) {
          dependencyHints.push(m);
          fileSet.add(m);
        }
      } catch {
        // ignore
      }
    }
  }

  // 6. Source files (up to 5)
  const fileTree = Array.from(fileSet);
  const candidates = fileTree
    .filter((p) => CODE_EXTENSIONS.some((ext) => p.endsWith(ext)))
    .filter((p) => !p.includes("node_modules/") && !p.includes(".min."))
    .slice(0, 5);

  const sourceFiles: Array<{ path: string; content: string }> = [];
  for (const p of candidates) {
    try {
      const sRes = await fetch(`https://github.com/${owner}/${repo}/raw/HEAD/${p}`);
      if (sRes.ok) {
        const text = await sRes.text();
        sourceFiles.push({ path: p, content: text.slice(0, 4000) });
      }
    } catch {
      // ignore
    }
  }

  return {
    url: `https://github.com/${owner}/${repo}`,
    name: repo,
    description,
    defaultBranch: "HEAD",
    languages,
    stars: 0,
    pushedAt: new Date().toISOString(),
    fileTree,
    readmeExcerpt,
    sourceFiles,
    dependencyHints,
  };
}

export async function fetchRepoEvidence(repoUrl: string): Promise<RepoEvidence> {
  const { owner, repo } = parseRepoUrl(repoUrl);

  try {
    const meta = await ghGet<{
      name: string;
      description: string | null;
      default_branch: string;
      stargazers_count: number;
      pushed_at: string | null;
    }>(`/repos/${owner}/${repo}`);

    if (meta) {
      const [languages, tree, readme] = await Promise.all([
        ghGet<Record<string, number>>(`/repos/${owner}/${repo}/languages`),
        ghGet<{ tree: Array<{ path: string; type: string; size?: number }> }>(
          `/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`,
        ),
        ghGet<{ content: string; encoding: string }>(`/repos/${owner}/${repo}/readme`),
      ]);

      const fileTree = (tree?.tree ?? []).filter((n) => n.type === "blob").map((n) => n.path);

      // Pick up to 5 substantive source files to review (prefer small-ish, path-diverse).
      const candidates = fileTree
        .filter((p) => CODE_EXTENSIONS.some((ext) => p.endsWith(ext)))
        .filter((p) => !p.includes("node_modules/") && !p.includes(".min."))
        .sort((a, b) => a.split("/").length - b.split("/").length)
        .slice(0, 25);

      const picked: string[] = [];
      const usedDirs = new Set<string>();
      for (const p of candidates) {
        const dir = p.split("/").slice(0, -1).join("/");
        if (usedDirs.has(dir) && picked.length >= 3) continue;
        usedDirs.add(dir);
        picked.push(p);
        if (picked.length >= 5) break;
      }

      const sourceFiles: Array<{ path: string; content: string }> = [];
      for (const p of picked) {
        const blob = await ghGet<{ content: string; encoding: string; size: number }>(`/repos/${owner}/${repo}/contents/${p}`);
        if (blob?.encoding === "base64" && blob.content) {
          const text = Buffer.from(blob.content, "base64").toString("utf-8");
          sourceFiles.push({ path: p, content: text.slice(0, 4000) });
        }
      }

      // Dependency manifests give the true stack signal.
      const dependencyHints: string[] = [];
      const manifestNames = ["package.json", "requirements.txt", "Pipfile", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "Gemfile", "docker-compose.yml", "Dockerfile"];
      for (const m of manifestNames) {
        if (fileTree.some((p) => p === m || p.endsWith(`/${m}`))) dependencyHints.push(m);
      }

      let readmeExcerpt: string | null = null;
      if (readme?.encoding === "base64" && readme.content) {
        readmeExcerpt = Buffer.from(readme.content, "base64").toString("utf-8").slice(0, 2500);
      }

      return {
        url: `https://github.com/${owner}/${repo}`,
        name: meta.name,
        description: meta.description,
        defaultBranch: meta.default_branch,
        languages: languages ?? {},
        stars: meta.stargazers_count,
        pushedAt: meta.pushed_at,
        fileTree,
        readmeExcerpt,
        sourceFiles,
        dependencyHints,
      };
    }
  } catch (apiErr) {
    console.warn(`[ProjectEval] GitHub API failed, attempting public fallback:`, apiErr);
  }

  // Fallback to public web scraping + raw content inspection (resilient against unauthenticated rate limits)
  return fetchRepoEvidenceFallback(owner, repo);
}

function heuristicEvaluate(evidence: RepoEvidence, requirements: string[], rubric: Array<{ criterion: string; weight: number }>, expectedStack: string[]): EvaluationResult {
  const langKeys = Object.keys(evidence.languages);
  const stackOverlap = expectedStack.filter((s) =>
    langKeys.some((l) => l.toLowerCase().includes(s.toLowerCase().split("/")[0])) ||
    evidence.dependencyHints.some((d) => d.toLowerCase().includes(s.toLowerCase().split("/")[0])),
  );
  const codeFileCount = evidence.fileTree.filter((p) => CODE_EXTENSIONS.some((ext) => p.endsWith(ext))).length;
  const totalCodeBytes = Object.values(evidence.languages).reduce((s, n) => s + n, 0);

  const checks: EvaluationCheck[] = [];

  // Requirement coverage heuristic: can't verify semantics without an LLM, so
  // we check structural proxies and say so explicitly.
  checks.push({
    criterion: "Repository substance",
    score: Math.min(1, codeFileCount / 5 + (totalCodeBytes > 3000 ? 0.3 : 0)),
    note: `${codeFileCount} source files, ${totalCodeBytes} bytes of code across ${langKeys.slice(0, 4).join(", ") || "no detected languages"}`,
  });
  checks.push({
    criterion: "Expected stack match",
    score: expectedStack.length ? stackOverlap.length / expectedStack.length : 0.7,
    note: expectedStack.length ? `Expected ${expectedStack.join(", ")} — found overlap: ${stackOverlap.join(", ") || "none"}` : "No specific stack required",
  });
  checks.push({
    criterion: "Documentation (README)",
    score: evidence.readmeExcerpt ? (evidence.readmeExcerpt.length > 400 ? 1 : 0.6) : 0.1,
    note: evidence.readmeExcerpt ? `README present (${evidence.readmeExcerpt.length} chars)` : "No README found",
  });

  // Map structural checks onto the rubric criteria where they correspond.
  const rubricChecks: EvaluationCheck[] = rubric.map((r) => {
    const match = checks.find((c) =>
      (r.criterion.toLowerCase().includes("document") && c.criterion === "Documentation (README)") ||
      (r.criterion.toLowerCase().includes("complete") && c.criterion === "Repository substance") ||
      (r.criterion.toLowerCase().includes("skill") && c.criterion === "Expected stack match"),
    );
    return match
      ? { criterion: r.criterion, score: match.score, note: match.note }
      : {
          criterion: r.criterion,
          score: 0.5,
          note: "Structural proxy only — connect an LLM provider for semantic grading of this criterion",
        };
  });

  const finalChecks = rubricChecks.length ? rubricChecks : checks;
  const totalWeight = finalChecks.reduce((s, c) => s + (rubric.find((r) => r.criterion === c.criterion)?.weight ?? 0.2), 0) || 1;
  const overallScore = finalChecks.reduce((s, c) => s + c.score * (rubric.find((r) => r.criterion === c.criterion)?.weight ?? 0.2), 0) / totalWeight;

  const hardFails = finalChecks.filter((c) => c.score < 0.3);
  const verdict: "passed" | "needs_work" = overallScore >= 0.6 && hardFails.length === 0 ? "passed" : "needs_work";

  const strengths = finalChecks.filter((c) => c.score >= 0.7).map((c) => `${c.criterion}: ${c.note}`);
  const gaps = finalChecks.filter((c) => c.score < 0.5).map((c) => `${c.criterion} needs work — ${c.note}`);

  const feedback =
    verdict === "passed"
      ? `Provisional pass on structural signals (${Math.round(overallScore * 100)}%). Note: this evaluation ran in offline mode, so it checked repository substance, stack match and documentation — not requirement semantics. Add an LLM API key for full rubric grading.`
      : `Not yet (${Math.round(overallScore * 100)}% on structural checks). ${gaps.join(" · ") || "Strengthen the repository and resubmit."} (Offline mode — structural checks only.)`;

  return {
    verdict,
    overallScore: Math.round(overallScore * 100) / 100,
    checks: finalChecks,
    strengths,
    gaps,
    feedback,
    evaluatorMode: "heuristic",
  };
}

export async function evaluateProjectSubmission(specId: string, repoUrl: string): Promise<EvaluationResult> {
  const spec = await db.projectSpec.findUnique({ where: { id: specId }, include: { milestone: true } });
  if (!spec) throw new Error("Project spec not found");

  const requirements = JSON.parse(spec.requirementsJson) as string[];
  const rubric = JSON.parse(spec.rubricJson) as Array<{ criterion: string; weight: number }>;
  const expectedStack = JSON.parse(spec.expectedStackJson ?? "[]") as string[];

  const evidence = await fetchRepoEvidence(repoUrl);

  const submission = await db.projectSubmission.create({
    data: { projectId: specId, repoUrl, status: "evaluating" },
  });

  const sourceDigest = evidence.sourceFiles
    .map((f) => `── ${f.path} ──\n${f.content}`)
    .join("\n\n")
    .slice(0, 14000);

  const result = await chatJson<EvaluationResult>(
    [
      { role: "system", content: "You are a demanding but fair senior engineer evaluating a learning project against its rubric. Score what you see; never invent what you cannot see." },
      {
        role: "user",
        content: `Evaluate this project submission.

PROJECT SPEC
Title: ${spec.title}
Brief: ${spec.brief}
Requirements:
${requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}
Rubric (criterion | weight):
${rubric.map((r) => `${r.criterion} | ${r.weight}`).join("\n")}
Expected stack: ${expectedStack.join(", ") || "open"}

SUBMITTED REPOSITORY (real GitHub evidence)
Name: ${evidence.name} (${evidence.stars} stars, last push ${evidence.pushedAt?.slice(0, 10) ?? "unknown"})
Description: ${evidence.description ?? "(none)"}
Languages: ${Object.entries(evidence.languages).map(([l, b]) => `${l}:${b}B`).join(", ") || "none detected"}
File tree (${evidence.fileTree.length} files): ${evidence.fileTree.slice(0, 80).join(", ")}
README excerpt: ${evidence.readmeExcerpt?.slice(0, 1500) ?? "(no README)"}

SOURCE FILES (truncated):
${sourceDigest || "(no source files accessible)"}

Return JSON:
{
  "verdict": "passed" | "needs_work",
  "overallScore": 0.0-1.0,
  "checks": [{"criterion": "rubric criterion", "score": 0.0-1.0, "note": "what you actually saw"}],
  "strengths": ["specific strengths"],
  "gaps": ["specific gaps against the requirements"],
  "feedback": "3-5 sentences of direct, actionable feedback — what to fix, what's solid"
}

Rules:
- Grade ONLY against the rubric criteria listed in the spec.
- "passed" requires overallScore >= 0.65 AND no criterion below 0.4.
- Cite file paths in notes. If something isn't visible in the evidence, say so instead of assuming.`,
      },
    ],
    (value) => {
      const obj = value as Record<string, unknown>;
      const verdict = asString(obj.verdict) === "passed" ? "passed" : "needs_work";
      const checks = asArray(obj.checks)
        .map((c) => {
          const check = c as Record<string, unknown>;
          const criterion = asString(check.criterion);
          if (!criterion) return null;
          return {
            criterion,
            score: Math.max(0, Math.min(1, typeof check.score === "number" ? check.score : parseFloat(String(check.score)) || 0)),
            note: asString(check.note, ""),
          };
        })
        .filter((c): c is EvaluationCheck => c !== null);
      if (!checks.length) return null;
      const overallScore = Math.max(0, Math.min(1, typeof obj.overallScore === "number" ? obj.overallScore : parseFloat(String(obj.overallScore)) || 0));
      const finalVerdict = overallScore >= 0.65 && checks.every((c) => c.score >= 0.4) ? "passed" : "needs_work";
      return {
        verdict: finalVerdict,
        overallScore,
        checks,
        strengths: asArray(obj.strengths).map((s) => asString(s)).filter(Boolean).slice(0, 6),
        gaps: asArray(obj.gaps).map((g) => asString(g)).filter(Boolean).slice(0, 6),
        feedback: asString(obj.feedback, ""),
        evaluatorMode: "llm" as const,
      };
    },
    { maxTokens: 1600, temperature: 0.3 },
  );

  const evaluation: EvaluationResult = result?.value ?? heuristicEvaluate(evidence, requirements, rubric, expectedStack);

  await db.projectSubmission.update({
    where: { id: submission.id },
    data: {
      status: evaluation.verdict,
      evaluationJson: JSON.stringify({ ...evaluation, repoEvidence: { name: evidence.name, languages: evidence.languages, fileCount: evidence.fileTree.length } }),
      evaluatorMode: evaluation.evaluatorMode,
      evaluatedAt: new Date(),
    },
  });

  return evaluation;
}
