"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { formatLatency, formatProbeStatus, latencyHexColor } from "@/lib/latency-display";
import type { ProbeResult } from "@/lib/types";
import type { GlobeProps } from "react-globe.gl";

const Globe = dynamic<GlobeProps>(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[340px] place-items-center text-sm text-muted-foreground sm:h-[440px]">
      Loading globe
    </div>
  ),
});

type GlobePoint = {
  region: string;
  label: string;
  latency: string;
  status: string;
  colo: string;
  lat: number;
  lng: number;
  color: string;
  radius: number;
  altitude: number;
};

type Props = {
  results: ProbeResult[];
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
};

export function GlobePanel({ results, selectedRegion, onSelectRegion }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);
  const points = useMemo(
    () =>
      results.map((result) => ({
        region: result.region,
        label: result.label,
        latency: formatLatency(result),
        status: formatProbeStatus(result),
        colo: result.cloudflareColo ?? "n/a",
        lat: result.lat,
        lng: result.lng,
        color: latencyHexColor(result.totalMs, result.error),
        radius: selectedRegion === result.region ? 0.7 : 0.42,
        altitude: selectedRegion === result.region ? 0.04 : 0.02,
      })),
    [results, selectedRegion],
  );
  const selectedResult = results.find((result) => result.region === selectedRegion) ?? results[0];

  return (
    <section className="min-w-0 rounded-[2px] border border-[#264552] bg-[#10212d] p-[18px] text-white">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-medium leading-tight text-[#b9cbff]">INTERACTIVE MAP</p>
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
        <div ref={frameRef} className="h-[340px] overflow-hidden border border-[#264552] bg-[#0a1821] sm:h-[440px]">
          {size.width > 0 ? (
            <Globe
              width={size.width}
              height={size.height}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="/earth-texture.svg"
              bumpImageUrl="/earth-bump.svg"
              showAtmosphere
              atmosphereColor="#2457f5"
              atmosphereAltitude={0.18}
              pointsData={points}
              pointLat="lat"
              pointLng="lng"
              pointColor="color"
              pointRadius="radius"
              pointAltitude="altitude"
              pointResolution={24}
              pointsMerge={false}
              pointLabel={(point) => pointLabel(point as GlobePoint)}
              onPointHover={(point) => onSelectRegion((point as GlobePoint | null)?.region ?? null)}
              onPointClick={(point) => onSelectRegion((point as GlobePoint).region)}
            />
          ) : null}
        </div>
        {selectedResult ? (
          <div className="mt-3 grid gap-2 border-t border-[#264552] pt-3 sm:grid-cols-4">
            <InspectorValue label="Selected probe" value={selectedResult.label} />
            <InspectorValue label="Latency" value={formatLatency(selectedResult)} />
            <InspectorValue label="Status" value={formatProbeStatus(selectedResult)} />
            <InspectorValue
              label="Cloudflare colo"
              value={selectedResult.cloudflareColo ?? "n/a"}
              title={selectedResult.placementRegion ?? undefined}
            />
          </div>
        ) : null}
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

function InspectorValue({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block font-mono text-xs font-medium text-[#c5d0d6]">{label}</span>
      <strong className="block truncate text-sm" title={title ?? value}>{value}</strong>
    </div>
  );
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [ref]);

  return size;
}

function pointLabel(point: GlobePoint) {
  return [
    `<strong>${escapeHtml(point.label)}</strong>`,
    `${escapeHtml(point.latency)} · ${escapeHtml(point.status)}`,
    `Cloudflare colo ${escapeHtml(point.colo)}`,
  ].join("<br />");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
