"use client";

/**
 * Client-side API layer — thin typed wrappers over the backend routes,
 * with SSE stream parsing for the streaming endpoints.
 */

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  // ── Onboarding ───────────────────────────────────────────────────────────
  startOnboarding: (name: string) =>
    fetch("/api/onboarding/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(handle<{ learnerId: string; name: string; phase: string; greeting: string }>),

  getOnboardingState: (learnerId: string) =>
    fetch(`/api/onboarding/state?learnerId=${learnerId}`).then(
      handle<{
        phase: string;
        history: Array<{ role: string; content: string }>;
        extracted: Record<string, unknown>;
        learner: {
          id: string;
          name: string;
          goalStatement: string | null;
          targetRole: string | null;
          domain: string | null;
          goalSkillId: string | null;
          hoursPerWeek: number;
          onboardingStage: string;
        };
      }>,
    ),

  // ── Evidence ─────────────────────────────────────────────────────────────
  connectGithub: (learnerId: string, username: string) =>
    fetch("/api/evidence/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, username }),
    }).then(
      handle<{
        profile: {
          login: string;
          name: string | null;
          bio: string | null;
          followers: number;
          publicRepos: number;
          totalStars: number;
          languageMix: Record<string, number>;
          topRepos: Array<{ name: string; description: string | null; language: string | null; stars: number; url: string }>;
        };
        analysis: { archetype: string; summary: string; mode: string; claims: Array<{ skillId: string; skillName: string; level: number; quote: string; strength: number }> };
      }>,
    ),

  connectLeetCode: (learnerId: string, username: string) =>
    fetch("/api/evidence/leetcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, username }),
    }).then(
      handle<{
        stats: { username: string; total: number; easy: number; medium: number; hard: number; ranking: number | null; evidencedLevel: number };
        claims: Array<{ skillName: string; level: number; quote: string }>;
      }>,
    ),

  connectCodeforces: (learnerId: string, cfHandle: string) =>
    fetch("/api/evidence/codeforces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, handle: cfHandle }),
    }).then(
      handle<{
        stats: { handle: string; rating: number | null; maxRating: number | null; rank: string | null; evidencedLevel: number };
        claims: Array<{ skillName: string; level: number; quote: string }>;
      }>,
    ),

  submitResume: (learnerId: string, text: string) =>
    fetch("/api/evidence/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, text }),
    }).then(
      handle<{
        analysis: {
          currentRole: string;
          yearsExperience: number;
          summary: string;
          highlights: string[];
          mode: string;
          claims: Array<{ skillId: string; skillName: string; level: number; quote: string; strength: number }>;
        };
      }>,
    ),

  listEvidence: (learnerId: string) =>
    fetch(`/api/evidence/list?learnerId=${learnerId}`).then(
      handle<{
        evidence: Array<{ id: string; source: string; sourceRef: string | null; summary: string; strength: number; url: string | null; createdAt: string; claims: Array<{ skillName: string; level: number; quote: string }> }>;
      }>,
    ),

  // ── Profile / calibration ────────────────────────────────────────────────
  getRadar: (learnerId: string) =>
    fetch(`/api/profile/radar?learnerId=${learnerId}`).then(
      handle<{
        goalSkillId: string;
        goalSkillName: string;
        radar: {
          points: Array<{ skillId: string; skillName: string; claimed: number; evidenced: number; required: number; overclaim: number; gap: number }>;
          axes: Array<{ axis: string; claimed: number; evidenced: number; required: number }>;
        };
        gaps: Array<{ skillId: string; skillName: string; claimedLevel: number; evidencedLevel: number; gap: number; tier: string }>;
        tiers: { proven: number; verified: number; claimed: number; inferred: number };
      }>,
    ),

  setClaims: (learnerId: string, claims: Array<{ skillId: string; level: number }>) =>
    fetch("/api/profile/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, claims }),
    }).then(handle<{ applied: number }>),

  createCalibrationQuiz: (learnerId: string, skillId?: string) =>
    fetch("/api/calibration/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, skillId }),
    }).then(
      handle<{
        quiz: null | {
          quizId: string;
          skillId: string;
          skillName: string;
          claimedLevel: number;
          evidencedLevel: number;
          mode: string;
          questions: Array<{ prompt: string; options: string[]; skillFocus: string | null }>;
        };
        message?: string;
      }>,
    ),

  submitQuiz: (quizId: string, answers: number[], learnerId?: string) =>
    fetch(`/api/quiz/${quizId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, learnerId }),
    }).then(
      handle<{
        score: number;
        passed: boolean;
        attemptsCount: number;
        attemptsRemaining: number;
        isTerminal: boolean;
        verdict: string;
        milestoneCompleted: boolean;
        replanHappened: boolean;
        breakdown: Array<{ questionId: string; correct: boolean; chosenIndex: number; correctIndex?: number; explanation?: string }>;
      }>,
    ),

  createGateQuiz: (learnerId: string, milestoneId: string) =>
    fetch("/api/quiz/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, milestoneId }),
    }).then(
      handle<{
        quiz: {
          quizId: string;
          kind: string;
          skillName: string;
          mode: string;
          questions: Array<{ prompt: string; options: string[]; skillFocus: string | null }>;
        };
      }>,
    ),

  // ── Path ─────────────────────────────────────────────────────────────────
  previewScenarios: (learnerId: string, goalSkillId?: string, hoursPerWeek?: number) =>
    fetch("/api/path/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, goalSkillId, hoursPerWeek }),
    }).then(
      handle<{
        previews: Array<{ scenario: string; totalSkills: number; totalHours: number; etaWeeks: number; algorithm: string; milestones: number; label: string; tagline: string; description: string }>;
      }>,
    ),

  generatePath: (learnerId: string, scenario: string, goalSkillId?: string, hoursPerWeek?: number) =>
    fetch("/api/path/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, scenario, goalSkillId, hoursPerWeek }),
    }).then(handle<{ pathId: string; version: number; milestones: Array<{ phase: string; title: string }>; etaDate: string; totalHours: number }>),

  getCurrentPath: (learnerId: string) =>
    fetch(`/api/path/current?learnerId=${learnerId}`).then(handle<{ path: PathDetail | null }>),

  replan: (learnerId: string, reason: string, milestoneId?: string, comment?: string) =>
    fetch("/api/path/replan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, reason, milestoneId, comment }),
    }).then(
      handle<{
        pathId: string;
        version: number;
        diff: { added: Array<{ phase: string; title: string; reason: string }>; removed: Array<{ phase: string; title: string; reason: string }>; moved: Array<{ phase: string; title: string; reason: string }>; keptCount: number; etaShiftDays: number; reasons: string[] };
      }>,
    ),

  changeGoal: (learnerId: string, goalText: string) =>
    fetch("/api/path/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, goalText }),
    }).then(handle<{ pathId: string; version: number }>),

  changeGoalSkill: (learnerId: string, goalSkillId: string) =>
    fetch("/api/path/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, goalSkillId }),
    }).then(handle<{ pathId: string; version: number }>),

  simulatePath: (
    learnerId: string,
    options: {
      scenario?: string;
      hoursPerWeek?: number;
      simulateFailure?: boolean;
      additionalKnownSkillId?: string;
    },
  ) =>
    fetch("/api/path/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, ...options }),
    }).then(handle<SimulationResult>),

  getSkillPassport: (learnerId: string) =>
    fetch(`/api/profile/passport?learnerId=${learnerId}`).then(
      handle<SkillPassportData>,
    ),

  searchSkills: (query: string, domain?: string) =>
    fetch(`/api/skills/search?query=${encodeURIComponent(query)}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}`).then(
      handle<{ hits: Array<{ id: string; name: string; domain: string; depth: number }> }>
    ),

  // ── Milestones / projects ────────────────────────────────────────────────
  startMilestone: (learnerId: string, milestoneId: string) =>
    fetch(`/api/milestones/${milestoneId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId }),
    }).then(
      handle<{
        milestoneId: string;
        status: string;
        project: null | {
          specId: string;
          title: string;
          brief: string;
          requirements: string[];
          rubric: Array<{ criterion: string; weight: number }>;
          zpd: { rationale: string; stretchMultiplier: number; targetDifficulty: number; estimatedHours: number; tier: string };
          estimatedHours: number;
          mode: string;
        };
      }>,
    ),

  submitProject: (specId: string, repoUrl: string) =>
    fetch(`/api/projects/${specId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl }),
    }).then(
      handle<{
        evaluation: {
          verdict: "passed" | "needs_work";
          overallScore: number;
          checks: Array<{ criterion: string; score: number; note: string }>;
          strengths: string[];
          gaps: string[];
          feedback: string;
          evaluatorMode: string;
        };
        milestoneCompleted: boolean;
      }>,
    ),

  sendFeedback: (learnerId: string, milestoneId: string, kind: string, comment?: string) =>
    fetch(`/api/milestones/${milestoneId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, kind, comment }),
    }).then(
      handle<{
        replanned: boolean;
        message?: string;
        version?: number;
        diff?: { added: Array<{ phase: string; title: string; reason: string }>; removed: Array<{ phase: string; title: string; reason: string }>; moved: Array<{ phase: string; title: string; reason: string }>; keptCount: number; etaShiftDays: number; reasons: string[] };
      }>,
    ),

  explain: (learnerId: string, subject: string, id: string) =>
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, subject, id }),
    }).then(
      handle<{
        explanation: {
          subject: string;
          title: string;
          grounds: { evidence: string[]; graph: string[]; goal: string[]; counterfactual?: string };
          prose: string;
          mode: string;
        };
      }>,
    ),

  // ── Dashboard / mentor / coach ───────────────────────────────────────────
  getDashboard: (learnerId: string) =>
    fetch(`/api/dashboard?learnerId=${learnerId}`).then(handle<DashboardData>),

  getWeekly: (learnerId: string) =>
    fetch(`/api/weekly?learnerId=${learnerId}`).then(handle<{ metrics: Record<string, number | string>; content: string; mode: string }>),

  getMentorHistory: (learnerId: string) =>
    fetch(`/api/mentor?learnerId=${learnerId}`).then(handle<{ messages: Array<{ role: string; content: string; at: string }> }>),
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface PathDetail {
  id: string;
  version: number;
  scenario: string;
  algorithm: string;
  replanReason: string | null;
  generatedAt: string;
  hoursPerWeek: number;
  totalHours: number;
  totalSkills: number;
  milestones: Array<{
    id: string;
    order: number;
    phase: string;
    title: string;
    description: string;
    skillIds: string[];
    skillNames: string[];
    estimatedHours: number;
    status: "locked" | "available" | "in_progress" | "complete";
    hasProject: boolean;
    hasGateQuiz: boolean;
    targetStartAt: string | null;
    targetEndAt: string | null;
    completedAt: string | null;
    courses: Record<string, Array<{ courseId: string; title: string; url: string; rating: number | null; site: string; level: string; duration: string }>>;
    resources: Array<{ resource_id: string; title: string; url: string; format: string; difficulty: string; provider: string; description: string }>;
    project: null | {
      specId: string;
      title: string;
      brief: string;
      requirements: string[];
      rubric: Array<{ criterion: string; weight: number }>;
      zpd: { rationale: string; stretchMultiplier: number; targetDifficulty: number; estimatedHours: number; tier: string };
      estimatedHours: number;
      submissions: Array<{ id: string; repoUrl: string; status: string; evaluation: { verdict: string; overallScore: number; checks: Array<{ criterion: string; score: number; note: string }>; strengths: string[]; gaps: string[]; feedback: string } | null; submittedAt: string }>;
    };
    gateQuiz: { id: string; status: string } | null;
  }>;
  edges: Array<[string, string]>;
  skills: Array<{ id: string; name: string; domain: string; depth: number; hours: number }>;
  progress: { completed: number; total: number; percent: number; hoursRemaining: number; etaDate: string | null };
}

