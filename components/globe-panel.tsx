"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  LATENCYMAP_GLOBE_CONFIG,
  TERMINAL_GLOBE_CONFIG,
  probeResultsToGlobeArcs,
  probeResultsToTerminalGlobeArcs,
} from "@/lib/aceternity-globe";
import { formatLatency, formatProbeStatus } from "@/lib/latency-display";
import { probeCountryName } from "@/lib/probe-regions";
import type { ProbeResult } from "@/lib/types";

const AceternityWorld = dynamic(() => import("@/components/ui/globe").then((module) => module.World), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[18rem] place-items-center text-sm text-[#8a8a8a]">Loading globe</div>
  ),
});

type Props = {
  results: ProbeResult[];
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  variant?: "default" | "minimal";
};

export function GlobePanel({ results, selectedRegion, onSelectRegion, variant = "default" }: Props) {
  const isTerminal = variant === "minimal";
  const arcs = useMemo(
    () =>
      isTerminal
        ? probeResultsToTerminalGlobeArcs(results, selectedRegion)
        : probeResultsToGlobeArcs(results, selectedRegion),
    [isTerminal, results, selectedRegion],
  );
  const selectedResult = results.find((result) => result.region === selectedRegion) ?? results[0];

  const globe = (
    <AceternityWorld
      globeConfig={isTerminal ? TERMINAL_GLOBE_CONFIG : LATENCYMAP_GLOBE_CONFIG}
      data={arcs}
      className="h-full w-full"
      sceneVariant={isTerminal ? "terminal" : "default"}
    />
  );

  if (isTerminal) {
    return <div className="terminal-globe">{globe}</div>;
  }

  return (
    <section className="min-w-0 rounded-[2px] border border-[#264552] bg-[#0a0a0a] p-[18px] text-white">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium leading-tight text-[var(--brand-orange-light)]">INTERACTIVE MAP</p>
          <h2 className="mt-[3px] text-lg font-semibold leading-tight">Probe regions</h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs text-[#c5d0d6]">
          <LegendDot className="bg-[#16833a]" label="Fast" />
          <LegendDot className="bg-[#b26a00]" label="Moderate" />
          <LegendDot className="bg-[#c3362b]" label="Slow" />
          <LegendDot className="bg-[#737b8c]" label="Failed" />
        </div>
      </header>
      <div className="pt-4">
        <div className="h-[340px] overflow-hidden border border-[#1a1a1a] bg-black sm:h-[440px]">{globe}</div>
        {selectedResult ? (
          <div className="mt-3 grid gap-2 border-t border-[#1a1a1a] pt-3 sm:grid-cols-3">
            <InspectorValue label="Country" value={probeCountryName(selectedResult.region)} />
            <InspectorValue label="Latency" value={formatLatency(selectedResult)} />
            <InspectorValue label="Status" value={formatProbeStatus(selectedResult)} />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {results.map((result) => (
            <button
              key={result.region}
              type="button"
              className={cn(
                "rounded-[2px] border px-2 py-1 text-xs transition-colors",
                selectedRegion === result.region
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-[#1a1a1a] text-[#8a8a8a] hover:border-[#333] hover:text-white",
              )}
              onClick={() => onSelectRegion(result.region)}
            >
              {probeCountryName(result.region)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", className)} aria-hidden="true" />
      {label}
    </span>
  );
}

function InspectorValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-[#8a8a8a]">{label}</span>
      <strong className="block truncate text-sm">{value}</strong>
    </div>
  );
}
