import { NextResponse } from "next/server";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(e: unknown, defaultMessage = "Request failed", defaultStatus = 500): NextResponse {
  if (e instanceof HttpError) {
    return apiError(e.message, e.status);
  }

  if (e instanceof Error) {
    const msg = e.message;
    const lower = msg.toLowerCase();

    // 404 Not Found patterns
    if (
      lower.includes("not found") ||
      lower.includes("does not exist") ||
      lower.includes("no learner") ||
      lower.includes("no milestone") ||
      lower.includes("user not found") ||
      lower.includes("handle not found")
    ) {
      return apiError(msg, 404);
    }

    // 403 Forbidden patterns
    if (lower.includes("forbidden") || lower.includes("unauthorized") || lower.includes("does not belong to")) {
      return apiError(msg, 403);
    }

    // 400 Bad Request patterns
    if (
      lower.includes("invalid json") ||
      lower.includes("required") ||
      lower.includes("unknown skill") ||
      lower.includes("unknown domain") ||
      lower.includes("invalid") ||
      lower.includes("cannot read properties of null") ||
      lower.includes("cannot read properties of undefined") ||
      lower.includes("is not a function")
    ) {
      const cleanMsg = lower.includes("cannot read properties") || lower.includes("is not a function")
        ? "Invalid request payload format"
        : msg;
      return apiError(cleanMsg, 400);
    }

    // 429 Rate Limit
    if (lower.includes("rate limit") || lower.includes("too many requests")) {
      return apiError(msg, 429);
    }

    return apiError(msg, defaultStatus);
  }

  return apiError(defaultMessage, defaultStatus);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    const raw = await request.json();
    if (raw === null || typeof raw !== "object") {
      throw new HttpError("Invalid JSON body: expected an object", 400);
    }
    return raw as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError("Invalid JSON body", 400);
  }
}

/** SSE stream helper — takes an async generator of JSON-serialisable events. */
export function sseStream(
  generator: AsyncGenerator<Record<string, unknown>>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Stream error";
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        } catch {
          /* client gone */
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
