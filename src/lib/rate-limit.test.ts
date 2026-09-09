import { describe, it, expect } from "vitest";
import { checkRateLimit, rateLimitResponse } from "./rate-limit";

describe("rate-limit", () => {
  it("allows requests under the limit", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });

    const res1 = checkRateLimit(req, { limit: 2, windowMs: 1000, key: "test-user-1" });
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(1);

    const res2 = checkRateLimit(req, { limit: 2, windowMs: 1000, key: "test-user-1" });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(0);
  });

  it("blocks requests exceeding the limit", () => {
    const req = new Request("http://localhost/api/test");

    checkRateLimit(req, { limit: 1, windowMs: 1000, key: "test-user-2" });
    const blocked = checkRateLimit(req, { limit: 1, windowMs: 1000, key: "test-user-2" });

    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);

    const httpRes = rateLimitResponse(blocked);
    expect(httpRes.status).toBe(429);
    expect(httpRes.headers.get("Retry-After")).toBeDefined();
  });
});
