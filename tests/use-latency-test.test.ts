import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchLatencyTest } from "@/app/ui";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLatencyTest", () => {
  it("returns run data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ run: { id: "1" }, sharePath: "/r/1" }),
      })),
    );

    await expect(fetchLatencyTest("https://example.com")).resolves.toEqual({
      ok: true,
      run: { id: "1" },
      sharePath: "/r/1",
    });
  });

  it("maps API and network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "bad url" }),
      })),
    );
    await expect(fetchLatencyTest("https://example.com")).resolves.toEqual({
      ok: false,
      error: "bad url",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(fetchLatencyTest("https://example.com")).resolves.toEqual({
      ok: false,
      error: "Unable to reach the Latencymap API.",
    });
  });
});
