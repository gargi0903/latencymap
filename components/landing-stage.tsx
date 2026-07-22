"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const PROBE_REGIONS = [
  { id: "iad", label: "Virginia", x: 28, y: 38 },
  { id: "lhr", label: "London", x: 48, y: 30 },
  { id: "sin", label: "Singapore", x: 74, y: 52 },
  { id: "syd", label: "Sydney", x: 82, y: 72 },
  { id: "gru", label: "São Paulo", x: 34, y: 68 },
] as const;

const HUB = { x: 50, y: 50 };

function arcPath(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 10;
  return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
}

type ConstellationProps = {
  className?: string;
  activeRegions?: string[];
  idPrefix?: string;
  accentColor?: string;
};

export function ProbeConstellation({
  className,
  activeRegions = [],
  idPrefix = "stage",
  accentColor = "#f6821f",
}: ConstellationProps) {
  const glowId = `${idPrefix}-glow`;
  const filterId = `${idPrefix}-node-glow`;

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.35" />
          <stop offset="55%" stopColor={accentColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={HUB.x} cy={HUB.y} r="38" fill={`url(#${glowId})`} className="stage-hub-glow" />

      {PROBE_REGIONS.map((region, index) => {
        const active = activeRegions.includes(region.id);
        return (
          <path
            key={`arc-${region.id}`}
            d={arcPath(HUB.x, HUB.y, region.x, region.y)}
            fill="none"
            stroke={accentColor}
            strokeWidth={active ? "0.55" : "0.3"}
            strokeOpacity={active ? 0.95 : 0.22}
            strokeDasharray={active ? "none" : "2 2.5"}
            className={active ? "stage-arc-active" : "probe-arc"}
            style={{ animationDelay: `${index * 0.35}s` }}
          />
        );
      })}

      <circle cx={HUB.x} cy={HUB.y} r="2.2" fill={accentColor} filter={`url(#${filterId})`} className="probe-hub" />

      {PROBE_REGIONS.map((region, index) => {
        const active = activeRegions.includes(region.id);
        return (
          <g key={region.id}>
            <circle
              cx={region.x}
              cy={region.y}
              r={active ? "3.2" : "2.2"}
              fill={active ? accentColor : "#0a1218"}
              stroke={accentColor}
              strokeWidth={active ? "0" : "0.55"}
              className="probe-node"
              filter={active ? `url(#${filterId})` : undefined}
              style={{ animationDelay: `${index * 0.45}s` }}
            />
            <text
              x={region.x}
              y={region.y + (active ? 5.8 : 5.2)}
              textAnchor="middle"
              className={cn(
                "text-[3px] font-medium uppercase tracking-[0.1em]",
                active ? "fill-white" : "fill-[#ffc48a]",
              )}
            >
              {region.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type ScanOverlayProps = {
  url: string;
  activeRegions: string[];
};

export function ScanOverlay({ url, activeRegions }: ScanOverlayProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 480);
    return () => window.clearInterval(interval);
  }, []);

  const dots = ".".repeat((tick % 3) + 1);

  return (
    <div className="stage-scan-overlay" role="status" aria-live="polite">
      <ProbeConstellation className="stage-scan-constellation" activeRegions={activeRegions} />
      <div className="stage-scan-copy">
        <p className="stage-scan-eyebrow">Measuring worldwide</p>
        <p className="stage-scan-url">{url}</p>
        <p className="stage-scan-status">
          Lighting up probes{dots}
        </p>
        <div className="stage-scan-regions">
          {PROBE_REGIONS.map((region) => (
            <span
              key={region.id}
              className={cn(
                "stage-scan-pill",
                activeRegions.includes(region.id) && "stage-scan-pill--active",
              )}
            >
              {region.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const EXAMPLE_URLS = [
  { label: "GitHub API", url: "https://api.github.com" },
  { label: "Cloudflare", url: "https://www.cloudflare.com/cdn-cgi/trace" },
  { label: "httpbin", url: "https://httpbin.org/get" },
] as const;
