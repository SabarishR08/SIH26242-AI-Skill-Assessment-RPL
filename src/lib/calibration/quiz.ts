/**
 * Calibration — the claims-vs-evidence reconciliation loop.
 *
 * Gap detection: any skill where claimedLevel - evidencedLevel >= 2 is a
 * calibration candidate (a big self-report with thin proof). Each candidate
 * gets a short multiple-choice quiz pitched at the CLAIMED level:
 *
 *   pass  → tier "verified", evidencedLevel rises to the claim
 *   fail  → evidencedLevel drops toward demonstrated level, tier "claimed",
 *           remediation flag set
 *
 * Quiz generation is LLM-first; the deterministic fallback derives REAL
 * prerequisite questions from the skill graph ("Which skill must you learn
 * before X?") and course-catalogue questions — never lorem-ipsum placeholders.
 */
import { db } from "@/lib/db";
import { chatJson, asArray, asString, asInt } from "@/lib/ai/llm";
import { loadSkillGraph, loadCatalogue, loadResources } from "@/lib/engine/data";
import { ancestorClosure } from "@/lib/engine/graph";
import { applyQuizVerdict } from "@/lib/evidence/fuse";

export interface CalibrationGap {
  skillId: string;
  skillName: string;
  claimedLevel: number;
  evidencedLevel: number;
  gap: number;
  tier: string;
}

export interface QuizQuestionDraft {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  skillFocus?: string;
}

export async function detectGaps(learnerId: string): Promise<CalibrationGap[]> {
  const assessments = await db.skillAssessment.findMany({ where: { learnerId } });
  return assessments
    .filter((a) => a.claimedLevel - a.evidencedLevel >= 2 && a.claimedLevel >= 2)
    .map((a) => ({
      skillId: a.skillId,
      skillName: a.skillName,
      claimedLevel: a.claimedLevel,
      evidencedLevel: a.evidencedLevel,
      gap: a.claimedLevel - a.evidencedLevel,
      tier: a.tier,
    }))
    .sort((a, b) => b.gap - a.gap || b.claimedLevel - a.claimedLevel)
    .slice(0, 4);
}

// ─── Question generation ─────────────────────────────────────────────────────

async function generateQuestionsLlm(
  skillName: string,
  claimedLevel: number,
  domain: string,
  context: string,
): Promise<QuizQuestionDraft[] | null> {
  const result = await chatJson<QuizQuestionDraft[]>(
    [
      { role: "system", content: "You are a rigorous but fair technical assessor. Questions must have exactly one unambiguously correct option." },
      {
        role: "user",
        content: `Write 4 multiple-choice questions to verify someone's self-claimed level in "${skillName}" (${domain}).

They claim level ${claimedLevel}/5 (${claimedLevel <= 2 ? "guided practice" : claimedLevel <= 3 ? "independent practitioner" : "advanced"}).
Context about them: ${context || "none available"}

Difficulty must match the CLAIMED level — if they say level 4, ask level-4 questions, not level-1 trivia. Mix: one concept, one applied scenario, one "which approach fits this problem", one debugging/edge-case judgment.

Return JSON: array of 4 objects:
{"prompt": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0-3, "explanation": "why the answer is right", "skillFocus": "sub-topic"}

Options must be plausible; distractors should reflect real misconceptions.`,
      },
    ],
    (value) => {
      const arr = asArray(value);
      const drafts = arr
        .map((q) => {
          const obj = q as Record<string, unknown>;
          const prompt = asString(obj.prompt);
          const options = asArray(obj.options).map((o) => asString(o)).filter(Boolean);
          const correctIndex = asInt(obj.correctIndex, -1, 0, options.length - 1);
          if (!prompt || options.length < 3 || correctIndex < 0) return null;
          return {
            prompt,
            options: options.slice(0, 5),
            correctIndex,
            explanation: asString(obj.explanation, "Correct answer."),
            skillFocus: asString(obj.skillFocus) || undefined,
          } as QuizQuestionDraft;
        })
        .filter((q): q is QuizQuestionDraft => q !== null);
      return drafts.length >= 3 ? drafts : null;
    },
    { maxTokens: 1800, temperature: 0.5 },
  );
  return result?.value ?? null;
}

