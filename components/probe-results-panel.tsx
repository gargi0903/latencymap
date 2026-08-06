"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  formatLatency,
  formatProbeMetadataValue,
  formatProbeStatus,
  formatProbeTimestamp,
  isProbeFailed,
  latencyHexColor,
  latencyMeasurementNote,
} from "@/lib/latency-display";
import { defaultSelectedRegion, sortResultsByRegionOrder } from "@/lib/result-order";
import { probeCountryName } from "@/lib/probe-regions";
import type { ProbeResult } from "@/lib/types";

type Props = {
  results: ProbeResult[];
  regionCountLabel?: string;
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

export function ProbeResultsPanel({ results, regionCountLabel, footer }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const orderedResults = useMemo(() => sortResultsByRegionOrder(results), [results]);
  const currentRegion = selectedRegion ?? defaultSelectedRegion(results);
  const selectedResult = orderedResults.find((result) => result.region === currentRegion) ?? null;

  return (
    <>
      <p className="terminal__log terminal__log--complete" role="status">
        <span className="terminal__arrow">✓</span>
        probe complete · {regionCountLabel ?? `${results.length} regions`}
      </p>

      <div className="terminal__results-body">
        <h2 className="terminal__section-title">results</h2>
        <div className="terminal__table" role="list" aria-label="Latency by country">
          {orderedResults.map((result, index) => {
            const selected = currentRegion === result.region;
            const failed = isProbeFailed(result);

            return (
              <button
                key={result.region}
                type="button"
                className={[
                  "terminal__table-row",
                  selected ? "terminal__table-row--selected" : null,
                  failed ? "terminal__table-row--failed" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="listitem"
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
            );
          })}
        </div>

        {selectedResult ? <ProbeInspector result={selectedResult} /> : null}

        <p className="terminal__log terminal__log--muted terminal__results-note">{latencyMeasurementNote()}</p>
      </div>

      {footer ? <p className="terminal__log terminal__log--footer">{footer}</p> : null}
    </>
  );
}
