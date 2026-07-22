import { latencyHexColor } from "@/lib/latency-display";
import type { ProbeResult } from "@/lib/types";
import type { GlobeConfig } from "@/components/ui/globe";

export type GlobeArc = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

export function probeResultsToGlobePoints(
  results: ProbeResult[],
  selectedRegion: string | null = null,
) {
  return probeResultsToGlobeArcs(results, selectedRegion).map((arc) => ({
    order: arc.order,
    color: arc.color,
    lat: arc.endLat,
    lng: arc.endLng,
  }));
}

export function probeResultsToGlobeArcs(
  results: ProbeResult[],
  selectedRegion: string | null = null,
): GlobeArc[] {
  if (results.length === 0) {
    return [];
  }

  const hub = results.reduce(
    (acc, result) => ({
      lat: acc.lat + result.lat / results.length,
      lng: acc.lng + result.lng / results.length,
    }),
    { lat: 0, lng: 0 },
  );

  return results.map((result, order) => {
    const color =
      selectedRegion === result.region ? "#ffffff" : latencyHexColor(result.totalMs, result.error);

    return {
      order,
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: result.lat,
      endLng: result.lng,
      arcAlt: selectedRegion === result.region ? 0.32 : 0.2,
      color,
    };
  });
}

/** Muted arcs for the terminal home — grey probes, orange accent on selection. */
export function probeResultsToTerminalGlobeArcs(
  results: ProbeResult[],
  selectedRegion: string | null = null,
): GlobeArc[] {
  if (results.length === 0) {
    return [];
  }

  const hub = results.reduce(
    (acc, result) => ({
      lat: acc.lat + result.lat / results.length,
      lng: acc.lng + result.lng / results.length,
    }),
    { lat: 0, lng: 0 },
  );

  return results.map((result, order) => {
    const failed = Boolean(result.error || result.totalMs === null);
    const selected = selectedRegion === result.region;
    const color = selected ? "#f6821f" : failed ? "#3d3d3d" : "#5a5a5a";

    return {
      order,
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: result.lat,
      endLng: result.lng,
      arcAlt: selected ? 0.14 : 0.08,
      color,
    };
  });
}

export const LATENCYMAP_GLOBE_CONFIG: GlobeConfig = {
  globeColor: "#050505",
  emissive: "#000000",
  emissiveIntensity: 0,
  shininess: 0.2,
  atmosphereColor: "#f6821f",
  atmosphereAltitude: 0.06,
  polygonColor: "rgba(255,255,255,0.025)",
  ambientLight: "#d4d4d4",
  directionalLeftLight: "#c45a10",
  directionalTopLight: "#ffffff",
  pointLight: "#f6821f",
  showAtmosphere: true,
  autoRotate: true,
  autoRotateSpeed: 0.22,
};

/** Flat, ink-black globe that sits on the terminal canvas without a widget frame. */
export const TERMINAL_GLOBE_CONFIG: GlobeConfig = {
  globeColor: "#000000",
  emissive: "#000000",
  emissiveIntensity: 0,
  shininess: 0.04,
  atmosphereColor: "#111111",
  atmosphereAltitude: 0.015,
  polygonColor: "rgba(255,255,255,0.04)",
  ambientLight: "#707070",
  directionalLeftLight: "#3a3a3a",
  directionalTopLight: "#8a8a8a",
  pointLight: "#4a4a4a",
  showAtmosphere: false,
  autoRotate: true,
  autoRotateSpeed: 0.1,
  arcTime: 3200,
  arcLength: 0.55,
  rings: 0,
  maxRings: 0,
  pointSize: 0.65,
};