/** Real questions derived from the prerequisite DAG and course catalogue. */
async function generateQuestionsDeterministic(skillId: string): Promise<QuizQuestionDraft[]> {
  const graph = await loadSkillGraph();
  const catalogue = await loadCatalogue();
  const node = graph.skills[skillId];
  if (!node) return [];
  const drafts: QuizQuestionDraft[] = [];

  // Q1: prerequisites — the graph ground truth.
  if (node.prereqs.length) {
    const correct = node.prereqs.map((p) => graph.skills[p]?.name ?? p);
    const distractorPool = Object.values(graph.skills)
      .filter((s) => s.domain === node.domain && !node.prereqs.includes(s.id) && s.id !== node.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((s) => s.name);
    if (distractorPool.length >= 2) {
      const options = [...correct.slice(0, 1), ...distractorPool];
      drafts.push({
        prompt: `Which skill is a direct prerequisite for ${node.name}?`,
        options,
        correctIndex: 0,
        explanation: `According to the ${node.domain} skill graph, ${correct[0]} must be learned before ${node.name}.`,
        skillFocus: "Prerequisites",
      });
    }
  }

  // Q2-Q3: what real courses teach for this skill (course descriptions).
  const courseIds = catalogue.coursesForSkill[skillId] ?? [];
  const topCourses = courseIds.map((id) => catalogue.byId[id]).filter(Boolean).slice(0, 4);
  for (const course of topCourses.slice(0, 2)) {
    const intro = course.ShortIntro || `${course.Title} covers ${node.name}.`;
    const others = topCourses.filter((c) => c.course_id !== course.course_id).map((c) => c.Title);
    const options = [course.Title, ...others].slice(0, 4);
    if (options.length >= 3) {
      drafts.push({
        prompt: `Which course, per its actual syllabus description, is the closest match here?\n\n"${intro.slice(0, 260)}"`,
        options,
        correctIndex: 0,
        explanation: `This is the catalogue description of "${course.Title}".`,
        skillFocus: "Course content",
      });
    }
  }

  // Q3-Q4: curated free resources for skills where course catalogue has no matches
  if (drafts.length < 4) {
    const resources = await loadResources();
    const freeRes = resources.bySkill[skillId] ?? [];
    for (const r of freeRes) {
      if (drafts.length >= 4) break;
      const distractors = resources.resources
        .filter((other) => other.resource_id !== r.resource_id)
        .slice(0, 3)
        .map((other) => other.title);
      if (distractors.length >= 2) {
        drafts.push({
          prompt: `Which learning resource provides foundational coverage for ${node.name}?\n\n"${r.description_raw}"`,
          options: [r.title, ...distractors].slice(0, 4),
          correctIndex: 0,
          explanation: `"${r.title}" is the designated resource covering ${node.name}.`,
          skillFocus: "Core concepts",
        });
      }
    }
  }

  // Fallback: domain competency questions if graph and catalogue are sparse
  if (drafts.length < 4) {
    const siblingSkills = Object.values(graph.skills)
      .filter((s) => s.domain === node.domain && s.id !== node.id)
      .slice(0, 3)
      .map((s) => s.name);
    if (siblingSkills.length >= 2) {
      drafts.push({
        prompt: `In the domain of ${node.domain}, what is the primary role of ${node.name}?`,
        options: [
          `Establishing core competency and practical implementation of ${node.name}`,
          ...siblingSkills.map((s) => `Serving strictly as an alternative replacement for ${s}`),
        ].slice(0, 4),
        correctIndex: 0,
        explanation: `${node.name} is an essential competency within ${node.domain}.`,
        skillFocus: "Domain context",
      });
    }
  }

  return drafts.slice(0, 4);
}

export async function createCalibrationQuiz(
  learnerId: string,
  gap: CalibrationGap,
): Promise<{ quizId: string; questions: QuizQuestionDraft[]; mode: "llm" | "deterministic" }> {
  const graph = await loadSkillGraph();
  const node = graph.skills[gap.skillId];
  const domain = node?.domain ?? "General";
  const learner = await db.learner.findUnique({ where: { id: learnerId } });
  const context = learner ? `Goal: ${learner.goalStatement ?? "unknown"}; background from onboarding interview.` : "";

  const llmQuestions = await generateQuestionsLlm(gap.skillName, gap.claimedLevel, domain, context);
  const questions = llmQuestions ?? (await generateQuestionsDeterministic(gap.skillId));
  const mode: "llm" | "deterministic" = llmQuestions ? "llm" : "deterministic";

  const quiz = await db.quiz.create({
    data: {
      learnerId,
      kind: "calibration",
      skillId: gap.skillId,
      skillName: gap.skillName,
      passScore: 0.75,
    },
  });

  await db.quizQuestion.createMany({
    data: questions.map((q, i) => ({
      quizId: quiz.id,
      order: i,
      prompt: q.prompt,
      optionsJson: JSON.stringify(q.options),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      skillFocus: q.skillFocus ?? null,
    })),
  });

  return { quizId: quiz.id, questions, mode };
}

export interface QuizGradeResult {
  score: number;
  passed: boolean;
  breakdown: Array<{ questionId: string; correct: boolean; chosenIndex: number; correctIndex: number; explanation: string }>;
  verdict: string;
}

/**
 * Gate quiz for a milestone: covers ALL skills in the phase, pitched at the
 * required level (depth-derived), not the claimed level.
 */
export async function createGateQuiz(learnerId: string, milestoneId: string): Promise<{ quizId: string; questions: QuizQuestionDraft[]; mode: "llm" | "deterministic" }> {
  const milestone = await db.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) throw new Error("Milestone not found");
  const skillIds = JSON.parse(milestone.skillIdsJson) as string[];
  const skillNames = JSON.parse(milestone.skillNamesJson) as string[];

  // Pitch at required level 3 (independent use) — gate = "can you use this without hand-holding".
  const llmQuestions = await generateQuestionsLlmMulti(skillNames, 3, "milestone gate");
  const questions = llmQuestions ?? (await generateQuestionsDeterministicMulti(skillIds));
  const mode: "llm" | "deterministic" = llmQuestions ? "llm" : "deterministic";

  const quiz = await db.quiz.create({
    data: {
      learnerId,
      kind: "milestone_gate",
      milestoneId,
      skillId: skillIds[0] ?? null,
      skillName: skillNames.join(", ").slice(0, 200),
      passScore: 0.75,
    },
  });
  await db.quizQuestion.createMany({
    data: questions.map((q, i) => ({
      quizId: quiz.id,
      order: i,
      prompt: q.prompt,
      optionsJson: JSON.stringify(q.options),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      skillFocus: q.skillFocus ?? null,
    })),
  });
  return { quizId: quiz.id, questions, mode };
}

