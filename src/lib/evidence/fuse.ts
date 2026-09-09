/**
 * Evidence fusion — turns raw claims from any source into tiered skill
 * assessments.
 *
 * Tiers (highest first):
 *   proven    — real artefacts back the claim (strong GitHub evidence,
 *               competitive-programming record, PASSED project evaluation)
 *   verified  — a calibration/gate quiz independently confirmed the level
 *   claimed   — self-reported only (interview or resume mention)
 *   inferred  — weak signals (single repo language, incidental mention)
 *
 * Level combination across multiple sources: the strongest source sets the
 * ceiling, weaker sources nudge via a weighted mean — a second corroborating
 * source raises confidence but never overrides a stronger artefact.
 *
 * Confidence: noisy-OR over per-source confidences (independent evidence
 * compounds; contradictory evidence doesn't silently cancel).
 */
import { db } from "@/lib/db";
import { loadEquivalenceMap } from "@/lib/ml/artifacts";
import { loadSkillGraph } from "@/lib/engine/data";
import type { SkillClaim, SkillEvidenceSource } from "./types";

const SOURCE_CONFIDENCE: Record<SkillEvidenceSource, number> = {
  github: 0.85,
  resume: 0.5,
  leetcode: 0.9,
  codeforces: 0.9,
  interview: 0.35,
  project: 0.95,
  quiz: 0.8,
};

const TIER_RANK: Record<string, number> = { none: 0, inferred: 1, claimed: 2, verified: 3, proven: 4 };

export interface FusionUpdate {
  skillId: string;
  skillName: string;
  before: { level: number; tier: string; confidence: number } | null;
  after: { level: number; tier: string; confidence: number };
  changed: boolean;
}

async function tierForSource(source: SkillEvidenceSource, claim: SkillClaim, verified = false): Promise<string> {
  if (source === "project") return "proven";
  if (source === "quiz") return "verified";
  // PF-24: Unverified external handles (GitHub, LeetCode, Codeforces) entered during onboarding without
  // ownership proof must be downgraded below proven (e.g. claimed or inferred)
  if (source === "leetcode" || source === "codeforces") return verified ? "proven" : "claimed";
  if (source === "github") return verified ? "proven" : claim.strength >= 3 ? "claimed" : "inferred";
  if (source === "resume") return claim.strength >= 3 ? "claimed" : "inferred";
  return "claimed"; // interview
}

