import { db } from "@/lib/db";
import { apiError, sseStream, readJson } from "@/lib/api-helpers";
import { runAgentStream, persistAgentTurn, type AgentPhase, type ExtractedProfile, PHASE_ORDER } from "@/lib/onboarding/agent";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface MessageBody {
  learnerId: string;
  message: string;
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 40, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = await readJson<MessageBody>(request);
    if (!body.learnerId || !body.message?.trim()) {
      return apiError("learnerId and message are required");
    }


    const learner = await db.learner.findUnique({ where: { id: body.learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const generator = (async function* () {
      let apiReply = "";
      try {
        const streamResult = await runAgentStream(body.learnerId, body.message.trim());
        apiReply = streamResult.fullReply;
      } catch (err: any) {
        const msg = err?.message ?? "";
        if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
          apiReply = "I'm processing several learners right now, but I've got your input recorded! Could you tell me about the specific projects or technologies you've worked with recently?";
        } else {
          throw err;
        }
      }
      
      let replyBuffer = apiReply || "";
      let phaseComplete = false;
      let extracted: ExtractedProfile = {};
      
      const wantsSkip = /^\s*(\/skip|skip|next|move on|let'?s move|let'?s move on|skip question)\s*$/i.test(body.message.trim());
      if (wantsSkip || replyBuffer.includes("[PHASE_COMPLETE]")) {
        phaseComplete = true;
      }
      
      let cleanReply = replyBuffer.replace("[PHASE_COMPLETE]", "").trim();
      if (phaseComplete && !cleanReply) {
        cleanReply = "Got it. Let's move to the next phase.";
      }

      if (cleanReply) {
        yield { type: "delta", text: cleanReply };
      } else {
        yield { type: "delta", text: "…" };
      }

      if (phaseComplete) {
        const { extractProfile } = await import("@/lib/onboarding/extract");
        extracted = await extractProfile(body.learnerId);
      }

      const persisted = await persistAgentTurn(
        body.learnerId,
        body.message.trim(),
        cleanReply,
        extracted,
        { wantsSkip, phaseComplete }
      );

      yield {
        type: "done",
        reply: cleanReply,
        extracted: persisted.extracted,
        phase: persisted.phase as AgentPhase,
        waitingForConfirmation: phaseComplete && !wantsSkip, // Ask confirmation unless they explicitly skipped
      };
    })();

    return sseStream(generator);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Interview turn failed", 500);
  }
}