async function generateQuestionsLlmMulti(skillNames: string[], level: number, context: string): Promise<QuizQuestionDraft[] | null> {
  const result = await chatJson<QuizQuestionDraft[]>(
    [
      { role: "system", content: "You are a rigorous but fair technical assessor. Exactly one unambiguously correct option per question." },
      {
        role: "user",
        content: `Write 4 multiple-choice questions covering these skills: ${skillNames.join(", ")} (${context} check). Pitched at level ${level}/5 (independent practical use). Mix concepts, applied scenarios, and judgment calls.

Return JSON: array of 4 objects {"prompt", "options": [4 strings], "correctIndex": 0-3, "explanation", "skillFocus"}. Distractors must reflect real misconceptions.`,
      },
    ],
    (value) => {
      const arr = asArray(value);
      const drafts = arr
        .map((q) => {
          const obj = q as Record<string, unknown>;
          const prompt = asString(obj.prompt);
          const options = asArray(obj.options).map((o) => asString(o)).filter(Boolean);
          const correctIndex = asInt(obj.correctIndex, -1, 0, options.length - 1);
          if (!prompt || options.length < 3 || correctIndex < 0) return null;
          return { prompt, options: options.slice(0, 5), correctIndex, explanation: asString(obj.explanation, "Correct answer."), skillFocus: asString(obj.skillFocus) || undefined } as QuizQuestionDraft;
        })
        .filter((q): q is QuizQuestionDraft => q !== null);
      return drafts.length >= 3 ? drafts : null;
    },
    { maxTokens: 1800, temperature: 0.5 },
  );
  return result?.value ?? null;
}