export interface DashboardData {
  learner: {
    id: string;
    name: string;
    goalStatement: string | null;
    targetRole: string | null;
    domain: string | null;
    goalSkillName: string | null;
    hoursPerWeek: number;
    onboardingStage: string;
  };
  path: null | {
    id: string;
    version: number;
    scenario: string;
    algorithm: string;
    replanReason: string | null;
    totalHours: number;
    progress: { completed: number; total: number; percent: number };
    milestones: Array<{ phase: string; title: string; status: string; hours: number; end: string | null }>;
    nextMilestone: null | { id: string; phase: string; title: string; hours: number; status: string; hasProject: boolean; targetEnd: string | null };
  };
  skills: {
    tiers: { proven: number; verified: number; claimed: number; inferred: number };
    top: Array<{ name: string; claimed: number; evidenced: number; tier: string }>;
    gaps: Array<{ skillId: string; skillName: string; claimedLevel: number; evidencedLevel: number; gap: number; tier: string }>;
  };
  radar: { axes: Array<{ axis: string; claimed: number; evidenced: number; required: number }>; goalSkillName: string };
  actions: Array<{ kind: string; label: string; detail: string }>;
  activity: Array<{ kind: string; detail: Record<string, unknown>; at: string }>;
  evidence: Array<{ source: string; sourceRef: string | null; summary: string; at: string }>;
  weekly: null | { weekOf: string; content: string; metrics: Record<string, unknown> };
  momentum: Array<{ day: string; count: number }>;
  metrics: Record<string, number | string>;
}

