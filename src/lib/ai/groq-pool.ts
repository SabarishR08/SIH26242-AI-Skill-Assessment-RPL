/**
 * Groq API Key Pool — Round-Robin with Automatic Failover
 *
 * Supports:
 * - Environment list in GROQ_API_KEYS (comma-separated)
 * - Single GROQ_API_KEY
 * - Round-robin distribution across requests
 * - Automatic failover to next key on HTTP 429 (Rate Limit) or 5xx
 */

let currentIndex = 0;

export function getGroqKeys(): string[] {
  const keys: string[] = [];

  const envMulti = process.env.GROQ_API_KEYS;
  if (envMulti) {
    for (const k of envMulti.split(",")) {
      const trimmed = k.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    }
  }

  const envSingle = process.env.GROQ_API_KEY;
  if (envSingle) {
    const trimmed = envSingle.trim();
    if (trimmed && !keys.includes(trimmed)) {
      keys.push(trimmed);
    }
  }

  return keys;
}

export function hasGroqKey(): boolean {
  return getGroqKeys().length > 0;
}

/**
 * Returns the next Groq API key in round-robin sequence.
 */
export function getNextGroqKey(): string {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    throw new Error("No Groq API keys available");
  }
  const key = keys[currentIndex % keys.length];
  currentIndex = (currentIndex + 1) % keys.length;
  return key;
}

/**
 * Execute an API operation with automatic key rotation and failover.
 * If the current key hits a rate limit (429) or transient error,
 * it tries the other keys in the pool before throwing.
 */
export async function executeWithGroqPool<T>(
  operation: (apiKey: string) => Promise<T>,
): Promise<T> {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    throw new Error("No Groq API keys available");
  }

  const startIndex = currentIndex % keys.length;
  let lastError: unknown;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = (startIndex + attempt) % keys.length;
    const key = keys[keyIndex];

    try {
      const result = await operation(key);
      // Advance current index past the successful key
      currentIndex = (keyIndex + 1) % keys.length;
      return result;
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      const message = String(err?.message ?? "");
      const isRateLimit = status === 429 || message.includes("429") || message.toLowerCase().includes("rate limit");
      const isServerError = status >= 500 && status < 600;

      if (isRateLimit || isServerError) {
        console.warn(`[GroqPool] Key ${keyIndex + 1}/${keys.length} encountered ${status || message}, failing over to next key...`);
        continue;
      }

      // For non-rate-limit/non-server errors (e.g. malformed input, 400), don't retry across keys
      throw err;
    }
  }

  throw lastError;
}
