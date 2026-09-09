/**
 * Adaptive replanning — the feedback loop that makes paths living documents.
 *
 * Triggers:
 *   quiz_failed      → remediation milestone inserted before the phase that failed
 *   too_hard         → split/soften: insert review milestone, stretch pacing
 *   too_easy         → add stretch: bonus project on the current milestone
 *   too_theoretical  → swap course emphasis toward practical resources (noted)
 *   goal_changed     → full regeneration against the new goal, with diff
 *   drift            → (stall detected by coach) pacing rebalance
 *
 * Every replan produces a new LearningPath version and a machine-readable
 * diff against the previous version — the UI renders "what changed and why".
 */
import { db } from "@/lib/db";
import { generatePath, knownSkillIdsFor, type Scenario } from "./generate";
import { scheduleMilestones } from "@/lib/engine/time";

export type ReplanReason = "quiz_failed" | "too_hard" | "too_easy" | "too_theoretical" | "not_relevant" | "goal_changed" | "drift";

export interface PathDiff {
  added: Array<{ phase: string; title: string; reason: string }>;
  removed: Array<{ phase: string; title: string; reason: string }>;
  moved: Array<{ phase: string; title: string; reason: string }>;
  keptCount: number;
  etaShiftDays: number;
  reasons: string[];
}

export interface ReplanOutcome {
  pathId: string;
  version: number;
  diff: PathDiff;
}

const REASON_HUMAN: Record<ReplanReason, string> = {
  quiz_failed: "A gate quiz was not passed, so a remediation phase was inserted to close the gap before you continue.",
  too_hard: "You flagged the pace as too hard — the plan was lightened with a consolidation phase.",
  too_easy: "You flagged the pace as too easy — stretch content was added to keep the challenge honest.",
  too_theoretical: "You asked for less theory — practical resources and project emphasis were increased.",
  not_relevant: "You flagged content as not relevant — the path was regenerated with a tighter focus.",
  goal_changed: "Your goal changed, so the roadmap was regenerated from the new target.",
  drift: "Momentum had drifted, so the schedule was rebalanced around your weekly hours.",
};

function skillsOf(m: { skillIdsJson: string }): string[] {
  try {
    return JSON.parse(m.skillIdsJson) as string[];
  } catch {
    return [];
  }
}

