import { describe, expect, it } from "vitest";
import { probeResultsToGlobeArcs, probeResultsToGlobePoints } from "@/lib/aceternity-globe";
import type { ProbeResult } from "@/lib/types";

const fiveRegionResults: ProbeResult[] = [
  {
    region: "iad",
    label: "US East (Ashburn)",
    lat: 39.0438,
    lng: -77.4874,
    totalMs: 120,
    statusCode: 200,
    error: null,
    testedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    region: "lhr",
    label: "Europe West (London)",
    lat: 51.5072,
    lng: -0.1276,
    totalMs: 150,
    statusCode: 200,
    error: null,
    testedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    region: "sin",
    label: "Asia Southeast (Singapore)",
    lat: 1.3521,
    lng: 103.8198,
    totalMs: 180,
    statusCode: 200,
    error: null,
    testedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    region: "syd",
    label: "Australia East (Sydney)",
    lat: -33.8688,
    lng: 151.2093,
    totalMs: 210,
    statusCode: 200,
    error: null,
    testedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    region: "gru",
    label: "South America (Sao Paulo)",
    lat: -23.5558,
    lng: -46.6396,
    totalMs: 240,
    statusCode: 200,
    error: null,
    testedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("probeResultsToGlobeArcs", () => {
  it("creates one arc per probe result", () => {
    const arcs = probeResultsToGlobeArcs(fiveRegionResults);

    expect(arcs).toHaveLength(5);
    expect(arcs.map((arc) => arc.endLat)).toEqual(fiveRegionResults.map((result) => result.lat));
    expect(arcs.map((arc) => arc.endLng)).toEqual(fiveRegionResults.map((result) => result.lng));
  });

  it("uses a shared hub for arc starts", () => {
    const arcs = probeResultsToGlobeArcs(fiveRegionResults);
    const hubLat = arcs[0]?.startLat;
    const hubLng = arcs[0]?.startLng;

    expect(arcs.every((arc) => arc.startLat === hubLat && arc.startLng === hubLng)).toBe(true);
    expect(hubLat).not.toBe(fiveRegionResults[0]?.lat);
  });
});

describe("probeResultsToGlobePoints", () => {
  it("creates one distinct marker per probe region", () => {
    const points = probeResultsToGlobePoints(fiveRegionResults);
    const uniqueCoordinates = new Set(points.map((point) => `${point.lat}:${point.lng}`));

    expect(points).toHaveLength(5);
    expect(uniqueCoordinates.size).toBe(5);
  });

  it("keeps a single marker when only one probe ran", () => {
    const points = probeResultsToGlobePoints([fiveRegionResults[0]!]);

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ lat: 39.0438, lng: -77.4874 });
  });
});
