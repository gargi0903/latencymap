import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to 10 requests per hour for a key", () => {
    const key = `rate-limit-${Date.now()}-${Math.random()}`;

    for (let index = 0; index < 10; index += 1) {
      expect(checkRateLimit(key)).toEqual({ ok: true });
    }

    const blocked = checkRateLimit(key);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("resets after the window expires", () => {
    const key = `rate-limit-reset-${Date.now()}-${Math.random()}`;
    const now = Date.now();
    const originalNow = Date.now;

    try {
      Date.now = () => now;
      for (let index = 0; index < 10; index += 1) {
        checkRateLimit(key);
      }
      expect(checkRateLimit(key).ok).toBe(false);

      Date.now = () => now + 60 * 60 * 1000 + 1;
      expect(checkRateLimit(key)).toEqual({ ok: true });
    } finally {
      Date.now = originalNow;
    }
  });
});
