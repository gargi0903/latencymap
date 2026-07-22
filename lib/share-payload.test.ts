import { describe, expect, it } from "vitest";
import { decodeSharePayload, encodeSharePayload, sharePathForRun } from "./share-payload";
import type { TestRun } from "./types";

const sampleRun: TestRun = {
  id: "",
  inputUrl: "HTTPS://API.Example.com/health",
  normalizedUrl: "https://api.example.com/health",
  createdAt: "2026-07-22T12:00:00.000Z",
  results: [
    {
      region: "iad",
      label: "US East (Ashburn)",
      lat: 39.04,
      lng: -77.49,
      totalMs: 142,
      statusCode: 200,
      error: null,
      testedAt: "2026-07-22T12:00:01.000Z",
      cloudflareColo: "IAD",
      placementRegion: "aws:us-east-1",
    },
    {
      region: "sin",
      label: "Singapore",
      lat: 1.35,
      lng: 103.82,
      totalMs: null,
      statusCode: null,
      error: "timeout",
      testedAt: "2026-07-22T12:00:02.000Z",
      cloudflareColo: "SIN",
      placementRegion: "aws:ap-southeast-1",
    },
  ],
};

describe("share payload", () => {
  it("round-trips a test run through base64url encoding", () => {
    const token = encodeSharePayload(sampleRun);
    const decoded = decodeSharePayload(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.normalizedUrl).toBe(sampleRun.normalizedUrl);
    expect(decoded?.inputUrl).toBe(sampleRun.inputUrl);
    expect(decoded?.createdAt).toBe(sampleRun.createdAt);
    expect(decoded?.results).toEqual(sampleRun.results);
    expect(decoded?.id).toBe(token);
  });

  it("builds a share path from a run", () => {
    const path = sharePathForRun({ ...sampleRun, id: "cached-token" });
    expect(path).toBe("/r/cached-token");
    expect(decodeSharePayload("cached-token")).toBeNull();
  });

  it("encodes when a run id is not available yet", () => {
    const path = sharePathForRun(sampleRun);
    expect(path.startsWith("/r/")).toBe(true);
    expect(decodeSharePayload(path.slice(3))).not.toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(decodeSharePayload("not-a-valid-token")).toBeNull();
    expect(decodeSharePayload("")).toBeNull();
  });
});
