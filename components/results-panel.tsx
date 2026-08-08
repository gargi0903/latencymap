"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  formatLatency,
  formatProbeMetadataValue,
  formatProbeStatus,
  formatProbeTimestamp,
  isProbeFailed,
  latencyHexColor,
  defaultSelectedRegion,
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

  const copyShareLink = useCallback(async () => {
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
  }, [sharePath]);

  return { copyState, copyShareLink };
}

type ResultsPanelProps = {
  results: ProbeResult[];
  footer?: ReactNode;
};

function rowClassName(selected: boolean, failed: boolean) {
  return ["terminal__table-row", selected ? "terminal__table-row--selected" : null, failed ? "terminal__table-row--failed" : null]
    .filter(Boolean)
    .join(" ");
}

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

function ResultLatency({ result }: { result: ProbeResult }) {
  const failed = isProbeFailed(result);
  return (
    <span
      className={["terminal__ms", failed ? "terminal__ms--failed" : null].filter(Boolean).join(" ")}
      style={failed ? undefined : { color: latencyHexColor(result.totalMs, result.error) }}
    >
      {failed ? formatProbeStatus(result) : formatLatency(result)}
    </span>
  );
}

function ResultRow({
  result,
  selected,
  index,
  onSelect,
}: {
  result: ProbeResult;
  selected: boolean;
  index: number;
  onSelect: (region: string) => void;
}) {
  return (
    <li className="terminal__table-item">
      <button
        type="button"
        className={rowClassName(selected, isProbeFailed(result))}
        style={{ animationDelay: `${index * 45}ms` }}
        onClick={() => onSelect(result.region)}
      >
        <span className="terminal__region">{probeCountryName(result.region)}</span>
        <ResultLatency result={result} />
      </button>
    </li>
  );
}

function ResultsBody({
  orderedResults,
  currentRegion,
  selectedResult,
  onSelect,
}: {
  orderedResults: ProbeResult[];
  currentRegion: string | null;
  selectedResult: ProbeResult | null;
  onSelect: (region: string) => void;
}) {
  return (
    <div className="terminal__results-body">
      <h2 className="terminal__section-title">results</h2>
      <ul className="terminal__table" aria-label="Latency by country">
        {orderedResults.map((result, index) => (
          <ResultRow
            key={result.region}
            result={result}
            selected={currentRegion === result.region}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {selectedResult ? <ProbeInspector result={selectedResult} /> : null}
    </div>
  );
}

export function ResultsPanel({ results, footer }: ResultsPanelProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const orderedResults = useMemo(() => sortResultsByRegionOrder(results), [results]);
  const currentRegion = selectedRegion ?? defaultSelectedRegion(results);
  const selectedResult = orderedResults.find((result) => result.region === currentRegion) ?? null;

  return (
    <>
      <p className="terminal__log terminal__log--complete" role="status">
        <span className="terminal__arrow">✓</span>
        probe complete · {results.length} regions
      </p>
      <ResultsBody
        orderedResults={orderedResults}
        currentRegion={currentRegion}
        selectedResult={selectedResult}
        onSelect={setSelectedRegion}
      />
      {footer ? <p className="terminal__log terminal__log--footer">{footer}</p> : null}
    </>
  );
}
