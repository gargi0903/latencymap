"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatLatency, formatProbeStatus } from "@/lib/latency-display";
import { probeCountryName } from "@/lib/probe-regions";
import { sharePathForRun } from "@/lib/share-payload";
import type { ProbeResult, TestRun } from "@/lib/types";

type Props = {
  initialRun: TestRun;
};

function sortResultsByLatencyDesc(results: ProbeResult[]) {
  return [...results].sort((a, b) => {
    if (a.totalMs === null && b.totalMs === null) return 0;
    if (a.totalMs === null) return 1;
    if (b.totalMs === null) return -1;
    return b.totalMs - a.totalMs;
  });
}

function CmdLabel() {
  return (
    <>
      <span className="terminal__cmd-latency">latency</span>{" "}
      <span className="terminal__cmd-map">map</span>
    </>
  );
}

export function ResultsView({ initialRun }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const sharePath = sharePathForRun(initialRun);
  const sortedResults = useMemo(
    () => sortResultsByLatencyDesc(initialRun.results),
    [initialRun.results],
  );
  const currentRegion = selectedRegion ?? sortedResults[0]?.region ?? null;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  }

  return (
    <section
      className="terminal__session terminal__session--results"
      aria-label="Shared latency results"
    >
      <div className="terminal__console">
        <p className="terminal__boot-line terminal__boot-line--brand terminal__masthead">
          <CmdLabel />
        </p>
        <p className="terminal__line terminal__line--prompt">
          <span className="terminal__prefix">
            <span className="terminal__prompt" aria-hidden="true">
              $
            </span>
          </span>
          <span className="terminal__input terminal__input--static" title={initialRun.normalizedUrl}>
            {initialRun.normalizedUrl}
          </span>
        </p>
      </div>

      <div className="terminal__workspace">
        <div className="terminal__feed">
          <p className="terminal__log terminal__log--complete" role="status">
            <span className="terminal__arrow">✓</span>
            probe complete · {initialRun.results.length} regions
          </p>

          <div className="terminal__results-body">
            <h2 className="terminal__section-title">results</h2>
            <div className="terminal__table" role="list" aria-label="Latency by country">
              {sortedResults.map((result, index) => {
                const selected = currentRegion === result.region;
                const failed = Boolean(result.error || result.totalMs === null);

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
                    aria-selected={selected}
                    style={{ animationDelay: `${index * 45}ms` }}
                    onClick={() => setSelectedRegion(result.region)}
                  >
                    <span className="terminal__region">{probeCountryName(result.region)}</span>
                    <span
                      className={["terminal__ms", failed ? "terminal__ms--failed" : null]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {failed ? formatProbeStatus(result) : formatLatency(result)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="terminal__log terminal__log--footer">
            <Link href="/" className="terminal__link">
              new test
            </Link>
            <span aria-hidden="true"> · </span>
            <button
              type="button"
              className="terminal__link"
              title="Copy permanent share link"
              onClick={copyShareLink}
            >
              {copyState === "copied" ? "copied" : "share"}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