export async function fuseEvidence(
  learnerId: string,
  source: SkillEvidenceSource,
  claims: SkillClaim[],
  options: { verified?: boolean } = {},
): Promise<FusionUpdate[]> {
  const updates: FusionUpdate[] = [];
  const graph = await loadSkillGraph();
  const equivalence = await loadEquivalenceMap();

  // PF-17: Deduplicate incoming claims across equivalent skill clusters:
  // Map every claim to its canonical skill ID so assessment rows do not fragment across domain prefixes
  const clusterMap = new Map<string, SkillClaim>();
  for (const claim of claims) {
    if (claim.level <= 0) continue;
    const cluster = [claim.skillId, ...(equivalence[claim.skillId] || [])].sort();
    const clusterKey = cluster[0];
    const canonicalName = graph.skills[clusterKey]?.name ?? claim.skillName;

    const prev = clusterMap.get(clusterKey);
    if (!prev) {
      clusterMap.set(clusterKey, { ...claim, skillId: clusterKey, skillName: canonicalName });
    } else {
      prev.level = Math.max(prev.level, claim.level);
      prev.strength = Math.max(prev.strength, claim.strength);
      if (claim.quote && !prev.quote.includes(claim.quote)) {
        prev.quote = `${prev.quote} | ${claim.quote}`.slice(0, 400);
      }
    }
  }
  const effectiveClaims = Array.from(clusterMap.values());

  for (const claim of effectiveClaims) {
    const cluster = [claim.skillId, ...(equivalence[claim.skillId] || [])];
    const existing = await db.skillAssessment.findFirst({
      where: {
        learnerId,
        skillId: { in: cluster },
      },
    });

    const targetSkillId = existing ? existing.skillId : claim.skillId;
    const targetSkillName = existing ? existing.skillName : claim.skillName;

    const sourceTier = await tierForSource(source, claim, options.verified);
    const baseConf = SOURCE_CONFIDENCE[source];
    const adjustedConf = (!options.verified && (source === "github" || source === "leetcode" || source === "codeforces"))
      ? baseConf * 0.75
      : baseConf;
    const sourceConf = adjustedConf * (0.6 + 0.08 * claim.strength);
    // Self-reported sources (interview, resume) only ever set the CLAIMED
    // level — evidence must come from artefacts (GitHub, quizzes, projects).
    // Without this separation the claims-vs-evidence calibration loop is dead.
    const isSelfReport = source === "interview" || source === "resume";

    if (!existing) {
      const conf = Math.min(0.97, sourceConf);
      await db.skillAssessment.create({
        data: {
          learnerId,
          skillId: targetSkillId,
          skillName: targetSkillName,
          claimedLevel: isSelfReport ? claim.level : 0,
          evidencedLevel: isSelfReport ? 0 : claim.level,
          tier: isSelfReport ? "claimed" : sourceTier,
          confidence: conf,
          notes: claim.quote.slice(0, 400),
          lastVerifiedAt: !isSelfReport && (sourceTier === "proven" || sourceTier === "verified") ? new Date() : null,
        },
      });
      updates.push({
        skillId: targetSkillId,
        skillName: targetSkillName,
        before: null,
        after: { level: claim.level, tier: sourceTier, confidence: conf },
        changed: true,
      });
      continue;
    }

    // Combine: new evidenced level = max(existing, claim) when claim is
    // credible (strength >= 2), else blend toward the mean.
    // Self-reported sources never touch the evidenced level.
    const combinedLevel = isSelfReport
      ? existing.evidencedLevel
      : claim.level >= existing.evidencedLevel
        ? Math.round(0.7 * claim.level + 0.3 * existing.evidencedLevel)
        : Math.round(0.75 * existing.evidencedLevel + 0.25 * claim.level);

    const combinedTier = isSelfReport ? existing.tier : TIER_RANK[sourceTier] >= TIER_RANK[existing.tier] ? sourceTier : existing.tier;

    // Noisy-OR confidence over independent sources.
    const combinedConf = Math.min(0.97, 1 - (1 - existing.confidence) * (1 - sourceConf));

    // Self-reported sources only raise claimedLevel, never lower it.
    const claimedLevel = isSelfReport ? Math.max(existing.claimedLevel, claim.level) : existing.claimedLevel;

    const changed =
      combinedLevel !== existing.evidencedLevel ||
      combinedTier !== existing.tier ||
      claimedLevel !== existing.claimedLevel ||
      Math.abs(combinedConf - existing.confidence) > 0.01;

    await db.skillAssessment.update({
      where: { id: existing.id },
      data: {
        claimedLevel,
        evidencedLevel: Math.max(combinedLevel, 0),
        tier: combinedTier,
        confidence: combinedConf,
        notes: [existing.notes, claim.quote].filter(Boolean).join(" | ").slice(0, 800),
        lastVerifiedAt:
          combinedTier === "proven" || combinedTier === "verified" ? new Date() : existing.lastVerifiedAt,
      },
    });

    updates.push({
      skillId: claim.skillId,
      skillName: claim.skillName,
      before: { level: existing.evidencedLevel, tier: existing.tier, confidence: existing.confidence },
      after: { level: Math.max(combinedLevel, 0), tier: combinedTier, confidence: combinedConf },
      changed,
    });
  }

  await transferAcrossEquivalents(learnerId, updates);

  return updates;
}

// ─── Equivalent-skill transfer ───────────────────────────────────────────────

