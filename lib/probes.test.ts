import { afterEach, describe, expect, it } from "vitest";
import { getProbeSecret, ProbeConfigurationError } from "./probes";

const originalProbeSecret = process.env.PROBE_SECRET;

afterEach(() => {
  if (originalProbeSecret === undefined) {
    delete process.env.PROBE_SECRET;
  } else {
    process.env.PROBE_SECRET = originalProbeSecret;
  }
});

describe("getProbeSecret", () => {
  it("rejects an absent or whitespace-only credential", () => {
    delete process.env.PROBE_SECRET;
    expect(() => getProbeSecret()).toThrow(ProbeConfigurationError);

    process.env.PROBE_SECRET = "   ";
    expect(() => getProbeSecret()).toThrow(ProbeConfigurationError);
  });

  it("returns a trimmed credential", () => {
    process.env.PROBE_SECRET = "  configured-secret  ";

    expect(getProbeSecret()).toBe("configured-secret");
  });
});
