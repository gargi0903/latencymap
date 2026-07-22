"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { GlobeConfig } from "@/components/ui/globe";
import type { ProbeResult } from "@/lib/types";

const World = dynamic(() => import("@/components/ui/globe").then((module) => module.World), {
  ssr: false,
  loading: () => <div className="globe-loading">Loading globe</div>,
});

const globeConfig: GlobeConfig = {
  pointSize: 2.6,
  globeColor: "#071923",
  showAtmosphere: true,
  atmosphereColor: "#4dd0c8",
  atmosphereAltitude: 0.18,
  emissive: "#071923",
  emissiveIntensity: 0.18,
  shininess: 0.65,
  polygonColor: "rgba(142, 232, 216, 0.52)",
  ambientLight: "#6ee7e1",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#d8fffb",
  pointLight: "#8ee8d8",
  arcTime: 1200,
  arcLength: 0.85,
  rings: 2,
  maxRings: 5,
  autoRotate: true,
  autoRotateSpeed: 0.55,
};

type Props = {
  results: ProbeResult[];
  selectedRegion: string | null;
};

export function GlobePanel({ results, selectedRegion }: Props) {
  const points = useMemo(
    () =>
      results.map((result, index) => ({
        order: index + 1,
        lat: result.lat,
        lng: result.lng,
        color: colorForLatency(result.totalMs, result.error),
        size: selectedRegion === result.region ? 3.8 : 2.6,
      })),
    [results, selectedRegion],
  );

  return (
    <div className="globe-panel">
      <div className="panel-heading globe-heading">
        <div>
          <p className="eyebrow">Interactive globe</p>
          <h2>Probe regions</h2>
        </div>
        <div className="legend">
          <span><i className="legend-good" />Fast</span>
          <span><i className="legend-warn" />Okay</span>
          <span><i className="legend-bad" />Slow</span>
        </div>
      </div>
      <div className="globe-frame">
        <World globeConfig={globeConfig} points={points} />
      </div>
    </div>
  );
}

function colorForLatency(totalMs: number | null, error: string | null) {
  if (error || totalMs === null) {
    return "#8a93a3";
  }

  if (totalMs < 150) {
    return "#37d67a";
  }

  if (totalMs <= 300) {
    return "#f3c742";
  }

  return "#ff5d5d";
}