/**
 * The skill graph duplicates the same competence across domains: `ds_python`
 * and `ml_python` are both literally "Python Programming", `ds_sql` and
 * `wd_sql` are both "SQL". A trained run identifies those pairs
 * (`equivalent_skills.json`, exact name match plus high embedding
 * similarity), and without this the learner has to prove Python once per
 * domain — the same repository counts for one node and not its twin.
 *
 * Transfer rules, deliberately conservative:
 *   - level and tier carry over unchanged (it is the same competence, and
 *     the evidence really does demonstrate it)
 *   - confidence is discounted, because the claim was made about the twin
 *   - nothing is ever lowered: a skill with its own stronger direct evidence
 *     keeps it
 *   - one hop only, and mirrored rows never re-trigger a transfer
 */
export const EQUIVALENCE_CONFIDENCE_DISCOUNT = 0.9;

export interface AssessmentState {
  claimedLevel: number;
  evidencedLevel: number;
  tier: string;
  confidence: number;
}

/**
 * Pure merge: what an equivalent skill's row should become, or null when the
 * transfer would change nothing. Exported for tests.
 */
export function mergeEquivalent(
  source: AssessmentState,
  existing: AssessmentState | null,
): AssessmentState | null {
  const confidence = Math.min(0.97, source.confidence * EQUIVALENCE_CONFIDENCE_DISCOUNT);
  if (!existing) {
    if (source.claimedLevel <= 0 && source.evidencedLevel <= 0) return null;
    return {
      claimedLevel: source.claimedLevel,
      evidencedLevel: source.evidencedLevel,
      tier: source.tier,
      confidence,
    };
  }
  const merged: AssessmentState = {
    claimedLevel: Math.max(existing.claimedLevel, source.claimedLevel),
    evidencedLevel: Math.max(existing.evidencedLevel, source.evidencedLevel),
    tier: TIER_RANK[source.tier] > TIER_RANK[existing.tier] ? source.tier : existing.tier,
    confidence: Math.max(existing.confidence, confidence),
  };
  const unchanged =
    merged.claimedLevel === existing.claimedLevel &&
    merged.evidencedLevel === existing.evidencedLevel &&
    merged.tier === existing.tier &&
    Math.abs(merged.confidence - existing.confidence) <= 0.01;
  return unchanged ? null : merged;
}

/** Mirror freshly-applied assessments onto their equivalent skills. */
export async function transferAcrossEquivalents(
  learnerId: string,
  updates: FusionUpdate[],
): Promise<FusionUpdate[]> {
  const equivalence = await loadEquivalenceMap();
  if (!Object.keys(equivalence).length) return [];

  const graph = await loadSkillGraph();
  const mirrored: FusionUpdate[] = [];
  const touched = new Set(updates.map((u) => u.skillId));

  for (const update of updates) {
    for (const twinId of equivalence[update.skillId] ?? []) {
      // Don't fight with a skill the same batch of evidence already set
      // directly — its own claim is better than a mirror of its twin.
      if (touched.has(twinId)) continue;
      const twinNode = graph.skills[twinId];
      if (!twinNode) continue;

      const source = await db.skillAssessment.findUnique({
        where: { learnerId_skillId: { learnerId, skillId: update.skillId } },
      });
      if (!source) continue;
      const existing = await db.skillAssessment.findUnique({
        where: { learnerId_skillId: { learnerId, skillId: twinId } },
      });

      const merged = mergeEquivalent(
        {
          claimedLevel: source.claimedLevel,
          evidencedLevel: source.evidencedLevel,
          tier: source.tier,
          confidence: source.confidence,
        },
        existing
          ? {
              claimedLevel: existing.claimedLevel,
              evidencedLevel: existing.evidencedLevel,
              tier: existing.tier,
              confidence: existing.confidence,
            }
          : null,
      );
      if (!merged) continue;

      if (existing) {
        const note = `Carried over from "${update.skillName}" (same skill in another domain)`;
        await db.skillAssessment.update({
          where: { id: existing.id },
          data: {
            ...merged,
            notes: [existing.notes, note].filter(Boolean).join(" | ").slice(0, 800),
            lastVerifiedAt:
              merged.tier === "proven" || merged.tier === "verified" ? new Date() : existing.lastVerifiedAt,
          },
        });

        mirrored.push({
          skillId: twinId,
          skillName: twinNode.name,
          before: { level: existing.evidencedLevel, tier: existing.tier, confidence: existing.confidence },
          after: { level: merged.evidencedLevel, tier: merged.tier, confidence: merged.confidence },
          changed: true,
        });
      }
    }
  }
  return mirrored;
}

