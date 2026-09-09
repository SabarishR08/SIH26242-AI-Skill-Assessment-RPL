/**
 * Zone of Proximal Development calibration.
 *
 * Vygotsky's ZPD operationalised for project sizing: a learning task should
 * sit just beyond what the learner can already do independently — hard
 * enough to force growth, close enough to reach without a guide holding
 * their hands the whole way.
 *
 * We encode this as a difficulty multiplier over the learner's evidenced
 * level, clamped to the 1.5x-3x band (the same calibration rule Systemic's
 * skill-tree generator uses: "achievable but requires real effort"). Below
 * 1.5x is busywork; above 3x collapses into frustration and abandonment.
 */

export interface ZpdSpec {
  /** Difficulty multiplier applied to evidenced level (1.5 - 3.0). */
  stretchMultiplier: number;
  /** Target difficulty on the 0-5 scale after applying the multiplier. */
  targetDifficulty: number;
  /** Estimated build hours for the project brief. */
  estimatedHours: number;
  /** Number of core requirements the brief should carry. */
  requirementCount: number;
  tier: "gentle-stretch" | "solid-stretch" | "strong-stretch";
  /** Human-readable calibration rationale, shown in the UI. */
  rationale: string;
}

export function calibrateZpd(evidencedLevel: number, hoursPerWeek: number): ZpdSpec {
  const level = Math.max(0, Math.min(5, evidencedLevel));

  // Learners with more weekly capacity can absorb stronger stretch.
  // 1.5x baseline, +0.25x per band of weekly hours, capped at 3x.
  const capacityBands = hoursPerWeek <= 4 ? 0 : hoursPerWeek <= 8 ? 1 : hoursPerWeek <= 15 ? 2 : 3;
  const multiplier = Math.min(3, 1.5 + capacityBands * 0.25);

  // PF-23: Additive floor prevents level 0 from collapsing targetDifficulty and project sizing
  const effectiveLevel = Math.max(1, level);
  const targetDifficulty = Math.max(1, Math.min(5, Math.round(effectiveLevel * (multiplier / 2) + 0.5)));

  const requirementCount = Math.max(3, Math.min(6, 2 + targetDifficulty));

  // Derive hours from requirement count, target difficulty, and stretch gap
  const gap = Math.max(0, targetDifficulty - level);
  const baseHours = requirementCount * 2.8 + targetDifficulty * 2.2 + gap * 1.8;
  const estimatedHours = Math.round(Math.min(24, Math.max(4, baseHours)));

  const tier: ZpdSpec["tier"] =
    multiplier <= 1.5 ? "gentle-stretch" : multiplier <= 2.25 ? "solid-stretch" : "strong-stretch";

  const rationale =
    `Evidenced level ${level} (effective baseline ${effectiveLevel}) × stretch ${multiplier.toFixed(2)} → target difficulty ${targetDifficulty}/5. ` +
    `Sized for ${estimatedHours}h of work across ${requirementCount} core requirements — challenging enough to prove the skill, close enough to reach.`;

  return { stretchMultiplier: multiplier, targetDifficulty, estimatedHours, requirementCount, tier, rationale };
}

/**
 * Map a milestone's mean evidenced level to a project tier label used in
 * brief generation prompts.
 */
export function tierLabel(targetDifficulty: number): string {
  if (targetDifficulty <= 2) return "guided starter build";
  if (targetDifficulty <= 3) return "independent practical build";
  if (targetDifficulty <= 4) return "integration-focused build";
  return "portfolio-grade capstone";
}
