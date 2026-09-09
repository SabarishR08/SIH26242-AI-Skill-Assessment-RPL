import { NextResponse } from "next/server";

// Static routes
import * as explain from "@/server/api/explain/route";
import * as evidenceCodeforces from "@/server/api/evidence/codeforces/route";
import * as evidenceLeetcode from "@/server/api/evidence/leetcode/route";
import * as evidenceResume from "@/server/api/evidence/resume/route";
import * as evidenceGithub from "@/server/api/evidence/github/route";
import * as evidenceList from "@/server/api/evidence/list/route";
import * as calibrationGaps from "@/server/api/calibration/gaps/route";
import * as calibrationQuiz from "@/server/api/calibration/quiz/route";
import * as projectsSpec from "@/server/api/projects/spec/route";
import * as health from "@/server/api/health/route";
import * as pathReplan from "@/server/api/path/replan/route";
import * as pathCurrent from "@/server/api/path/current/route";
import * as pathScenarios from "@/server/api/path/scenarios/route";
import * as pathGenerate from "@/server/api/path/generate/route";
import * as pathGoal from "@/server/api/path/goal/route";
import * as quizGate from "@/server/api/quiz/gate/route";
import * as mentor from "@/server/api/mentor/route";
import * as dashboard from "@/server/api/dashboard/route";
import * as profileSkills from "@/server/api/profile/skills/route";
import * as profileRadar from "@/server/api/profile/radar/route";
import * as skillsSearch from "@/server/api/skills/search/route";
import * as weekly from "@/server/api/weekly/route";
import * as onboardingStart from "@/server/api/onboarding/start/route";
import * as onboardingMessage from "@/server/api/onboarding/message/route";
import * as onboardingState from "@/server/api/onboarding/state/route";

// Dynamic routes
import * as projectsIdSubmit from "@/server/api/projects/[id]/submit/route";
import * as quizId from "@/server/api/quiz/[id]/route";
import * as quizIdSubmit from "@/server/api/quiz/[id]/submit/route";
import * as milestonesIdComplete from "@/server/api/milestones/[id]/complete/route";
import * as milestonesIdStart from "@/server/api/milestones/[id]/start/route";
import * as milestonesIdFeedback from "@/server/api/milestones/[id]/feedback/route";

export const dynamic = "force-dynamic";

type RouteModule = {
  GET?: (request: Request, ctx?: any) => Promise<Response>;
  POST?: (request: Request, ctx?: any) => Promise<Response>;
};

const staticRoutes: Record<string, RouteModule> = {
  "explain": explain,
  "evidence/codeforces": evidenceCodeforces,
  "evidence/leetcode": evidenceLeetcode,
  "evidence/resume": evidenceResume,
  "evidence/github": evidenceGithub,
  "evidence/list": evidenceList,
  "calibration/gaps": calibrationGaps,
  "calibration/quiz": calibrationQuiz,
  "projects/spec": projectsSpec,
  "health": health,
  "path/replan": pathReplan,
  "path/current": pathCurrent,
  "path/scenarios": pathScenarios,
  "path/generate": pathGenerate,
  "path/goal": pathGoal,
  "quiz/gate": quizGate,
  "mentor": mentor,
  "dashboard": dashboard,
  "profile/skills": profileSkills,
  "profile/radar": profileRadar,
  "skills/search": skillsSearch,
  "weekly": weekly,
  "onboarding/start": onboardingStart,
  "onboarding/message": onboardingMessage,
  "onboarding/state": onboardingState,
};

async function dispatch(request: Request, context: { params: Promise<{ slug?: string[] }> }, method: "GET" | "POST") {
  const { slug = [] } = await context.params;
  const path = slug.join("/");

  // Check static routes first
  const staticModule = staticRoutes[path];
  if (staticModule) {
    const handler = staticModule[method];
    if (handler) {
      return handler(request);
    }
    return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
  }

  // Dynamic routes
  // /api/quiz/:id
  if (slug.length === 2 && slug[0] === "quiz") {
    if (method === "GET") {
      return quizId.GET(request, { params: Promise.resolve({ id: slug[1] }) });
    }
    return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
  }

  // /api/quiz/:id/submit
  if (slug.length === 3 && slug[0] === "quiz" && slug[2] === "submit") {
    if (method === "POST") {
      return quizIdSubmit.POST(request, { params: Promise.resolve({ id: slug[1] }) });
    }
    return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
  }

  // /api/projects/:id/submit
  if (slug.length === 3 && slug[0] === "projects" && slug[2] === "submit") {
    if (method === "POST") {
      return projectsIdSubmit.POST(request, { params: Promise.resolve({ id: slug[1] }) });
    }
    return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
  }

  // /api/milestones/:id/complete
  if (slug.length === 3 && slug[0] === "milestones" && slug[2] === "complete") {
    if (method === "POST") {
      return milestonesIdComplete.POST(request, { params: Promise.resolve({ id: slug[1] }) });
    }
    return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
  }

  // /api/milestones/:id/start
  if (slug.length === 3 && slug[0] === "milestones" && slug[2] === "start") {
    if (method === "POST") {
      return milestonesIdStart.POST(request, { params: Promise.resolve({ id: slug[1] }) });
    }
    return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
  }

  // /api/milestones/:id/feedback
  if (slug.length === 3 && slug[0] === "milestones" && slug[2] === "feedback") {
    if (method === "POST") {
      return milestonesIdFeedback.POST(request, { params: Promise.resolve({ id: slug[1] }) });
    }
    return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
  }

  return NextResponse.json({ error: `API route not found: /api/${path}` }, { status: 404 });
}

export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  return dispatch(request, context, "GET");
}

export async function POST(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  return dispatch(request, context, "POST");
}
