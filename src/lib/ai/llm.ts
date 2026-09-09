/**
 * Multi-provider LLM gateway.
 *
 * Design: "AI-augmented, not AI-dependent." Every caller degrades
 * gracefully when no provider answers — the deterministic engine keeps the
 * product functional, LLMs make it conversational.
 *
 * Provider chain (first configured + reachable wins, per-call fallback on
 * rate-limit / transient errors):
 *
 *   1. Vercel Gateway  — AI_GATEWAY_API_KEY        (unified proxy, usage dashboard)
 *   2. Groq            — GROQ_API_KEY              (direct, fallback)
 *   3. OpenAI-compat   — OPENAI_API_KEY (+ OPENAI_BASE)
 *   4. Z.AI            — via z-ai-web-dev-sdk (zero-config sandbox fallback)
 *
 * All providers funnel through one OpenAI-compatible transport, so behaviour
 * (timeouts, retries, JSON repair, SSE streaming) is uniform.
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCallOptions {
  maxTokens?: number;
  temperature?: number;
  /** Abort after this many ms (per attempt). Default 45s. */
  timeoutMs?: number;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
}

export interface StreamChunk {
  delta: string;
  provider: string;
}

interface Provider {
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  extraHeaders?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 45_000;

function resolveProviders(): Provider[] {
  const providers: Provider[] = [];

  // 1. Direct Groq — fallback when no gateway key
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push({
      name: "groq",
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      apiKey: groqKey,
    });
  }

  // 3. NVIDIA (only if no Groq/Gateway)
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey && !groqKey) {
    providers.push({
      name: "nvidia",
      model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
      baseUrl: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
      apiKey: nvidiaKey,
    });
  }

  // 4. OpenAI-compatible
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    providers.push({
      name: "openai-compatible",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      baseUrl: process.env.OPENAI_BASE || "https://api.openai.com/v1",
      apiKey: openaiKey,
    });
  }

  return providers;
}

let zaiClient: unknown | null = null;
let zaiTried = false;

/** Lazily create the Z.AI SDK client (optional dependency). */
async function getZai(): Promise<{
  chat: { completions: { create: (body: Record<string, unknown>) => Promise<unknown> } };
} | null> {
  if (zaiClient) return zaiClient as never;
  if (zaiTried) return null;
  zaiTried = true;
  try {
    const mod = (await import(/* webpackIgnore: true */ "z-ai-web-dev-sdk")) as unknown as {
      default: { create: () => Promise<unknown> };
    };
    zaiClient = await mod.default.create();
    return zaiClient as never;
  } catch {
    return null;
  }
}

function isTransientError(status: number, body: string): boolean {
  if (status === 429 || status >= 500) return true;
  const lower = body.toLowerCase();
  return ["rate limit", "resource_exhausted", "overloaded", "timeout"].some((k) => lower.includes(k));
}

export function llmConfigured(): boolean {
  return resolveProviders().length > 0 || !!process.env.Z_AI_SDK_DISABLED ? resolveProviders().length > 0 : true;
}

async function callZai(messages: LlmMessage[], options: LlmCallOptions): Promise<LlmResult | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const response = (await zai.chat.completions.create({
      messages,
      max_tokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.7,
      signal: controller.signal,
    })) as { choices?: Array<{ message?: { content?: string } }> };
    clearTimeout(timer);
    const text = response?.choices?.[0]?.message?.content ?? "";
    if (!text) return null;
    return { text, provider: "zai", model: "glm" };
  } catch {
    return null;
  }
}

