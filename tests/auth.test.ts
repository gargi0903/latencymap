import { describe, expect, it } from "vitest";
import { matchesProbeSecret } from "../workers/auth";

describe("matchesProbeSecret", () => {
  it("accepts the configured credential", async () => {
    await expect(matchesProbeSecret("correct-secret", "correct-secret")).resolves.toBe(true);
  });

  it("rejects missing and incorrect credentials", async () => {
    await expect(matchesProbeSecret(null, "correct-secret")).resolves.toBe(false);
    await expect(matchesProbeSecret("wrong-secret", "correct-secret")).resolves.toBe(false);
  });
});
