import { db } from "@/lib/db";
import { apiError, handleApiError, json, readJson } from "@/lib/api-helpers";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface StartBody {
  name?: string;
}

/** Create a learner + agent state; returns the interview opening message. */
export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    let body: StartBody = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional; default name will be used
    }

    if (body && body.name !== undefined && typeof body.name !== "string") {
      return apiError("name must be a string", 400);
    }
    const name = (body?.name || "").trim().slice(0, 60) || "Learner";

    const learner = await db.learner.create({
      data: {
        name,
        onboardingStage: "interview",
        agentState: {
          create: {
            phase: "intro",
            historyJson: JSON.stringify([]),
            extractedJson: JSON.stringify({ name }),
          },
        },
      },
      include: { agentState: true },
    });

    const greeting =
      `Hey${name !== "Learner" ? ` ${name}` : ""} — I'm Nexus, your learning coach. ` +
      `I'm going to ask a few sharp questions about where you are and where you want to be, ` +
      `then we'll prove your skills with real evidence and build a roadmap that actually fits.\n\n` +
      `Let's start simple: what do you want to be able to DO six months from now?`;

    await db.agentState.update({
      where: { learnerId: learner.id },
      data: {
        historyJson: JSON.stringify([{ role: "assistant", content: greeting }]),
      },
    });

    return json({
      learnerId: learner.id,
      name: learner.name,
      phase: "intro",
      greeting,
    });
  } catch (e) {
    return handleApiError(e, "Failed to start onboarding");
  }
}
