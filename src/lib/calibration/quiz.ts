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
  const rawGaps = assessments
    .filter((a) => a.claimedLevel - a.evidencedLevel >= 2 && a.claimedLevel >= 2)
    .map((a) => ({
      skillId: a.skillId,
      skillName: a.skillName,
      claimedLevel: a.claimedLevel,
      evidencedLevel: a.evidencedLevel,
      gap: a.claimedLevel - a.evidencedLevel,
      tier: a.tier,
    }))
    .sort((a, b) => b.gap - a.gap || b.claimedLevel - a.claimedLevel);

  // PF-17: Deduplicate gaps by normalized skillName so twins across domains (e.g. ds_ml_intro vs ml_ml)
  // do not produce redundant duplicate quiz cards for the same competence
  const seenNames = new Set<string>();
  const deduped: CalibrationGap[] = [];
  for (const g of rawGaps) {
    const key = g.skillName.trim().toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      deduped.push(g);
    }
  }
  return deduped.slice(0, 4);
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

Difficulty must match the CLAIMED level — if they say level 4, ask level-4 questions, not level-1 trivia. For software, programming, or web skills, at least one question must be a code debugging or inspection challenge with a fenced code block (\`\`\`language ... \`\`\`) in the prompt testing real error spotting.

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

const CODE_DEBUG_CHALLENGES: Record<string, QuizQuestionDraft> = {
  python: {
    prompt: `Code Inspection Challenge: Review this Python data parsing function:\n\n\`\`\`python\ndef parse_records(data):\n    records = []\n    for item in data:\n        record = {}\n        record["val"] = item["val"]\n        records.append(record)\n    return records\n\`\`\`\nWhat runtime exception occurs if an element in \`data\` is missing the \`"val"\` key?`,
    options: [
      "KeyError is raised because dictionary indexing lacks fallback handling",
      "TypeError is raised because dictionaries are immutable",
      "IndexError is raised when appending to records",
      "SyntaxError occurs during dictionary key evaluation",
    ],
    correctIndex: 0,
    explanation: "Direct dictionary indexing item['val'] throws a KeyError if the key is missing. Using item.get('val') provides safe fallback.",
    skillFocus: "Code Debugging",
  },
  javascript: {
    prompt: `Code Inspection Challenge: Review this asynchronous JavaScript function:\n\n\`\`\`javascript\nasync function loadAll(ids) {\n  const results = ids.map(async (id) => {\n    return await fetchItem(id);\n  });\n  return results.filter(r => r !== null);\n}\n\`\`\`\nWhat is the primary bug in this implementation?`,
    options: [
      "results is an array of unresolved Promises, so .filter() runs synchronously before data arrives",
      "map cannot accept an async callback in modern JavaScript",
      "await is invalid inside an arrow function body",
      "fetchItem must be invoked without await",
    ],
    correctIndex: 0,
    explanation: "Array.map with an async function produces an array of pending Promises. You must await Promise.all(results) before filtering.",
    skillFocus: "Code Debugging",
  },
  sql: {
    prompt: `Code Inspection Challenge: Review this SQL aggregation query:\n\n\`\`\`sql\nSELECT department_id, COUNT(*) as headcount\nFROM employees\nWHERE headcount > 10\nGROUP BY department_id;\n\`\`\`\nWhy will this query fail in standard SQL?`,
    options: [
      "Aggregated filters must be placed in a HAVING clause, not a WHERE clause",
      "COUNT(*) cannot be aliased using the AS keyword",
      "GROUP BY must be placed before the WHERE clause",
      "department_id must be wrapped in an aggregate function",
    ],
    correctIndex: 0,
    explanation: "WHERE filters rows before aggregation occurs. Conditions on aggregate expressions (like COUNT(*) > 10) must be evaluated in a HAVING clause.",
    skillFocus: "Code Debugging",
  },
  programming: {
    prompt: `Code Inspection Challenge: Review this recursive computation:\n\n\`\`\`python\ndef compute(n):\n    if n == 0: return 0\n    return compute(n - 1) + compute(n - 2)\n\`\`\`\nWhat critical edge case or flaw is present?`,
    options: [
      "Inputs with n < 0 trigger infinite recursion / RecursionError, and lack of base case for n=1 causes exponential duplicate calls",
      "Recursive functions in Python cannot return sums of recursive calls",
      "The return keyword is invalid inside an if block",
      "Integers cannot be compared to zero using ==",
    ],
    correctIndex: 0,
    explanation: "Without handling n <= 0 properly and lacking a base case for n=1, negative inputs blow the call stack and positive inputs suffer O(2^n) exponential calls.",
    skillFocus: "Code Debugging",
  },
  react: {
    prompt: `Code Inspection Challenge: Review this React state updater:\n\n\`\`\`javascript\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  const incrementTwice = () => {\n    setCount(count + 1);\n    setCount(count + 1);\n  };\n  return <button onClick={incrementTwice}>{count}</button>;\n}\n\`\`\`\nWhy does clicking increment the count by only 1 instead of 2?`,
    options: [
      "State updates are batched and both setCount calls close over the same stale count value",
      "useState hooks only allow one state update per render cycle",
      "React requires setCount to return a Promise",
      "Arrow functions create an isolated scope where state mutations are ignored",
    ],
    correctIndex: 0,
    explanation: "Both setCount calls read the same count snapshot from the render scope. Using functional updater setCount(c => c + 1) reads current state.",
    skillFocus: "Frontend Architecture",
  },
  ml: {
    prompt: `Code Inspection Challenge: Review this machine learning preprocessing snippet:\n\n\`\`\`python\nscaler = StandardScaler()\nX_train_scaled = scaler.fit_transform(X_train)\nX_test_scaled = scaler.fit_transform(X_test)\n\`\`\`\nWhat methodological flaw is introduced by this code?`,
    options: [
      "Data leakage: fit_transform on test data fits scaler parameters to test distribution instead of using transform(X_test)",
      "StandardScaler requires input arrays to be transposed before scaling",
      "fit_transform must only be called after model training",
      "StandardScaler produces negative standard deviations when invoked twice",
    ],
    correctIndex: 0,
    explanation: "Calling fit_transform on test data causes data leakage by recalculating mean and variance from test data. Test data must only be transformed using scaler.transform(X_test).",
    skillFocus: "Machine Learning Rigor",
  },
  docker: {
    prompt: `Code Inspection Challenge: Review this Dockerfile snippet:\n\n\`\`\`dockerfile\nCOPY . .\nRUN npm install\nCMD ["node", "server.js"]\n\`\`\`\nWhy is this Docker layer ordering suboptimal for caching?`,
    options: [
      "Copying the full source tree before npm install invalidates dependency layer caching on any code change",
      "npm install cannot run after COPY commands in standard Docker syntax",
      "CMD must always appear before RUN instructions",
      "Node.js server files require explicit EXPOSE statements to compile",
    ],
    correctIndex: 0,
    explanation: "Copying package.json and package-lock.json first, running npm install, and then copying application source preserves Docker layer cache when code changes.",
    skillFocus: "DevOps & Containers",
  },
  security: {
    prompt: `Code Inspection Challenge: Review this backend authentication handler:\n\n\`\`\`javascript\nconst query = 'SELECT * FROM users WHERE email = \\'' + email + '\\' AND password = \\'' + password + '\\'';\nconst user = await db.raw(query);\n\`\`\`\nWhat severe vulnerability is present in this implementation?`,
    options: [
      "SQL Injection: unescaped string concatenation allows malicious input like ' OR '1'='1 to bypass authentication",
      "Buffer overflow in the query string allocation",
      "Cross-Site Scripting (XSS) in the database driver",
      "Denial of service caused by string concatenation overhead",
    ],
    correctIndex: 0,
    explanation: "Concatenating unescaped user input directly into SQL queries creates classic SQL Injection. Parameterized queries or prepared statements must always be used.",
    skillFocus: "Application Security",
  },
};

