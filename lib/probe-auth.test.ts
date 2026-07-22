import { describe, expect, it } from "vitest";
import { matchesProbeSecret } from "./probe-auth";

describe("matchesProbeSecret", () => {
  it("accepts the configured credential", () => {
    expect(matchesProbeSecret("correct-secret", "correct-secret")).toBe(true);
  });

  it("rejects missing and incorrect credentials", () => {
    expect(matchesProbeSecret(null, "correct-secret")).toBe(false);
    expect(matchesProbeSecret("wrong-secret", "correct-secret")).toBe(false);
  });
});