export interface SimulationResult {
  simulation: {
    scenario: string;
    meta: { label: string; tagline: string; description: string };
    hoursPerWeek: number;
    totalHours: number;
    totalWeeks: number;
    etaDate: string;
    milestonesCount: number;
    milestones: Array<{
      order: number;
      phase: string;
      title: string;
      estimatedHours: number;
      hasProject: boolean;
      hasGateQuiz: boolean;
      targetStartAt?: string;
      targetEndAt?: string;
    }>;
    diff: {
      added: Array<{ phase: string; title: string; reason: string }>;
      removed: Array<{ phase: string; title: string; reason: string }>;
      keptCount: number;
      etaShiftDays: number;
      reasons: string[];
    };
  };
  current: {
    scenario: string;
    hoursPerWeek: number;
    totalHours: number;
    milestonesCount: number;
    etaDate: string | null;
  } | null;
}

export interface SkillPassportData {
  learner: {
    id: string;
    name: string;
    targetRole: string | null;
    domain: string | null;
    goalSkill: string | null;
    hoursPerWeek: number;
    memberSince: string;
  };
  summary: {
    passportId: string;
    issuedAt: string;
    integrityHash: string;
    totalVerifiedSkills: number;
    radarScore: number;
    evaluationsCount: number;
    quizzesPassed: number;
  };
  verifiedSkills: Array<{
    skillId: string;
    skillName: string;
    level: number;
    tier: "proven" | "verified" | "claimed";
    source: string;
    verifiedAt: string;
    evidenceSnippet?: string;
  }>;
  evaluations: Array<{
    title: string;
    score: number;
    verdict: string;
    submittedAt: string;
    repoUrl: string;
    keyStrengths: string[];
  }>;
  jsonLdCredential: Record<string, unknown>;
}

