import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";
import { createHash } from "crypto";
import { signEd25519 } from "@/lib/passport-crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export interface VerifiedSkillEntry {
  skillId: string;
  skillName: string;
  level: number;
  tier: "proven" | "verified" | "claimed";
  source: string;
  verifiedAt: string;
  evidenceSnippet?: string;
}

export interface ProjectEvaluationEntry {
  title: string;
  score: number | null;
  verdict: string;
  submittedAt: string;
  repoUrl: string;
  keyStrengths: string[];
}

export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const url = new URL(request.url);
    const queryId =
      url.searchParams.get("learnerId") ||
      url.searchParams.get("passport") ||
      url.searchParams.get("passportId") ||
      url.searchParams.get("shareToken") ||
      url.searchParams.get("token") ||
      url.searchParams.get("id");

    if (!queryId) return apiError("learnerId is required", 400);

    // Direct indexed query: by primary ID, passportId, or passportShareToken (O(1) B-tree lookup)
    let learner =
      typeof db.learner.findFirst === "function"
        ? await db.learner.findFirst({
            where: {
              OR: [
                { id: queryId },
                { passportId: queryId },
                { passportShareToken: queryId },
              ],
            },
            include: {
              assessments: true,
              evidence: true,
              quizzes: {
                include: {
                  attempts: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          })
        : await db.learner.findUnique({
            where: { id: queryId },
            include: {
              assessments: true,
              evidence: true,
              quizzes: {
                include: {
                  attempts: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          });

    if (!learner) return apiError("Learner not found", 404);
    const learnerId = learner.id;

    const activePath = await db.learningPath.findFirst({
      where: { learnerId, isActive: true },
      include: {
        milestones: {
          include: {
            project: {
              include: {
                submissions: {
                  orderBy: { submittedAt: "desc" },
                },
              },
            },
          },
        },
      },
    });

    // 1. Compile verified skills vs self-reported skills (NEW-01)
    // ONLY proven and verified skills qualify as verified competencies.
    const verifiedSkills: VerifiedSkillEntry[] = [];
    const selfReportedSkills: VerifiedSkillEntry[] = [];

    for (const a of learner.assessments) {
      const matchingEv = learner.evidence.find((e) => e.skillClaims.includes(a.skillId));
      const entry: VerifiedSkillEntry = {
        skillId: a.skillId,
        skillName: a.skillName,
        level: a.evidencedLevel || a.claimedLevel,
        tier: (a.tier as "proven" | "verified" | "claimed") || (a.evidencedLevel >= 3 ? "proven" : "verified"),
        source: matchingEv
          ? `${matchingEv.source} (${matchingEv.sourceRef || "profile"})`
          : a.tier === "claimed"
            ? "Self-Reported"
            : "Calibration Assessment",
        verifiedAt: (a.lastVerifiedAt ?? a.updatedAt).toISOString(),
        evidenceSnippet: matchingEv?.summary || a.notes || undefined,
      };

      if (a.tier === "proven" || a.tier === "verified") {
        verifiedSkills.push(entry);
      } else if (a.tier === "claimed" || a.claimedLevel > 0) {
        selfReportedSkills.push(entry);
      }
    }

    // 2. Compile evaluations from projects (NEW-05: no invented scores)
    const evaluations: ProjectEvaluationEntry[] = [];
    if (activePath) {
      for (const m of activePath.milestones) {
        if (m.project?.submissions.length) {
          for (const sub of m.project.submissions) {
            let parsedEval: { verdict?: string; score?: number; strengths?: string[] } = {};
            try {
              if (sub.evaluationJson) {
                parsedEval = JSON.parse(sub.evaluationJson);
              }
            } catch {
              // ignore parse errors
            }

            evaluations.push({
              title: m.project.title,
              score: typeof parsedEval.score === "number" ? parsedEval.score : null,
              verdict: parsedEval.verdict ?? sub.status,
              submittedAt: sub.submittedAt.toISOString(),
              repoUrl: sub.repoUrl,
              keyStrengths: Array.isArray(parsedEval.strengths) ? parsedEval.strengths : [],
            });
          }
        }
      }
    }

    // 3. Compile quizzes passed
    const passedQuizzes = learner.quizzes.filter(
      (q) => q.status === "passed" || q.attempts.some((att) => att.passed),
    );

    // 4. Calculate radar score / mastery index STRICTLY on verified skills (NEW-01)
    const totalVerifiedLevel = verifiedSkills.reduce((sum, s) => sum + s.level, 0);
    const radarScore =
      verifiedSkills.length > 0
        ? Math.min(100, Math.round((totalVerifiedLevel / (verifiedSkills.length * 5)) * 100))
        : 0;

    // 5. Generate content-based integrity hash (NEW-04)
    // Hash commits to actual subject content (skills, levels, tiers, evaluation verdicts, quiz scores)
    const canonicalSubject = {
      learnerId: learner.id,
      name: learner.name,
      targetRole: learner.targetRole ?? "Software Engineer",
      domain: learner.domain ?? "Engineering",
      goalSkill: learner.goalSkillId ?? "Full Stack Mastery",
      masteryScore: radarScore,
      verifiedSkills: verifiedSkills
        .slice()
        .sort((a, b) => a.skillId.localeCompare(b.skillId))
        .map((s) => ({ id: s.skillId, name: s.skillName, level: s.level, tier: s.tier })),
      evaluations: evaluations
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((e) => ({ title: e.title, verdict: e.verdict, score: e.score, repoUrl: e.repoUrl })),
      quizzesPassed: passedQuizzes
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((q) => {
          const bestScore = q.attempts.length ? Math.max(...q.attempts.map((a) => a.score)) : null;
          return { id: q.id, skillId: q.skillId, score: bestScore };
        }),
    };

    const canonicalSubjectStr = JSON.stringify(canonicalSubject);
    const integrityHash = createHash("sha256").update(canonicalSubjectStr).digest("hex");
    const passportId = `PF-PASS-${integrityHash.slice(0, 16).toUpperCase()}`;
    const shareToken = `PF-SHARE-${createHash("sha256").update(`${learner.id}:${integrityHash.slice(0, 8)}`).digest("hex").slice(0, 16).toUpperCase()}`;

    // Persist passportId and shareToken on learner row if not set or changed (O(1) indexing for future lookups)
    if (
      typeof db.learner.update === "function" &&
      (learner.passportId !== passportId || learner.passportShareToken !== shareToken)
    ) {
      await db.learner.update({
        where: { id: learner.id },
        data: { passportId, passportShareToken: shareToken },
      });
    }

    const issuedAt = new Date().toISOString();
    const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "pathfinder-ai-61aq.onrender.com";
    const cleanHost = rawHost.split(":")[0];
    const didIssuer = `did:web:${cleanHost}`;

    // 6. Generate genuine W3C Verifiable Credential 2.0 with real Ed25519 JWS (NEW-03)
    const vcSubjectPayload = {
      id: `did:pathfinder:learner:${shareToken}`,
      name: learner.name,
      targetRole: learner.targetRole ?? "Software Engineer",
      domain: learner.domain ?? "Engineering",
      goalSkill: learner.goalSkillId ?? "Full Stack Mastery",
      masteryScore: radarScore,
      skillsEvidencedCount: verifiedSkills.length,
      verifiedSkills: canonicalSubject.verifiedSkills,
      evaluations: canonicalSubject.evaluations,
    };

    const jws = signEd25519(JSON.stringify(vcSubjectPayload));

    const jsonLdCredential = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/security/suites/ed25519-2020/v1",
        `https://${cleanHost}/.well-known/did.json`,
      ],
      id: `urn:uuid:${integrityHash.slice(0, 32)}`,
      type: ["VerifiableCredential", "PathFinderSkillPassport"],
      issuer: {
        id: didIssuer,
        name: "PathFinder AI Credential Authority",
        verificationMethod: `${didIssuer}#key-1`,
      },
      issuanceDate: issuedAt,
      credentialSubject: vcSubjectPayload,
      proof: {
        type: "JsonWebSignature2020",
        created: issuedAt,
        proofPurpose: "assertionMethod",
        verificationMethod: `${didIssuer}#key-1`,
        jws,
      },
    };

    return json({
      learner: {
        id: learner.id,
        name: learner.name,
        targetRole: learner.targetRole,
        domain: learner.domain,
        goalSkill: learner.goalSkillId,
        hoursPerWeek: learner.hoursPerWeek,
        memberSince: learner.createdAt.toISOString().slice(0, 10),
      },
      summary: {
        passportId,
        shareToken,
        issuedAt,
        integrityHash: integrityHash.slice(0, 16),
        fullIntegrityHash: integrityHash,
        totalVerifiedSkills: verifiedSkills.length,
        totalSelfReportedSkills: selfReportedSkills.length,
        radarScore,
        evaluationsCount: evaluations.length,
        quizzesPassed: passedQuizzes.length,
      },
      verifiedSkills,
      selfReportedSkills,
      evaluations,
      jsonLdCredential,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to load skill passport", 500);
  }
}