async function callOpenAiCompatible(
  p: Provider,
  messages: LlmMessage[],
  options: LlmCallOptions,
): Promise<{ ok: LlmResult } | { err: "transient" | "fatal" }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
        ...(p.extraHeaders || {}),
      },
      body: JSON.stringify({
        model: p.model,
        messages,
        max_tokens: options.maxTokens ?? 1200,
        temperature: options.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { err: isTransientError(res.status, body) ? "transient" : "fatal" };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { err: "transient" };
    return { ok: { text, provider: p.name, model: p.model } };
  } catch {
    return { err: "transient" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Single-shot completion across the provider chain.
 * Returns null when every provider fails — callers MUST have a fallback.
 */
export async function chatCompletion(messages: LlmMessage[], options: LlmCallOptions = {}): Promise<LlmResult | null> {
  const providers = resolveProviders();
  for (const p of providers) {
    const result = await callOpenAiCompatible(p, messages, options);
    if ("ok" in result) return result.ok;
    if (result.err === "fatal") continue; // try next provider anyway
  }
  // Z.AI as the final fallback (also the zero-config default in sandboxes).
  return callZai(messages, options);
}

/**
 * Streaming completion. Yields text deltas. If no streaming provider is
 * available, falls back to a single-shot call yielded as one chunk.
 */
export async function* chatCompletionStream(
  messages: LlmMessage[],
  options: LlmCallOptions = {},
): AsyncGenerator<StreamChunk> {
  const providers = resolveProviders();
  for (const p of providers) {
    let yielded = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages,
          max_tokens: options.maxTokens ?? 1200,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        clearTimeout(timer);
        continue;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yielded = true;
              yield { delta, provider: p.name };
            }
          } catch {
            // Ignore malformed keep-alive lines.
          }
        }
      }
      clearTimeout(timer);
      if (yielded) return;
    } catch {
      if (yielded) return; // partial stream already delivered — don't duplicate
    }
  }

  // Z.AI fallback (non-streaming SDK; emit as one delta).
  const zai = await callZai(messages, options);
  if (zai) {
    yield { delta: zai.text, provider: "zai" };
    return;
  }

  // Last resort: single-shot over the chain, chunked.
  const single = await chatCompletion(messages, options);
  if (single) yield { delta: single.text, provider: single.provider };
}

// ─── JSON hardening ──────────────────────────────────────────────────────────

/**
 * Repair common LLM JSON pathologies: <think> blocks, markdown fences,
 * leading prose, trailing commas, smart quotes. Returns null if nothing
 * JSON-shaped can be recovered.
 */
export function repairJson(raw: string): unknown | null {
  let text = raw || "";
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/^[\s\S]*?```(?:json)?\s*\n?/, (m, offset: number) => {
    // Keep only if the fence looks like a wrapper around the JSON.
    return raw.slice(offset).startsWith(m) ? "" : m;
  });
  text = text.replace(/```[\s\S]*$/g, "");
  // Trim leading prose: find the first { or [
  const firstBrace = text.search(/[{[]/);
  if (firstBrace > 0) text = text.slice(firstBrace);
  // Strip trailing commas before } or ]
  text = text.replace(/,\s*([}\]])/g, "$1");
  text = text.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  try {
    return JSON.parse(text.trim());
  } catch {
    // Second attempt: balance trailing brackets (truncated output).
    let attempt = text.trim();
    const opens = { "{": 0, "[": 0 };
    for (const ch of attempt) {
      if (ch === "{") opens["{"]++;
      if (ch === "}") opens["{"]--;
      if (ch === "[") opens["["]++;
      if (ch === "]") opens["["]--;
    }
    if (opens["{"] > 0) attempt += "}".repeat(opens["{"]);
    if (opens["["] > 0) attempt += "]".repeat(opens["["]);
    try {
      return JSON.parse(attempt);
    } catch {
      return null;
    }
  }
}

/**
 * Structured completion: asks for JSON, repairs the output, validates with
 * the provided guard. Returns null when unusable — caller falls back.
 */
export async function chatJson<T>(
  messages: LlmMessage[],
  guard: (value: unknown) => T | null,
  options: LlmCallOptions = {},
): Promise<{ value: T; provider: string } | null> {
  const result = await chatCompletion(messages, {
    ...options,
    temperature: options.temperature ?? 0.4, // structured output wants low temperature
  });
  if (!result) return null;
  const parsed = repairJson(result.text);
  if (parsed == null) return null;
  const guarded = guard(parsed);
  if (guarded == null) return null;
  return { value: guarded, provider: result.provider };
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function asInt(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
