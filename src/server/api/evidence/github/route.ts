import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api-helpers";
import { fetchGithubProfile, analyzeGithub } from "@/lib/evidence/github";
import { fuseEvidence, logEvidence } from "@/lib/evidence/fuse";
import { loadSkillGraph } from "@/lib/engine/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  username: string;
}

/** Ingest GitHub evidence: fetch real profile data, analyse, fuse into assessments. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const username = (body.username || "").trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").replace(/\/.*$/, "");
    if (!body.learnerId || !username) return apiError("learnerId and username are required");

    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const profile = await fetchGithubProfile(username);
    const graph = await loadSkillGraph();
    const analysis = await analyzeGithub(profile, graph);

    await logEvidence(
      body.learnerId,
      "github",
      `${profile.login} (${profile.publicRepos} repos)`,
      analysis.summary,
      analysis.claims,
      `https://github.com/${profile.login}`,
    );
    const updates = await fuseEvidence(body.learnerId, "github", analysis.claims);

    return json({
      profile: {
        login: profile.login,
        name: profile.name,
        bio: profile.bio,
        followers: profile.followers,
        publicRepos: profile.publicRepos,
        totalStars: profile.totalStars,
        recentPushMonths: profile.recentPushMonths,
        languageMix: profile.languageMix,
        topRepos: profile.repos.slice(0, 6).map((r) => ({
          name: r.name,
          description: r.description,
          language: r.language,
          stars: r.stars,
          url: r.url,
        })),
      },
      analysis: {
        archetype: analysis.archetype,
        summary: analysis.summary,
        mode: analysis.mode,
        claims: analysis.claims,
      },
      assessmentUpdates: updates,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "GitHub ingestion failed", 500);
  }
}
