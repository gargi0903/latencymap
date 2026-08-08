import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the hourly limit", async () => {
    const key = `allowed-${Math.random()}`;

    for (let i = 0; i < 10; i += 1) {
      await expect(checkRateLimit(key)).resolves.toEqual({ ok: true });
    }
  });

  it("blocks the next request inside the same window", async () => {
    const key = `blocked-${Math.random()}`;

    for (let i = 0; i < 10; i += 1) {
      await checkRateLimit(key);
    }

    const blocked = await checkRateLimit(key);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("resets after the window expires", async () => {
    const key = `reset-${Math.random()}`;

    for (let i = 0; i < 10; i += 1) {
      await checkRateLimit(key);
    }

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await expect(checkRateLimit(key)).resolves.toEqual({ ok: true });
  });
});