/** Real technical questions derived from the prerequisite DAG and software engineering principles. */
export async function generateQuestionsDeterministic(skillId: string, attemptSalt = 0): Promise<QuizQuestionDraft[]> {
  const graph = await loadSkillGraph();
  const node = graph.skills[skillId];
  if (!node) return [];
  const drafts: QuizQuestionDraft[] = [];

  // Q1: Code inspection challenge for technical / programming skills
  const lowerName = (node.name + " " + skillId + " " + node.domain).toLowerCase();
  for (const [key, challenge] of Object.entries(CODE_DEBUG_CHALLENGES)) {
    if (lowerName.includes(key)) {
      drafts.push(challenge);
      break;
    }
  }

  // Q2: Prerequisites — graph ground truth.
  if (node.prereqs.length) {
    const correct = node.prereqs.map((p) => graph.skills[p]?.name ?? p);
    const distractorPool = Object.values(graph.skills)
      .filter((s) => s.domain === node.domain && !node.prereqs.includes(s.id) && s.id !== node.id)
      .sort((a, b) => ((a.id.charCodeAt(0) + attemptSalt) % 7) - ((b.id.charCodeAt(0) + attemptSalt) % 7))
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

  // Q3: Downstream unlock / Architectural dependency
  const downstreamSkills = Object.values(graph.skills)
    .filter((s) => s.prereqs.includes(node.id))
    .map((s) => s.name);

  if (downstreamSkills.length > 0) {
    const correctDownstream = downstreamSkills[0];
    const distractorPool = Object.values(graph.skills)
      .filter((s) => s.domain !== node.domain || (!s.prereqs.includes(node.id) && s.id !== node.id))
      .sort((a, b) => ((a.name.length + attemptSalt) % 5) - ((b.name.length + attemptSalt) % 5))
      .slice(0, 3)
      .map((s) => s.name);

    if (distractorPool.length >= 2) {
      drafts.push({
        prompt: `Which advanced competency in the ${node.domain} curriculum directly builds upon mastering ${node.name}?`,
        options: [correctDownstream, ...distractorPool].slice(0, 4),
        correctIndex: 0,
        explanation: `${correctDownstream} requires foundational mastery of ${node.name}.`,
        skillFocus: "Curriculum Architecture",
      });
    }
  }

  // Q4: Engineering Tradeoffs
  if (drafts.length < 4) {
    drafts.push({
      prompt: `When designing software utilizing ${node.name}, which engineering principle is most critical for maintainability?`,
      options: [
        `Decoupling ${node.name} business logic and state management from external side-effects`,
        `Coupling all data operations directly to global execution scope`,
        `Omitting automated test coverage to prioritize quick iteration`,
        `Hardcoding deployment configuration and credentials directly in source modules`,
      ],
      correctIndex: 0,
      explanation: `Modular architecture and clean separation of concerns ensure ${node.name} implementations remain testable, secure, and scalable.`,
      skillFocus: "Engineering Tradeoffs",
    });
  }

  // Q5: Diagnostic & Failure Mode
  if (drafts.length < 4) {
    drafts.push({
      prompt: `In a production environment implementing ${node.name}, what is the primary diagnostic indicator of system degradation?`,
      options: [
        `Elevated latency spikes, resource leaks, or unhandled exceptions under peak workload`,
        `Immediate automated compilation of client assets into binary executables`,
        `Spontaneous inversion of numerical arithmetic operators in the standard library`,
        `Loss of file permissions caused by static type checking`,
      ],
      correctIndex: 0,
      explanation: `Production failures in ${node.name} typically manifest through unhandled edge cases, latency spikes, or memory growth under concurrent load.`,
      skillFocus: "Operational Diagnosis",
    });
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
  const rawQuestions = llmQuestions ?? (await generateQuestionsDeterministic(gap.skillId));
  const questions = rawQuestions.map(shuffleQuestionDraft);
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

export function shuffleQuestionDraft(draft: QuizQuestionDraft): QuizQuestionDraft {
  const correctOption = draft.options[draft.correctIndex];
  const shuffled = [...draft.options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const newIndex = shuffled.indexOf(correctOption);
  return {
    ...draft,
    options: shuffled,
    correctIndex: newIndex >= 0 ? newIndex : 0,
  };
}

export interface QuizGradeResult {
  score: number;
  passed: boolean;
  attemptsCount: number;
  attemptsRemaining: number;
  isTerminal: boolean;
  breakdown: Array<{
    questionId: string;
    correct: boolean;
    chosenIndex: number;
    correctIndex?: number;
    explanation?: string;
  }>;
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
  const priorQuizCount = typeof db.quiz?.count === "function"
    ? await db.quiz.count({ where: { learnerId, milestoneId } })
    : 0;
  const llmQuestions = await generateQuestionsLlmMulti(skillNames, 3, "milestone gate");
  const rawQuestions = llmQuestions ?? (await generateQuestionsDeterministicMulti(skillIds, priorQuizCount));
  const questions = rawQuestions.map(shuffleQuestionDraft);
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

async function generateQuestionsDeterministicMulti(skillIds: string[], attemptSalt = 0): Promise<QuizQuestionDraft[]> {
  const drafts: QuizQuestionDraft[] = [];
  for (const sid of skillIds) {
    const qs = await generateQuestionsDeterministic(sid, attemptSalt);
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

  const priorAttempts = typeof db.quizAttempt?.count === "function"
    ? quiz.milestoneId
      ? await db.quizAttempt.count({
          where: {
            quiz: { milestoneId: quiz.milestoneId, learnerId: quiz.learnerId },
          },
        })
      : await db.quizAttempt.count({ where: { quizId } })
    : 0;
  const attemptsCount = priorAttempts + 1;
  const maxAttempts = 3;

  const rawBreakdown = ordered.map((q, i) => {
    const chosen = answers[i] ?? -1;
    return {
      questionId: q.id,
      correct: chosen === q.correctIndex,
      chosenIndex: chosen,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    };
  });
  const correctCount = rawBreakdown.filter((b) => b.correct).length;
  const score = ordered.length ? correctCount / ordered.length : 0;
  const passed = score >= quiz.passScore;
  const isTerminal = passed || attemptsCount >= maxAttempts;
  const attemptsRemaining = Math.max(0, maxAttempts - attemptsCount);

  await db.quizAttempt.create({
    data: {
      quizId,
      answersJson: JSON.stringify(answers),
      score,
      passed,
      breakdownJson: JSON.stringify(rawBreakdown),
    },
  });

  const newStatus = passed ? "passed" : attemptsCount >= maxAttempts ? "failed" : "pending";
  await db.quiz.update({ where: { id: quizId }, data: { status: newStatus } });

  // Clear quiz_failed replan badge if a quiz is passed on the active path
  if (passed) {
    const activePath = await db.learningPath.findFirst({
      where: { learnerId: quiz.learnerId, isActive: true },
    });
    if (activePath?.replanReason === "quiz_failed") {
      await db.learningPath.update({
        where: { id: activePath.id },
        data: { replanReason: null },
      });
    }
  }

  if (quiz.kind === "calibration" && quiz.skillId) {
    if (passed || attemptsCount >= maxAttempts) {
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
  }

  if (quiz.kind === "milestone_gate" && quiz.milestoneId && passed) {
    // Gate passed → apply skill verdicts. Milestone completes ONLY if any required project is also passed.
    const milestone = await db.milestone.findUnique({
      where: { id: quiz.milestoneId },
      include: { project: { include: { submissions: true } } },
    });
    if (milestone && milestone.status !== "complete") {
      const skillIds = JSON.parse(milestone.skillIdsJson) as string[];
      const skillNames = JSON.parse(milestone.skillNamesJson) as string[];
      for (let i = 0; i < skillIds.length; i++) {
        await applyQuizVerdict(quiz.learnerId, skillIds[i], skillNames[i] ?? skillIds[i], true, 3, score);
      }

      // Check if project is also required and whether it has passed
      const projectPassed = !milestone.hasProject || (
        milestone.project?.submissions.some((s) => s.status === "passed") ?? false
      );

      if (projectPassed) {
        await db.milestone.update({ where: { id: milestone.id }, data: { status: "complete", completedAt: new Date() } });
        const { unlockNext } = await import("@/lib/path/replan");
        await unlockNext(milestone.pathId);

        // Clean up any remaining pending quizzes for this milestone so they don't reappear
        await db.quiz.updateMany({
          where: { milestoneId: milestone.id, status: "pending" },
          data: { status: "passed" },
        });

        const path = await db.learningPath.findUnique({ where: { id: milestone.pathId } });
        if (path?.replanReason === "quiz_failed") {
          await db.learningPath.update({ where: { id: path.id }, data: { replanReason: null } });
        }

        await db.activityLog.create({
          data: {
            learnerId: quiz.learnerId,
            kind: "milestone_completed",
            detailJson: JSON.stringify({ milestoneId: milestone.id, title: milestone.title, via: "gate_quiz", score }),
          },
        });
      } else {
        // Project is still mandatory — phase remains in_progress until project passes
        if (milestone.status !== "in_progress") {
          await db.milestone.update({ where: { id: milestone.id }, data: { status: "in_progress" } });
        }
      }
    }
  }

  if (quiz.kind === "milestone_gate" && !passed && isTerminal) {
    await db.activityLog.create({
      data: {
        learnerId: quiz.learnerId,
        kind: "quiz_failed",
        detailJson: JSON.stringify({ milestoneId: quiz.milestoneId, skillName: quiz.skillName, score, quizKind: quiz.kind }),
      },
    });
  }

  // Sanitize breakdown:
  // For milestone gates, only reveal correctIndex and explanation once PASSED.
  // Withholding answers on failure prevents harvesting the key to cheat on retakes (PF-01).
  // For calibration quizzes, reveal explanations only when terminal and passed.
  const revealAnswers = quiz.kind === "milestone_gate" ? passed : (isTerminal && passed);
  const clientBreakdown = rawBreakdown.map((b) => ({
    questionId: b.questionId,
    correct: b.correct,
    chosenIndex: b.chosenIndex,
    ...(revealAnswers ? { correctIndex: b.correctIndex, explanation: b.explanation } : {}),
  }));

  const verdict = passed
    ? `Verified — your ${quiz.skillName ?? "skill"} level is now backed by a passing score (${Math.round(score * 100)}%).`
    : isTerminal
      ? `Not verified — ${Math.round(score * 100)}%. Maximum attempts reached (3/3); the plan will include a refresher before you build on this skill.`
      : `Attempt ${attemptsCount}/3 — ${Math.round(score * 100)}%. Pass mark is 75%. You have ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`;

  return {
    score,
    passed,
    attemptsCount,
    attemptsRemaining,
    isTerminal,
    breakdown: clientBreakdown,
    verdict,
  };
}
