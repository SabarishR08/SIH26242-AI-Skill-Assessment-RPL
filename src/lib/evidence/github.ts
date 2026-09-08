/**
 * GitHub evidence ingestion.
 *
 * Two stages, both real:
 *
 *  1. fetchGithubProfile — REST ingestion (profile, repos, READMEs, language
 *     mix, activity recency). Works unauthenticated (60 req/h) — set
 *     GITHUB_TOKEN to raise to 5,000/h.
 *
 *  2. analyzeGithub — LLM structured extraction that maps the raw signals to
 *     skill-graph ids with per-skill quotes and strength. When no LLM is
 *     reachable, a deterministic language/topic/stat heuristic produces the
 *     same shape so the pipeline never breaks (honestly labelled `heuristic`).
 */
import { chatJson, asArray, asString, asInt } from "@/lib/ai/llm";
import { tagTexts } from "@/lib/ml/tagger";
import type { SkillGraph } from "@/lib/engine/types";

const GH_API = "https://api.github.com";

export interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  languages: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  topics: string[];
  pushedAt: string | null;
  sizeKb: number;
  url: string;
  readmeExcerpt: string | null;
}

export interface GithubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  followers: number;
  publicRepos: number;
  createdAt: string | null;
  recentPushMonths: number;
  repos: GithubRepo[];
  languageMix: Record<string, number>;
  totalStars: number;
  fetchedAt: string;
}

export interface SkillClaim {
  skillId: string;
  skillName: string;
  level: number; // 0-5 evidenced level
  quote: string; // what in the data supports this
  strength: number; // 1-5
}

export interface GithubAnalysis {
  archetype: string;
  summary: string;
  claims: SkillClaim[];
  mode: "llm" | "tagger" | "heuristic";
}

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PathFinderAI-Evidence",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function ghFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders() });
  if (res.status === 404) throw new Error("GitHub user not found");
  if (res.status === 403 || res.status === 429) {
    throw new Error("GitHub API rate limit reached — set GITHUB_TOKEN to raise the limit, or retry within the hour");
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return (await res.json()) as T;
}

interface RawRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  topics?: string[];
  pushed_at: string | null;
  size: number;
  html_url: string;
}

interface RawReadme {
  content: string;
  encoding: string;
}

function monthsSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30));
}

