import { db } from "@/lib/db";
import { apiError, json, sseStream, readJson } from "@/lib/api-helpers";
import { streamMentorReply } from "@/lib/mentor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  message: string;
  socratic?: boolean;
}

/** GET: chat history. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) return apiError("learnerId is required");
    const messages = await db.mentorMessage.findMany({
      where: { learnerId },
      orderBy: { createdAt: "asc" },
      take: 60,
    });
    return json({
      messages: messages.map((m) => ({ role: m.role, content: m.content, at: m.createdAt.toISOString() })),
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to load history", 500);
  }
}

/** POST: streaming mentor reply grounded in the learner's real context. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.learnerId || !body.message?.trim()) return apiError("learnerId and message are required");

    const generator = (async function* () {
      for await (const chunk of streamMentorReply(body.learnerId, body.message.trim(), body.socratic === true)) {
        yield { type: "delta", text: chunk.delta, provider: chunk.provider };
      }
      yield { type: "done" };
    })();

    return sseStream(generator);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Mentor chat failed", 500);
  }
}