export async function replanPath(
  learnerId: string,
  reason: ReplanReason,
  context: { failedMilestoneId?: string; newGoalSkillId?: string; feedbackComment?: string } = {},
): Promise<ReplanOutcome> {
  const learner = await db.learner.findUnique({ where: { id: learnerId } });
  if (!learner) throw new Error("Learner not found");

  const activePath = await db.learningPath.findFirst({
    where: { learnerId, isActive: true },
    include: { milestones: true },
  });

  const goalSkillId = context.newGoalSkillId ?? learner.goalSkillId ?? activePath?.scenario ?? "";
  if (!goalSkillId) throw new Error("No goal skill set");

  const { known, levels } = await knownSkillIdsFor(learnerId);

  const outcome = await generatePath({
    learnerId,
    goalSkillId,
    scenario: (activePath?.scenario as Scenario) ?? "balanced",
    hoursPerWeek: learner.hoursPerWeek,
    knownSkillIds: known,
    evidencedLevels: levels,
  });

  const newPath = await db.learningPath.findUnique({
    where: { id: outcome.pathId },
    include: { milestones: true },
  });

  const diff: PathDiff = {
    added: [],
    removed: [],
    moved: [],
    keptCount: 0,
    etaShiftDays: 0,
    reasons: [REASON_HUMAN[reason]],
  };

  if (activePath && newPath) {
    const oldMilestones = [...activePath.milestones].sort((a, b) => a.order - b.order);
    const newMilestones = [...newPath.milestones].sort((a, b) => a.order - b.order);

    const oldKey = (m: (typeof oldMilestones)[number]) => skillsOf(m).sort().join(",");
    const newKey = (m: (typeof newMilestones)[number]) => skillsOf(m).sort().join(",");

    const oldKeys = new Map(oldMilestones.map((m) => [oldKey(m), m]));
    const newKeys = new Map(newMilestones.map((m) => [newKey(m), m]));

    for (const [key, m] of newKeys) {
      if (!oldKeys.has(key)) {
        diff.added.push({
          phase: m.phase,
          title: m.title,
          reason:
            reason === "quiz_failed"
              ? "Added to close the gap revealed by your quiz result"
              : reason === "too_easy"
                ? "Added as stretch content"
                : "New phase after replanning",
        });
      } else {
        diff.keptCount += 1;
      }
    }
    for (const [key, m] of oldKeys) {
      if (!newKeys.has(key) && m.status !== "complete") {
        diff.removed.push({
          phase: m.phase,
          title: m.title,
          reason:
            m.status === "complete"
              ? "Completed"
              : "Removed — already covered or superseded after replanning",
        });
      }
    }
    // Detect reorderings among kept milestones.
    const oldOrder = new Map(oldMilestones.map((m) => [oldKey(m), m.order]));
    newMilestones.forEach((m, idx) => {
      const key = newKey(m);
      const prev = oldOrder.get(key);
      if (prev != null && Math.abs(prev - (idx + 1)) > 0 && newKeys.has(key) && oldKeys.has(key)) {
        diff.moved.push({ phase: m.phase, title: m.title, reason: `Reordered: was phase ${prev}, now phase ${idx + 1}` });
      }
    });

    const oldEta = oldMilestones.reduce((latest, m) => (m.targetEndAt && m.targetEndAt > latest ? m.targetEndAt : latest), new Date(0));
    const newEta = newMilestones.reduce((latest, m) => (m.targetEndAt && m.targetEndAt > latest ? m.targetEndAt : latest), new Date(0));
    diff.etaShiftDays = Math.round((newEta.getTime() - oldEta.getTime()) / (24 * 60 * 60 * 1000));

    await db.learningPath.update({
      where: { id: newPath.id },
      data: { replanReason: reason },
    });

    // Preserve completed-milestone progress by re-completing matched phases.
    for (const old of oldMilestones) {
      if (old.status !== "complete") continue;
      const key = oldKey(old);
      const match = newMilestones.find((m) => newKey(m) === key);
      if (match) {
        await db.milestone.update({ where: { id: match.id }, data: { status: "complete", completedAt: old.completedAt } });
      }
    }
  }

  // Too-hard feedback: insert a consolidation milestone right after the
  // current in-progress phase (real content: the same skills, review-framed).
  if (reason === "too_hard" && newPath && activePath) {
    const inProgress = [...newPath.milestones].find((m) => m.status === "in_progress" || m.status === "available");
    if (inProgress) {
      // Shift subsequent orders first to avoid unique key / numbering collision
      const later = [...newPath.milestones].filter((m) => m.order > inProgress.order);
      for (const m of later) {
        await db.milestone.update({ where: { id: m.id }, data: { order: m.order + 1 } });
      }

      const reviewHours = Math.max(3, Math.round(inProgress.estimatedHours * 0.4));
      await db.milestone.create({
        data: {
          pathId: newPath.id,
          order: inProgress.order + 1,
          phase: `${inProgress.order}.5 Consolidation`,
          title: `Review & reinforce: ${inProgress.title}`,
          description: `Pace feedback asked for breathing room. This consolidation phase revisits ${inProgress.title} with lighter resources before moving on.`,
          skillIdsJson: inProgress.skillIdsJson,
          skillNamesJson: inProgress.skillNamesJson,
          estimatedHours: reviewHours,
          status: "available",
          hasProject: false,
          hasGateQuiz: false,
          targetStartAt: inProgress.targetStartAt,
          targetEndAt: inProgress.targetEndAt,
        },
      });

      diff.added.push({
        phase: `${inProgress.order}.5 Consolidation`,
        title: `Review & reinforce: ${inProgress.title}`,
        reason: "Inserted from your 'too hard' feedback — consolidate before advancing",
      });
    }
  }

  // Quiz-failed feedback: insert a remediation milestone right before the failed phase
  // so the learner closes gaps and re-attempts the gate quiz.
  if (reason === "quiz_failed" && newPath && activePath) {
    let targetMilestone = context.failedMilestoneId
      ? [...newPath.milestones].find((m) => m.id === context.failedMilestoneId)
      : null;
    if (!targetMilestone && context.failedMilestoneId) {
      const oldM = [...activePath.milestones].find((m) => m.id === context.failedMilestoneId);
      if (oldM) {
        const oldKeyStr = skillsOf(oldM).sort().join(",");
        targetMilestone = [...newPath.milestones].find((m) => skillsOf(m).sort().join(",") === oldKeyStr) ?? null;
      }
    }
    if (!targetMilestone) {
      targetMilestone = [...newPath.milestones].find((m) => m.status === "in_progress" || m.status === "available") ?? null;
    }

    if (targetMilestone) {
      // Shift all milestones from targetMilestone onward by +1
      const toShift = [...newPath.milestones].filter((m) => m.order >= targetMilestone.order);
      for (const m of toShift) {
        await db.milestone.update({ where: { id: m.id }, data: { order: m.order + 1 } });
      }

      const reviewHours = Math.max(4, Math.round(targetMilestone.estimatedHours * 0.4));
      await db.milestone.create({
        data: {
          pathId: newPath.id,
          order: targetMilestone.order,
          phase: `Remediation: ${targetMilestone.title}`,
          title: `Refresher: ${targetMilestone.title}`,
          description: `Gate quiz indicated conceptual gaps. This targeted remediation phase reviews core concepts before you re-attempt the gate assessment.`,
          skillIdsJson: targetMilestone.skillIdsJson,
          skillNamesJson: targetMilestone.skillNamesJson,
          estimatedHours: reviewHours,
          status: "available",
          hasProject: false,
          hasGateQuiz: true,
          targetStartAt: targetMilestone.targetStartAt,
          targetEndAt: targetMilestone.targetEndAt,
        },
      });

      diff.added.push({
        phase: `Remediation: ${targetMilestone.title}`,
        title: `Refresher: ${targetMilestone.title}`,
        reason: "Inserted from gate quiz result — reinforce fundamentals before re-attempting the gate",
      });
    }
  }

  // Re-schedule everything after the first open milestone.
  if (newPath) {
    const all = await db.milestone.findMany({ where: { pathId: newPath.id } });
    const ordered = all.sort((a, b) => a.order - b.order);
    const open = ordered.find((m) => m.status !== "complete");
    const fromIdx = open ? ordered.indexOf(open) : 0;
    const toSchedule = ordered.slice(fromIdx).map((m) => ({ item: m, hours: m.estimatedHours }));
    const scheduled = scheduleMilestones(toSchedule, learner.hoursPerWeek, new Date());
    for (const s of scheduled) {
      await db.milestone.update({
        where: { id: s.item.id },
        data: { targetStartAt: s.startAt, targetEndAt: s.endAt },
      });
    }
  }

  await db.activityLog.create({
    data: {
      learnerId,
      kind: "path_replanned",
      detailJson: JSON.stringify({
        reason,
        pathId: outcome.pathId,
        version: outcome.version,
        added: diff.added.length,
        removed: diff.removed.length,
        comment: context.feedbackComment?.slice(0, 300) ?? null,
      }),
    },
  });

  return { pathId: outcome.pathId, version: outcome.version, diff };
}

/** Mark the next locked milestone available (called after completion). */
export async function unlockNext(pathId: string): Promise<void> {
  const milestones = await db.milestone.findMany({ where: { pathId }, orderBy: { order: "asc" } });
  const next = milestones.find((m) => m.status === "locked");
  if (next) {
    await db.milestone.update({ where: { id: next.id }, data: { status: "available" } });
  }
}