export async function fetchGithubProfile(username: string, maxRepos = 12): Promise<GithubProfile> {
  const user = await ghFetch<{
    login: string;
    name: string | null;
    bio: string | null;
    company: string | null;
    followers: number;
    public_repos: number;
    created_at: string | null;
  }>(`/users/${encodeURIComponent(username)}`);

  const rawRepos = await ghFetch<RawRepo[]>(
    `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`,
  );

  const nonForks = rawRepos.filter((r) => !r.fork);
  const ranked = [...nonForks]
    .sort((a, b) => b.stargazers_count - a.stargazers_count || (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, maxRepos);

  // README enrichment for the top 3 repos (by stars).
  const withReadme = await Promise.all(
    ranked.slice(0, 3).map(async (r) => {
      try {
        const readme = await ghFetch<RawReadme>(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(r.name)}/readme`);
        let text = "";
        if (readme.encoding === "base64" && readme.content) {
          text = Buffer.from(readme.content, "base64").toString("utf-8");
        }
        return { repo: r, excerpt: text.slice(0, 1200) };
      } catch {
        return { repo: r, excerpt: null };
      }
    }),
  );

  const repos: GithubRepo[] = ranked.map((r) => {
    const enriched = withReadme.find((w) => w.repo.name === r.name);
    return {
      name: r.name,
      description: r.description,
      language: r.language,
      languages: r.language ? [r.language] : [],
      stars: r.stargazers_count,
      forks: r.forks_count,
      isFork: r.fork,
      topics: r.topics ?? [],
      pushedAt: r.pushed_at,
      sizeKb: r.size,
      url: r.html_url,
      readmeExcerpt: enriched?.excerpt ?? null,
    };
  });

  const languageMix: Record<string, number> = {};
  for (const r of nonForks) {
    if (r.language) languageMix[r.language] = (languageMix[r.language] || 0) + 1;
  }

  const recentPushMonths = Math.min(...nonForks.map((r) => monthsSince(r.pushed_at)), 999);

  return {
    login: user.login,
    name: user.name,
    bio: user.bio,
    company: user.company,
    followers: user.followers,
    publicRepos: user.public_repos,
    createdAt: user.created_at,
    recentPushMonths: recentPushMonths === 999 ? 999 : recentPushMonths,
    repos,
    languageMix,
    totalStars: nonForks.reduce((s, r) => s + r.stargazers_count, 0),
    fetchedAt: new Date().toISOString(),
  };
}

/** Deterministic language/topic → skill mapping used when the LLM is unreachable. */
const LANGUAGE_SKILL_HINTS: Record<string, string[]> = {
  Python: ["ds_python", "ml_python"],
  JavaScript: ["wd_js", "wd_jsfrontend"],
  TypeScript: ["wd_js", "wd_ts"],
  HTML: ["wd_html"],
  CSS: ["wd_css"],
  Java: ["wd_java"],
  "C++": ["wd_algo", "wd_ds"],
  C: ["wd_algo"],
  Go: ["wd_golang"],
  Rust: ["wd_rust"],
  PHP: ["wd_php"],
  Ruby: ["wd_ruby"],
  Shell: ["cloud_devops", "cloud_linux"],
  Dockerfile: ["cloud_docker", "cloud_devops"],
  HCL: ["cloud_terraform"],
  Jupyter: ["ds_jupyter", "ds_python"],
  R: ["ds_rstudio"],
  SQL: ["ds_sql"],
};

function heuristicAnalysis(profile: GithubProfile, graph: SkillGraph): GithubAnalysis {
  const claims: SkillClaim[] = [];
  const seen = new Map<string, { level: number; strength: number; quotes: string[] }>();

  const note = (skillId: string, level: number, strength: number, quote: string) => {
    const node = graph.skills[skillId];
    if (!node) return;
    const cur = seen.get(skillId);
    if (!cur) {
      seen.set(skillId, { level, strength, quotes: [quote] });
    } else {
      cur.level = Math.max(cur.level, level);
      cur.strength = Math.max(cur.strength, strength);
      if (cur.quotes.length < 3) cur.quotes.push(quote);
    }
  };

  const topLangs = Object.entries(profile.languageMix).sort((a, b) => b[1] - a[1]);
  const totalRepos = Object.values(profile.languageMix).reduce((s, n) => s + n, 0) || 1;
  for (const [lang, count] of topLangs.slice(0, 6)) {
    const share = count / totalRepos;
    const level = share > 0.5 ? 3 : share > 0.25 ? 2 : 1;
    const strength = Math.min(5, 2 + count);
    for (const skillId of LANGUAGE_SKILL_HINTS[lang] ?? []) {
      note(skillId, level, strength, `${lang} appears in ${count} of ${totalRepos} repositories`);
    }
  }

  for (const repo of profile.repos) {
    const desc = `${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
    for (const [pattern, skillId] of [
      ["machine learning", "ml_machinelearning"],
      ["deep learning", "ml_dl"],
      ["neural", "ml_dl"],
      ["nlp", "ml_nlp"],
      ["computer vision", "ml_cv"],
      ["flask", "wd_flask"],
      ["django", "wd_django"],
      ["react", "wd_react"],
      ["next.js", "wd_nextjs"],
      ["node", "wd_nodejs"],
      ["express", "wd_nodejs"],
      ["graphql", "wd_graphql"],
      ["docker", "cloud_docker"],
      ["kubernetes", "cloud_kubernetes"],
      ["aws", "cloud_aws"],
      ["terraform", "cloud_terraform"],
      ["security", "cy_infosec"],
      ["pentest", "cy_offensive"],
      ["sql", "ds_sql"],
      ["pandas", "ds_analysis"],
      ["visualization", "ds_viz"],
    ] as const) {
      if (desc.includes(pattern)) {
        note(skillId, 2, 3, `Repo "${repo.name}" mentions ${pattern}`);
      }
    }
  }

  if (profile.repos.length >= 5) {
    const activeRepo = profile.repos.find((r) => monthsSince(r.pushedAt) < 3);
    if (activeRepo) note("pd_problemsolving", 2, 2, `Active repo "${activeRepo.name}" pushed recently`);
  }

  for (const [skillId, info] of seen) {
    const node = graph.skills[skillId];
    claims.push({
      skillId,
      skillName: node?.name ?? skillId,
      level: info.level,
      quote: info.quotes.join("; "),
      strength: info.strength,
    });
  }

  const topLang = topLangs[0]?.[0] ?? "various";
  return {
    archetype: `${topLang} developer with ${profile.publicRepos} public repositories`,
    summary: `Heuristic analysis of ${profile.login}: ${profile.publicRepos} repos, ${profile.totalStars} stars, primary languages ${topLangs
      .slice(0, 3)
      .map(([l]) => l)
      .join(", ")}.`,
    claims: claims.slice(0, 20),
    mode: "heuristic",
  };
}

function buildAnalysisPrompt(profile: GithubProfile, graph: SkillGraph): string {
  const skillCatalog = Object.values(graph.skills)
    .map((s) => `${s.id}|${s.name}|${s.domain}`)
    .join("\n");

  const repoDigest = profile.repos
    .map((r) => {
      const parts = [
        `- ${r.name} (${r.language ?? "unknown"}${r.stars ? `, ${r.stars}★` : ""}${r.pushedAt ? `, last push ${r.pushedAt.slice(0, 10)}` : ""})`,
        r.description ? `  desc: ${r.description.slice(0, 160)}` : "",
        r.topics.length ? `  topics: ${r.topics.slice(0, 8).join(", ")}` : "",
        r.readmeExcerpt ? `  readme: ${r.readmeExcerpt.replace(/\s+/g, " ").slice(0, 400)}` : "",
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n");

  return `Analyse this GitHub profile and extract skill evidence.

GITHUB PROFILE
login: ${profile.login}
bio: ${profile.bio ?? "(none)"}
company: ${profile.company ?? "(none)"}
followers: ${profile.followers}, public repos: ${profile.publicRepos}, total stars: ${profile.totalStars}
account created: ${profile.createdAt?.slice(0, 10) ?? "unknown"}
language mix (repo counts): ${Object.entries(profile.languageMix)
    .sort((a, b) => b[1] - a[1])
    .map(([l, n]) => `${l}:${n}`)
    .join(", ")}

TOP REPOSITORIES
${repoDigest}

SKILL CATALOG (id|name|domain) — you may ONLY use these ids:
${skillCatalog}

Return JSON:
{
  "archetype": "one-phrase developer archetype",
  "summary": "2-3 sentence honest assessment of what this person can actually do",
  "claims": [
    {
      "skillId": "id from catalog",
      "skillName": "matching name",
      "level": 0-5,
      "quote": "the concrete observation supporting this (name repos/files/languages)",
      "strength": 1-5
    }
  ]
}

Rules:
- level 0-5: 1 = touched it, 2 = small demos, 3 = real independent use, 4 = sophisticated use, 5 = mastery signals (popular OSS, complex architecture)
- Only claim skills you can ground in the evidence above. Quote specific repos.
- Include 3-12 claims, strongest signals first. Ignore tutorial-clone repos.
- strength = how convincing the evidence is (1 = weak inference, 5 = undeniable).`;
}

export async function analyzeGithub(profile: GithubProfile, graph: SkillGraph): Promise<GithubAnalysis> {
  const result = await chatJson<GithubAnalysis>(
    [
      { role: "system", content: "You are a precise technical recruiter who only states what the evidence supports." },
      { role: "user", content: buildAnalysisPrompt(profile, graph) },
    ],
    (value) => {
      const obj = value as Record<string, unknown>;
      const claims = asArray(obj.claims)
        .map((c) => {
          const claim = c as Record<string, unknown>;
          const skillId = asString(claim.skillId);
          const node = graph.skills[skillId];
          if (!node) return null;
          return {
            skillId,
            skillName: node.name,
            level: asInt(claim.level, 1, 0, 5),
            quote: asString(claim.quote, "GitHub evidence"),
            strength: asInt(claim.strength, 2, 1, 5),
          } satisfies SkillClaim;
        })
        .filter((c): c is SkillClaim => c !== null && c.level > 0)
        .slice(0, 15);
      if (!claims.length) return null;
      return {
        archetype: asString(obj.archetype, "Developer"),
        summary: asString(obj.summary, ""),
        claims,
        mode: "llm" as const,
      };
    },
    { maxTokens: 1600, temperature: 0.3 },
  );

  if (result) return result.value;
  // No LLM: the trained tagger reads repository prose (descriptions, topics,
  // READMEs) that the language/keyword table cannot, so try it first and
  // merge the language heuristic underneath it.
  const tagged = await taggerAnalysis(profile, graph);
  return tagged ?? heuristicAnalysis(profile, graph);
}

/**
 * Trained fallback for `analyzeGithub`: one tagger pass per repository over
 * its description, topics and README excerpt. Skill *level* still comes from
 * the deterministic language-share heuristic — the tagger says which skills a
 * repository is about, not how good the author is at them.
 */
async function taggerAnalysis(profile: GithubProfile, graph: SkillGraph): Promise<GithubAnalysis | null> {
  const repos = profile.repos.filter((r) => !r.isFork).slice(0, 12);
  if (!repos.length) return null;

  const texts = repos.map((r) =>
    [r.name.replace(/[-_]/g, " "), r.description ?? "", r.topics.join(", "), (r.readmeExcerpt ?? "").slice(0, 800)]
      .filter(Boolean)
      .join(". ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const tagged = await tagTexts(texts, 6);
  if (!tagged) return null;

  const best = new Map<string, { probability: number; strength: number; repos: string[] }>();
  tagged.forEach((hits, i) => {
    for (const hit of hits) {
      if (!graph.skills[hit.skillId]) continue;
      const cur = best.get(hit.skillId);
      if (!cur) {
        best.set(hit.skillId, { probability: hit.probability, strength: hit.strength, repos: [repos[i].name] });
      } else {
        cur.probability = Math.max(cur.probability, hit.probability);
        cur.strength = Math.max(cur.strength, hit.strength);
        if (cur.repos.length < 3) cur.repos.push(repos[i].name);
      }
    }
  });
  if (!best.size) return null;

  // Level from corroboration: one repo is level 2, several is level 3, and a
  // skill spread across repos with real code reaches 4.
  const claims: SkillClaim[] = [...best.entries()]
    .sort((a, b) => b[1].probability - a[1].probability)
    .slice(0, 15)
    .map(([skillId, v]) => ({
      skillId,
      skillName: graph.skills[skillId].name,
      level: v.repos.length >= 3 ? 4 : v.repos.length >= 2 ? 3 : 2,
      quote: `Matched in ${v.repos.length} repositor${v.repos.length === 1 ? "y" : "ies"}: ${v.repos.join(", ")}`,
      strength: v.strength,
    }));

  const topLang = Object.entries(profile.languageMix).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "various";
  return {
    archetype: `${topLang} developer with ${profile.publicRepos} public repositories`,
    summary: `Trained skill tagger matched ${claims.length} catalogue skill${
      claims.length === 1 ? "" : "s"
    } across ${repos.length} repositories (primary language ${topLang}, ${profile.totalStars} stars).`,
    claims,
    mode: "tagger",
  };
}
