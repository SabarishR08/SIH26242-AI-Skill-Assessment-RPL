/**
 * LeetCode + Codeforces ingestion.
 *
 * Both platforms expose public endpoints that need no authentication:
 *   - LeetCode: unofficial GraphQL endpoint (public profiles only)
 *   - Codeforces: official REST API user.info
 *
 * Signal mapping is deterministic and documented: solved-count difficulty
 * weighting (easy 1x / medium 2x / hard 3x) and Codeforces rating bands
 * convert into evidenced levels for the graph's algorithm skills.
 */
import type { SkillClaim, SkillEvidenceSource } from "./types";

const LC_GRAPHQL = "https://leetcode.com/graphql";

export interface LeetCodeStats {
  username: string;
  ranking: number | null;
  easy: number;
  medium: number;
  hard: number;
  total: number;
  weightedScore: number;
  evidencedLevel: number;
}

interface LcResponse {
  data?: {
    matchedUser?: {
      username: string;
      profile?: { ranking?: number | null };
      submitStatsGlobal?: {
        acSubmissionNum?: Array<{ difficulty: string; count: number }>;
      };
    } | null;
  };
}

export async function fetchLeetCodeStats(username: string): Promise<LeetCodeStats> {
  const query = `
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile { ranking }
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
      }
    }`;
  const res = await fetch(LC_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "PathFinderAI-Evidence" },
    body: JSON.stringify({ query, variables: { username } }),
  });
  if (!res.ok) throw new Error(`LeetCode request failed (${res.status})`);
  const json = (await res.json()) as LcResponse;
  const matched = json.data?.matchedUser;
  if (!matched) throw new Error("LeetCode user not found or profile is private");

  const counts = matched.submitStatsGlobal?.acSubmissionNum ?? [];
  const pick = (d: string) => counts.find((c) => c.difficulty.toLowerCase() === d)?.count ?? 0;
  const easy = pick("easy");
  const medium = pick("medium");
  const hard = pick("hard");
  const weightedScore = easy * 1 + medium * 2 + hard * 3;
  const total = easy + medium + hard;

  // Banding: 50 = level 2 territory, 250 = 3, 600 = 4, 1200+ = 5.
  let evidencedLevel = 1;
  if (weightedScore >= 1200 || hard >= 100) evidencedLevel = 5;
  else if (weightedScore >= 600) evidencedLevel = 4;
  else if (weightedScore >= 250) evidencedLevel = 3;
  else if (weightedScore >= 50) evidencedLevel = 2;

  return {
    username: matched.username,
    ranking: matched.profile?.ranking ?? null,
    easy,
    medium,
    hard,
    total,
    weightedScore,
    evidencedLevel,
  };
}

export function leetCodeClaims(stats: LeetCodeStats): SkillClaim[] {
  const claims: SkillClaim[] = [];
  if (stats.total === 0) return claims;
  const summary = `${stats.total} solved (${stats.easy}E/${stats.medium}M/${stats.hard}H)${stats.ranking ? `, global rank ${stats.ranking}` : ""}`;
  claims.push({
    skillId: "wd_algo",
    skillName: "Algorithms",
    level: stats.evidencedLevel,
    quote: `LeetCode: ${summary}`,
    strength: Math.min(5, 2 + stats.evidencedLevel),
  });
  if (stats.medium + stats.hard >= 50) {
    claims.push({
      skillId: "wd_ds",
      skillName: "Data Structure",
      level: Math.max(2, stats.evidencedLevel - 1),
      quote: `LeetCode: ${stats.medium + stats.hard} medium+hard problems require non-trivial data structures`,
      strength: 3,
    });
  }
  if (stats.total >= 200) {
    claims.push({
      skillId: "wd_problem",
      skillName: "Problem Solving",
      level: Math.min(4, 2 + Math.floor(stats.total / 200)),
      quote: `LeetCode: sustained practice across ${stats.total} problems`,
      strength: 3,
    });
  }
  return claims;
}

// ─── Codeforces ──────────────────────────────────────────────────────────────

export interface CodeforcesStats {
  handle: string;
  rating: number | null;
  maxRating: number | null;
  rank: string | null;
  maxRank: string | null;
  evidencedLevel: number;
}

interface CfUser {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  maxRank?: string;
}

export async function fetchCodeforcesStats(handle: string): Promise<CodeforcesStats> {
  const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`, {
    headers: { "User-Agent": "PathFinderAI-Evidence" },
  });
  const json = (await res.json()) as { status: string; result?: CfUser[]; comment?: string };
  if (json.status !== "OK" || !json.result?.length) {
    const comment = json.comment || "";
    if (comment.toLowerCase().includes("not found")) {
      throw new Error(`Codeforces user "${handle}" not found`);
    }
    throw new Error(comment.replace(/^handles:\s*/i, "") || "Codeforces handle not found");
  }
  const u = json.result[0];
  const rating = u.rating ?? u.maxRating ?? null;
  let evidencedLevel = 0;
  if (rating != null) {
    if (rating >= 2400) evidencedLevel = 5;
    else if (rating >= 2100) evidencedLevel = 4;
    else if (rating >= 1700) evidencedLevel = 3;
    else if (rating >= 1300) evidencedLevel = 2;
    else evidencedLevel = 1;
  }
  return {
    handle: u.handle,
    rating: u.rating ?? null,
    maxRating: u.maxRating ?? null,
    rank: u.rank ?? null,
    maxRank: u.maxRank ?? null,
    evidencedLevel,
  };
}

export function codeforcesClaims(stats: CodeforcesStats): SkillClaim[] {
  if (stats.evidencedLevel === 0) return [];
  const ratingText = stats.maxRating ? `current ${stats.rating ?? "unrated"}, peak ${stats.maxRating} (${stats.maxRank ?? "unranked"})` : "unrated";
  return [
    {
      skillId: "wd_algo",
      skillName: "Algorithms",
      level: stats.evidencedLevel,
      quote: `Codeforces competitive programming: ${ratingText}`,
      strength: Math.min(5, 1 + stats.evidencedLevel),
    },
    {
      skillId: "wd_ds",
      skillName: "Data Structure",
      level: Math.max(1, stats.evidencedLevel - 1),
      quote: `Codeforces contests require fluency with core data structures (${ratingText})`,
      strength: Math.max(1, stats.evidencedLevel - 1),
    },
  ];
}

export const evidenceSourceMeta: Record<SkillEvidenceSource, { label: string; icon: string }> = {
  github: { label: "GitHub", icon: "github" },
  resume: { label: "Resume / LinkedIn text", icon: "file-text" },
  leetcode: { label: "LeetCode", icon: "code" },
  codeforces: { label: "Codeforces", icon: "trophy" },
  interview: { label: "Interview", icon: "message-square" },
  project: { label: "Project", icon: "git-branch" },
  quiz: { label: "Quiz", icon: "check-circle" },
};