// ── SSE stream consumption ──────────────────────────────────────────────────

export async function* consumeSse(
  url: string,
  body: Record<string, unknown>,
): AsyncGenerator<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    let message = `Stream failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) message = errBody.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      try {
        yield JSON.parse(trimmed.slice(5).trim()) as Record<string, unknown>;
      } catch {
        /* skip malformed */
      }
    }
  }
}

/** Stream an onboarding interview turn; returns the final state. */
export async function streamOnboardingMessage(
  learnerId: string,
  message: string,
  onDelta: (text: string) => void,
  onToolCall?: (toolName: string) => void,
  onToolResult?: (toolName: string) => void,
): Promise<{ reply: string; phase: string; extracted: Record<string, unknown>; waitingForConfirmation?: boolean }> {
  let final = { reply: "", phase: "", extracted: {} as Record<string, unknown>, waitingForConfirmation: false };
  for await (const event of consumeSse("/api/onboarding/message", { learnerId, message })) {
    if (event.type === "delta" && typeof event.text === "string") {
      onDelta(event.text as string);
    } else if (event.type === "tool-call" && typeof event.toolName === "string" && onToolCall) {
      onToolCall(event.toolName);
    } else if (event.type === "tool-result" && typeof event.toolName === "string" && onToolResult) {
      onToolResult(event.toolName);
    } else if (event.type === "done") {
      final = {
        reply: (event.reply as string) ?? "",
        phase: (event.phase as string) ?? "",
        extracted: (event.extracted as Record<string, unknown>) ?? {},
        waitingForConfirmation: Boolean(event.waitingForConfirmation)
      };
    } else if (event.error) {
      throw new ApiError(String(event.error), 500);
    }
  }
  return final;
}

/** Stream a mentor reply; returns nothing (history is persisted server-side). */
export async function streamMentorMessage(
  learnerId: string,
  message: string,
  socratic: boolean,
  onDelta: (text: string) => void,
): Promise<void> {
  for await (const event of consumeSse("/api/mentor", { learnerId, message, socratic })) {
    if (event.type === "delta" && typeof event.text === "string") {
      onDelta(event.text as string);
    } else if (event.error) {
      throw new ApiError(String(event.error), 500);
    }
  }
}
