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

export const LATENCYMAP_GLOBE_CONFIG: GlobeConfig = {
  globeColor: "#0a0a0a",
  atmosphereColor: "#f6821f",
  atmosphereAltitude: 0.14,
  polygonColor: "rgba(255,255,255,0.04)",
  ambientLight: "#ffffff",
  directionalLeftLight: "#f6821f",
  directionalTopLight: "#ffffff",
  pointLight: "#f6821f",
  showAtmosphere: true,
  autoRotate: true,
  autoRotateSpeed: 0.35,
};
