"use client";

import { useState, type ReactNode } from "react";
import {
  formatLatency,
  formatProbeMetadataValue,
  formatProbeStatus,
  formatProbeTimestamp,
  isProbeFailed,
  latencyHexColor,
  sortResultsByRegionOrder,
} from "@/lib/results";
import { probeCountryName } from "@/lib/regions";
import type { ProbeResult } from "@/lib/types";

export function CmdLabel() {
  return (
    <>
      <span className="terminal__cmd-latency">latency</span>{" "}
      <span className="terminal__cmd-map">map</span>
    </>
  );
}

export function useCopyShareLink(sharePath: string | null) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  async function copyShareLink() {
    if (!sharePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  }

  return { copyState, copyShareLink };
}

type ResultsPanelProps = {
  results: ProbeResult[];
  footer?: ReactNode;
};

function ProbeInspector({ result }: { result: ProbeResult }) {
  const failed = isProbeFailed(result);
  const latencyColor = latencyHexColor(result.totalMs, result.error);

  return (
    <dl className="terminal__inspector" aria-label={`Probe details for ${probeCountryName(result.region)}`}>
      <div className="terminal__inspector-row">
        <dt>latency</dt>
        <dd style={{ color: failed ? undefined : latencyColor }}>
          {failed ? formatProbeStatus(result) : formatLatency(result)}
        </dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>status</dt>
        <dd>{formatProbeMetadataValue(result.statusCode)}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>region</dt>
        <dd>{result.label}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>colo</dt>
        <dd>{formatProbeMetadataValue(result.cloudflareColo)}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>placement</dt>
        <dd>{formatProbeMetadataValue(result.placementRegion)}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>tested at</dt>
        <dd>{formatProbeTimestamp(result.testedAt)}</dd>
      </div>
    </dl>
  );
}

export function ResultsPanel({ results, footer }: ResultsPanelProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const orderedResults = sortResultsByRegionOrder(results);
  const currentRegion = selectedRegion ?? orderedResults[0]?.region ?? null;
  const selectedResult = orderedResults.find((result) => result.region === currentRegion) ?? null;

  return (
    <>
      <p className="terminal__log terminal__log--complete" role="status">
        <span className="terminal__arrow">✓</span>
        probe complete · {results.length} regions
      </p>
      <div className="terminal__results-body">
        <h2 className="terminal__section-title">results</h2>
        <ul className="terminal__table" aria-label="Latency by country">
          {orderedResults.map((result, index) => {
            const failed = isProbeFailed(result);
            const selected = currentRegion === result.region;
            return (
              <li key={result.region} className="terminal__table-item">
                <button
                  type="button"
                  className={[
                    "terminal__table-row",
                    selected ? "terminal__table-row--selected" : null,
                    failed ? "terminal__table-row--failed" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ animationDelay: `${index * 45}ms` }}
                  onClick={() => setSelectedRegion(result.region)}
                >
                  <span className="terminal__region">{probeCountryName(result.region)}</span>
                  <span
                    className={["terminal__ms", failed ? "terminal__ms--failed" : null]
                      .filter(Boolean)
                      .join(" ")}
                    style={failed ? undefined : { color: latencyHexColor(result.totalMs, result.error) }}
                  >
                    {failed ? formatProbeStatus(result) : formatLatency(result)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {selectedResult ? <ProbeInspector result={selectedResult} /> : null}
      </div>
      {footer ? <p className="terminal__log terminal__log--footer">{footer}</p> : null}
    </>
  );
}
