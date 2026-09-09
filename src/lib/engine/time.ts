/**
 * Time-estimation model.
 *
 * Grounding: course Duration fields in the catalogue are in months of
 * "N hours/week" study (Coursera convention: ~4-6 h/week). We convert the
 * median matched-course duration for each skill into a work-hour estimate:
 *
 *   hours = clamp(months * 14, 6, 56)      (+ practical layering bonuses)
 *
 * Assumptions are documented and tuneable in one place, so the time
 * simulator and every ETA in the product stay consistent.
 */

export interface TimeModelConstants {
  /** Study hours per month of typical Coursera pacing. */
  hoursPerMonth: number;
  /** Floor / ceiling for a single skill's coursework hours. */
  minSkillHours: number;
  maxSkillHours: number;
  /** Hours added when the skill carries a hands-on project. */
  projectHours: number;
  /** Hours for a milestone gate quiz (attempt + review). */
  quizHours: number;
  /** Global efficiency multiplier applied to everything (calibration lever). */
  pacingFactor: number;
}

export const DEFAULT_TIME_MODEL: TimeModelConstants = {
  hoursPerMonth: 14,
  minSkillHours: 6,
  maxSkillHours: 120,
  projectHours: 8,
  quizHours: 1,
  pacingFactor: 1,
};

export function skillHours(
  months: number,
  model: TimeModelConstants = DEFAULT_TIME_MODEL,
  depth = 0,
): number {
  const m = Number.isFinite(months) && months > 0 ? months : 2;
  const raw = m * model.hoursPerMonth + (depth > 0 ? depth * 4 : 0);
  return Math.round(Math.min(model.maxSkillHours, Math.max(model.minSkillHours, raw)) * model.pacingFactor);
}

export interface MilestoneTimeInput {
  skillHours: number;
  hasProject: boolean;
  hasQuiz: boolean;
  model?: TimeModelConstants;
}

export function milestoneHours(input: MilestoneTimeInput): number {
  const model = input.model ?? DEFAULT_TIME_MODEL;
  let hours = input.skillHours;
  if (input.hasProject) hours += model.projectHours;
  if (input.hasQuiz) hours += model.quizHours;
  return Math.round(hours);
}

/**
 * Distribute weekly capacity over ordered milestone hours, producing
 * per-milestone start/end dates. Deterministic: given the same inputs and
 * start date, the schedule is identical — which is what makes the time
 * simulator trustworthy.
 */
export interface ScheduleItem<H> {
  item: H;
  hours: number;
  startAt: Date;
  endAt: Date;
}

export function scheduleMilestones<H>(
  items: Array<{ item: H; hours: number }>,
  hoursPerWeek: number,
  startDate: Date,
): Array<ScheduleItem<H>> {
  const capacity = Math.max(1, hoursPerWeek);
  const DAY = 24 * 60 * 60 * 1000;
  let cursor = startDate.getTime();
  return items.map(({ item, hours }) => {
    const weeks = hours / capacity;
    const durationMs = Math.max(DAY, Math.round(weeks * 7 * DAY));
    const startAt = new Date(cursor);
    const endAt = new Date(cursor + durationMs);
    cursor = endAt.getTime() + DAY; // one rest day between milestones
    return { item, hours, startAt, endAt };
  });
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** e.g. "in 8 weeks" / "in 3 months" — human pacing for the UI. */
export function humanDuration(hours: number, hoursPerWeek: number): string {
  const weeks = Math.max(1, Math.round(hours / Math.max(1, hoursPerWeek)));
  if (weeks < 2) return "~1 week";
  if (weeks < 9) return `~${weeks} weeks`;
  const months = Math.round(weeks / 4.33);
  return `~${months} month${months > 1 ? "s" : ""}`;
}
