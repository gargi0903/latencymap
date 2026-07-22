"use client";

import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GlobePanel } from "@/components/globe-panel";
import type { TestRun } from "@/lib/types";

type Props = {
  initialRun: TestRun;
  initialHistory?: TestRun[];
};

export function ResultsView({ initialRun, initialHistory = [] }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const summary = useMemo(() => summarize(initialRun), [initialRun]);
  const sharePath = `/r/${initialRun.id}`;

  return (
    <div className="results-stack">
      <section className="summary-grid" aria-label="Test summary">
        <Metric label="Target" value={initialRun.normalizedUrl} wide />
        <Metric label="Fastest" value={summary.fastest} />
        <Metric label="Slowest" value={summary.slowest} />
        <Metric label="Success" value={summary.successRate} />
      </section>

      <section className="results-layout">
        <GlobePanel
          results={initialRun.results}
          selectedRegion={selectedRegion}
        />
        <div className="table-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Run {initialRun.id.slice(0, 8)}</p>
              <h2>Probe results</h2>
            </div>
            <Link href={sharePath} className="icon-link" title="Open share page">
              <ExternalLink size={18} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Latency</th>
                  <th>Status</th>
                  <th>CF colo</th>
                  <th>Checked</th>
                </tr>
              </thead>
              <tbody>
                {initialRun.results.map((result) => (
                  <tr
                    key={result.region}
                    className={selectedRegion === result.region ? "selected-row" : undefined}
                    onMouseEnter={() => setSelectedRegion(result.region)}
                  >
                    <td>
                      <span className={`dot ${latencyClass(result.totalMs, result.error)}`} />
                      {result.label}
                    </td>
                    <td>{result.totalMs === null ? "Failed" : `${result.totalMs} ms`}</td>
                    <td>{result.statusCode ?? "n/a"}</td>
                    <td title={result.placementRegion ?? undefined}>{result.cloudflareColo ?? "n/a"}</td>
                    <td>{formatTime(result.testedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="lower-grid">
        <div className="detail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Share</p>
              <h2>Permanent result</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Copy result path"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}${sharePath}`)}
            >
              <Copy size={18} />
            </button>
          </div>
          <code className="share-code">{sharePath}</code>
          <p className="muted">Created {formatDateTime(initialRun.createdAt)}</p>
        </div>

        <div className="detail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2>Recent runs for this URL</h2>
            </div>
          </div>
          <div className="history-list">
            {(initialHistory.length ? initialHistory : [initialRun]).map((run) => (
              <Link key={run.id} href={`/r/${run.id}`} className="history-row">
                <span>{formatDateTime(run.createdAt)}</span>
                <strong>{summarize(run).median}</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "metric metric-wide" : "metric"}>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function summarize(run: TestRun) {
  const successful = run.results
    .map((result) => result.totalMs)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  if (successful.length === 0) {
    return {
      fastest: "n/a",
      slowest: "n/a",
      median: "n/a",
      successRate: "0%",
    };
  }

  const median = successful[Math.floor(successful.length / 2)];
  return {
    fastest: `${successful[0]} ms`,
    slowest: `${successful[successful.length - 1]} ms`,
    median: `${median} ms median`,
    successRate: `${Math.round((successful.length / run.results.length) * 100)}%`,
  };
}

function latencyClass(totalMs: number | null, error: string | null) {
  if (error || totalMs === null) {
    return "latency-failed";
  }

  if (totalMs < 150) {
    return "latency-good";
  }

  if (totalMs <= 300) {
    return "latency-warn";
  }

  return "latency-bad";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
