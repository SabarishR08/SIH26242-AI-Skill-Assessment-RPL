import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";
import { computeWeeklyMetrics } from "@/lib/coach";
import { detectGaps } from "@/lib/calibration/quiz";
import { computeRadar } from "@/lib/engine/radar";
import { loadSkillGraph, computeDepths } from "@/lib/engine";

export const dynamic = "force-dynamic";

/** Aggregated dashboard payload: profile, path, radar, next actions, activity, coach. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const [activePath, assessments, activities, evidence, gaps, weeklyReport] = await Promise.all([
      db.learningPath.findFirst({ where: { learnerId, isActive: true }, include: { milestones: true } }),
      db.skillAssessment.findMany({ where: { learnerId } }),
      db.activityLog.findMany({ where: { learnerId }, orderBy: { createdAt: "desc" }, take: 15 }),
      db.evidenceItem.findMany({ where: { learnerId }, orderBy: { createdAt: "desc" }, take: 20 }),
      detectGaps(learnerId),
      db.weeklyReport.findFirst({ where: { learnerId }, orderBy: { createdAt: "desc" } }),
    ]);

    const graph = await loadSkillGraph();
    const depths = computeDepths(graph);

    const ordered = activePath ? [...activePath.milestones].sort((a, b) => a.order - b.order) : [];
    const completed = ordered.filter((m) => m.status === "complete").length;
    const current = ordered.find((m) => m.status === "in_progress" || m.status === "available");
    const nextMilestone = current
      ? {
          id: current.id,
          phase: current.phase,
          title: current.title,
          hours: current.estimatedHours,
          status: current.status,
          hasProject: current.hasProject,
          targetEnd: current.targetEndAt?.toISOString().slice(0, 10) ?? null,
        }
      : null;

    // Next-best-actions (deterministic priority ladder).
    const actions: Array<{ kind: string; label: string; detail: string }> = [];
    if (!activePath) {
      actions.push({ kind: "generate_path", label: "Generate your learning path", detail: "Pick a scenario and get your roadmap" });
    }
    if (gaps.length) {
      actions.push({
        kind: "calibrate",
        label: `Calibrate "${gaps[0].skillName}"`,
        detail: `Claimed ${gaps[0].claimedLevel}/5 vs evidenced ${gaps[0].evidencedLevel}/5 — take a 4-question check`,
      });
    }
    if (evidence.filter((e) => e.source === "github").length === 0) {
      actions.push({ kind: "connect_github", label: "Connect GitHub", detail: "Turn your repositories into skill proof" });
    }
    if (current?.status === "available") {
      actions.push({ kind: "start_milestone", label: `Start "${current.title}"`, detail: `${current.phase} · ~${current.estimatedHours}h` });
    }
    if (current?.status === "in_progress" && current.hasProject) {
      actions.push({ kind: "submit_project", label: "Submit your project repo", detail: "Proof beats completion — get it evaluated" });
    }
    const pendingQuiz = activePath
      ? await db.quiz.findFirst({ where: { learnerId, milestoneId: current?.id, status: "pending", kind: "milestone_gate" } })
      : null;
    if (pendingQuiz && current?.status === "in_progress") {
      actions.push({ kind: "gate_quiz", label: "Take the gate quiz", detail: `Pass to complete ${current.phase}` });
    }

    const metrics = await computeWeeklyMetrics(learnerId);

    // Radar against the learner's goal.
    const goalSkillId = learner.goalSkillId ?? "ds_datascience";
    const radar = computeRadar(
      graph,
      assessments.map((a) => ({ skillId: a.skillId, claimedLevel: a.claimedLevel, evidencedLevel: a.evidencedLevel })),
      goalSkillId,
      depths,
    );

    const milestonesForChart = ordered.map((m) => ({
      phase: m.phase,
      title: m.title,
      status: m.status,
      hours: m.estimatedHours,
      end: m.targetEndAt?.toISOString().slice(0, 10) ?? null,
    }));

    // 4-week momentum: activity per day (last 28 days), from ActivityLog.
    const allActivities = await db.activityLog.findMany({
      where: { learnerId, createdAt: { gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "asc" },
    });
    const momentumBuckets: Array<{ day: string; count: number }> = [];
    for (let w = 3; w >= 0; w--) {
      const start = new Date(Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
      const count = allActivities.filter((a) => a.createdAt >= start && a.createdAt < end).length;
      momentumBuckets.push({ day: `W-${w}`, count });
    }

    return json({
      learner: {
        id: learner.id,
        name: learner.name,
        goalStatement: learner.goalStatement,
        targetRole: learner.targetRole,
        domain: learner.domain,
        goalSkillName: learner.goalSkillId ? (graph.skills[learner.goalSkillId]?.name ?? null) : null,
        hoursPerWeek: learner.hoursPerWeek,
        onboardingStage: learner.onboardingStage,
      },
      path: activePath
        ? {
            id: activePath.id,
            version: activePath.version,
            scenario: activePath.scenario,
            algorithm: activePath.algorithm,
            replanReason: activePath.replanReason,
            totalHours: activePath.totalHours,
            progress: {
              completed,
              total: ordered.length,
              percent: ordered.length ? Math.round((completed / ordered.length) * 100) : 0,
            },
            milestones: milestonesForChart,
            nextMilestone,
          }
        : null,
      skills: {
        tiers: {
          proven: assessments.filter((a) => a.tier === "proven").length,
          verified: assessments.filter((a) => a.tier === "verified").length,
          claimed: assessments.filter((a) => a.tier === "claimed").length,
          inferred: assessments.filter((a) => a.tier === "inferred").length,
        },
        top: assessments
          .sort((a, b) => b.evidencedLevel - a.evidencedLevel)
          .slice(0, 8)
          .map((a) => ({ name: a.skillName, claimed: a.claimedLevel, evidenced: a.evidencedLevel, tier: a.tier })),
        gaps: gaps.slice(0, 3),
      },
      radar: { axes: radar.axes, goalSkillName: graph.skills[goalSkillId]?.name ?? goalSkillId },
      actions,
      activity: activities.map((a) => ({
        kind: a.kind,
        detail: (() => {
          try {
            return JSON.parse(a.detailJson || "{}");
          } catch {
            return {};
          }
        })(),
        at: a.createdAt.toISOString(),
      })),
      evidence: evidence.map((e) => ({ source: e.source, sourceRef: e.sourceRef, summary: e.summary, at: e.createdAt.toISOString() })),
      weekly: weeklyReport
        ? { weekOf: weeklyReport.weekOf, content: weeklyReport.content, metrics: JSON.parse(weeklyReport.metricsJson) }
        : null,
      momentum: momentumBuckets,
      metrics,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to load dashboard", 500);
  }
}