async function generateQuestionsDeterministicMulti(skillIds: string[]): Promise<QuizQuestionDraft[]> {
  const drafts: QuizQuestionDraft[] = [];
  for (const sid of skillIds) {
    const qs = await generateQuestionsDeterministic(sid);
    for (const q of qs) {
      drafts.push(q);
      if (drafts.length >= 4) return drafts;
    }
  }
  return drafts.slice(0, 4);
}

export async function gradeQuiz(quizId: string, answers: number[]): Promise<QuizGradeResult> {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
  if (!quiz) throw new Error("Quiz not found");
  const ordered = [...quiz.questions].sort((a, b) => a.order - b.order);

  const breakdown = ordered.map((q, i) => {
    const chosen = answers[i] ?? -1;
    return {
      questionId: q.id,
      correct: chosen === q.correctIndex,
      chosenIndex: chosen,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    };
  });
  const correctCount = breakdown.filter((b) => b.correct).length;
  const score = ordered.length ? correctCount / ordered.length : 0;
  const passed = score >= quiz.passScore;

  await db.quizAttempt.create({
    data: {
      quizId,
      answersJson: JSON.stringify(answers),
      score,
      passed,
      breakdownJson: JSON.stringify(breakdown),
    },
  });
  await db.quiz.update({ where: { id: quizId }, data: { status: passed ? "passed" : "failed" } });

  if (quiz.kind === "calibration" && quiz.skillId) {
    // Calibration quizzes target the claimed level; recover it from the assessment.
    const assessment = await db.skillAssessment.findUnique({
      where: { learnerId_skillId: { learnerId: quiz.learnerId, skillId: quiz.skillId } },
    });
    const claimed = assessment?.claimedLevel ?? 3;
    await applyQuizVerdict(quiz.learnerId, quiz.skillId, quiz.skillName ?? "unknown", passed, claimed, score);
    await db.activityLog.create({
      data: {
        learnerId: quiz.learnerId,
        kind: passed ? "calibrated" : "quiz_failed",
        detailJson: JSON.stringify({ skillId: quiz.skillId, skillName: quiz.skillName, score, quizKind: quiz.kind }),
      },
    });
  }

  if (quiz.kind === "milestone_gate" && quiz.milestoneId && passed) {
    // Gate passed → milestone completes, next unlocks, path replans with fresh evidence.
    const milestone = await db.milestone.findUnique({ where: { id: quiz.milestoneId } });
    if (milestone && milestone.status !== "complete") {
      const skillIds = JSON.parse(milestone.skillIdsJson) as string[];
      const skillNames = JSON.parse(milestone.skillNamesJson) as string[];
      for (let i = 0; i < skillIds.length; i++) {
        await applyQuizVerdict(quiz.learnerId, skillIds[i], skillNames[i] ?? skillIds[i], true, 3, score);
      }
      await db.milestone.update({ where: { id: milestone.id }, data: { status: "complete", completedAt: new Date() } });
      const { unlockNext } = await import("@/lib/path/replan");
      await unlockNext(milestone.pathId);
      await db.activityLog.create({
        data: {
          learnerId: quiz.learnerId,
          kind: "milestone_completed",
          detailJson: JSON.stringify({ milestoneId: milestone.id, title: milestone.title, via: "gate_quiz", score }),
        },
      });
    }
  }

  if (quiz.kind === "milestone_gate" && !passed) {
    await db.activityLog.create({
      data: {
        learnerId: quiz.learnerId,
        kind: "quiz_failed",
        detailJson: JSON.stringify({ milestoneId: quiz.milestoneId, skillName: quiz.skillName, score, quizKind: quiz.kind }),
      },
    });
  }

  const verdict = passed
    ? `Verified — your ${quiz.skillName ?? "skill"} level is now backed by a passing score (${Math.round(score * 100)}%).`
    : `Not verified yet — ${Math.round(score * 100)}%. Your evidenced level was adjusted down; the plan will include a refresher before you build on this skill.`;

  return { score, passed, breakdown, verdict };
}