export async function logEvidence(
  learnerId: string,
  source: SkillEvidenceSource,
  sourceRef: string | null,
  summary: string,
  claims: SkillClaim[],
  url?: string,
) {
  await db.evidenceItem.create({
    data: {
      learnerId,
      source,
      sourceRef,
      summary: summary.slice(0, 1000),
      skillClaims: JSON.stringify(claims),
      strength: claims.length ? Math.max(...claims.map((c) => c.strength)) : 1,
      url: url ?? null,
    },
  });
  await db.activityLog.create({
    data: {
      learnerId,
      kind: "evidence_added",
      detailJson: JSON.stringify({ source, sourceRef, claimCount: claims.length, summary: summary.slice(0, 200) }),
    },
  });
}

/** Apply a quiz verdict to an assessment (verified tier). */
export async function applyQuizVerdict(
  learnerId: string,
  skillId: string,
  skillName: string,
  passed: boolean,
  targetLevel: number,
  score: number,
) {
  const existing = await db.skillAssessment.findUnique({
    where: { learnerId_skillId: { learnerId, skillId } },
  });

  if (!existing) {
    await db.skillAssessment.create({
      data: {
        learnerId,
        skillId,
        skillName,
        claimedLevel: targetLevel,
        evidencedLevel: passed ? targetLevel : Math.max(1, Math.round(targetLevel * score)),
        tier: passed ? "verified" : "claimed",
        confidence: passed ? 0.8 : 0.4,
        lastVerifiedAt: passed ? new Date() : null,
        notes: `Quiz verdict: ${Math.round(score * 100)}%`,
      },
    });
    return;
  }

  const isEstablished = existing.tier === "proven" || existing.tier === "verified";
  const newEvidenced = passed
    ? Math.max(existing.evidencedLevel, targetLevel)
    : isEstablished
      ? existing.evidencedLevel
      : Math.min(existing.evidencedLevel, Math.max(0, Math.round(targetLevel * score)));
  const newTier = passed
    ? TIER_RANK[existing.tier] >= TIER_RANK.verified
      ? existing.tier
      : "verified"
    : isEstablished
      ? existing.tier
      : "claimed";

  await db.skillAssessment.update({
    where: { id: existing.id },
    data: {
      evidencedLevel: newEvidenced,
      tier: newTier,
      confidence: passed ? Math.min(0.97, Math.max(existing.confidence, 0.8)) : Math.max(0.2, existing.confidence - 0.2),
      lastVerifiedAt: passed ? new Date() : existing.lastVerifiedAt,
      notes: [existing.notes, `Quiz verdict: ${Math.round(score * 100)}%`].filter(Boolean).join(" | ").slice(0, 800),
    },
  });
}

/** Mark milestone skills as proven after a PASSED project evaluation. */
export async function applyProjectVerdict(learnerId: string, skillIds: string[], level: number) {
  for (const skillId of skillIds) {
    const existing = await db.skillAssessment.findUnique({
      where: { learnerId_skillId: { learnerId, skillId } },
    });
    if (!existing) continue;
    await db.skillAssessment.update({
      where: { id: existing.id },
      data: {
        evidencedLevel: Math.max(existing.evidencedLevel, level),
        tier: "proven",
        confidence: Math.min(0.97, Math.max(existing.confidence, 0.9)),
        lastVerifiedAt: new Date(),
        notes: [existing.notes, "Project evaluation passed"].filter(Boolean).join(" | ").slice(0, 800),
      },
    });
  }
}
