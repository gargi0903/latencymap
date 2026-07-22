"use client";

import { Check, Copy, ExternalLink, Globe2, TableProperties } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GlobePanel } from "@/components/globe-panel";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatProbeDateTime, formatProbeTime } from "@/lib/datetime-display";
import { formatLatency, latencyTailwindClass } from "@/lib/latency-display";
import type { ProbeResult, TestRun } from "@/lib/types";

type Props = {
  initialRun: TestRun;
  initialHistory?: TestRun[];
};

export function ResultsView({ initialRun, initialHistory = [] }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [view, setView] = useState<"globe" | "table">("globe");
  const summary = useMemo(() => summarize(initialRun), [initialRun]);
  const sharePath = `/r/${initialRun.id}`;
  const currentRegion = selectedRegion ?? initialRun.results[0]?.region ?? null;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  const globe = (
    <GlobePanel
      results={initialRun.results}
      selectedRegion={currentRegion}
      onSelectRegion={setSelectedRegion}
    />
  );
  const table = (
    <ProbeTablePanel
      run={initialRun}
      currentRegion={currentRegion}
      onSelectRegion={setSelectedRegion}
    />
  );
  const share = (
    <SharePanel
      sharePath={sharePath}
      createdAt={initialRun.createdAt}
      copyState={copyState}
      onCopy={copyShareLink}
    />
  );
  const historyPanel = (
    <HistoryPanel
      currentRun={initialRun}
      history={initialHistory.length ? initialHistory : [initialRun]}
    />
  );

  return (
    <div className="grid gap-6">
      <section className="flex flex-col items-start justify-between gap-3.5 border-b border-border pb-5 sm:flex-row sm:gap-5">
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium leading-tight text-[#173baf]">LATEST RESULT</p>
          <h2 title={initialRun.normalizedUrl} className="max-w-[calc(100vw-2rem)] truncate font-mono text-[15px] font-semibold leading-[1.45] sm:max-w-[min(760px,68vw)]">{initialRun.normalizedUrl}</h2>
          <span className="mt-1 block text-[13px] text-muted-foreground">Tested {formatProbeDateTime(initialRun.createdAt)} · {summary.successRate} probes completed</span>
        </div>
        <div className="flex w-full flex-none items-center justify-between gap-2.5 sm:w-auto">
          <ViewSwitcher view={view} onChange={setView} />
          <Button asChild size="icon" variant="outline" title="Open share page" className="rounded-[2px] border-border bg-white text-muted-foreground shadow-none hover:border-primary hover:bg-secondary hover:text-accent-foreground">
            <Link href={`/r/${initialRun.id}`}><ExternalLink /></Link>
          </Button>
        </div>
      </section>
      <section aria-label="Test summary" className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <Metric label="Outcome" value={summary.outcome} tone={summary.tone} />
        <Metric label="Fastest" value={summary.fastest} />
        <Metric label="Slowest" value={summary.slowest} />
        <Metric label="Success" value={summary.successRate} />
      </section>
      <section className="min-w-0">{view === "globe" ? globe : table}</section>
      <section className="grid gap-5 sm:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)] sm:gap-6">
        {share}
        {historyPanel}
      </section>
    </div>
  );
}

function ViewSwitcher({ view, onChange }: { view: "globe" | "table"; onChange: (view: "globe" | "table") => void }) {
  return (
    <div className="inline-flex rounded-[2px] border border-border bg-white p-0.5" role="group" aria-label="Result view">
      <Button type="button" variant="ghost" className={cn("h-8 gap-1.5 px-2.5 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground", view === "globe" && "bg-secondary font-semibold text-accent-foreground hover:bg-secondary hover:text-accent-foreground")} aria-pressed={view === "globe"} onClick={() => onChange("globe")}>
        <Globe2 /> Globe
      </Button>
      <Button type="button" variant="ghost" className={cn("h-8 gap-1.5 px-2.5 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground", view === "table" && "bg-secondary font-semibold text-accent-foreground hover:bg-secondary hover:text-accent-foreground")} aria-pressed={view === "table"} onClick={() => onChange("table")}>
        <TableProperties /> Table
      </Button>
    </div>
  );
}

function ProbeTablePanel({
  run,
  currentRegion,
  onSelectRegion,
}: {
  run: TestRun;
  currentRegion: string | null;
  onSelectRegion: (region: string | null) => void;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[2px] border border-border bg-white">
      <header className="flex items-center justify-between gap-3 p-[18px]">
        <div>
          <p className="font-mono text-xs font-medium leading-tight text-[#173baf]">REGIONAL EVIDENCE</p>
          <h2 className="mt-[3px] text-lg font-semibold leading-tight">Probe results</h2>
        </div>
      </header>
      <div className="overflow-x-auto border-t">
        <Table className="[&_tbody_tr]:h-[52px] [&_thead]:bg-secondary">
          <TableHeader>
            <TableRow>
              <TableHead>Region</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cloudflare colo</TableHead>
              <TableHead>Checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.results.map((result) => (
              <ProbeRow
                key={result.region}
                result={result}
                selected={currentRegion === result.region}
                onSelectRegion={onSelectRegion}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function ProbeRow({
  result,
  selected,
  onSelectRegion,
}: {
  result: ProbeResult;
  selected: boolean;
  onSelectRegion: (region: string | null) => void;
}) {
  const failed = result.error || result.totalMs === null;

  return (
    <TableRow
      tabIndex={0}
      aria-selected={selected}
      data-state={selected ? "selected" : undefined}
      className={cn("cursor-pointer outline-none data-[state=selected]:bg-secondary focus-visible:ring-2 focus-visible:ring-ring", failed && "text-muted-foreground")}
      onClick={() => onSelectRegion(result.region)}
      onFocus={() => onSelectRegion(result.region)}
      onMouseEnter={() => onSelectRegion(result.region)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectRegion(result.region);
        }
      }}
    >
      <TableCell className="min-w-48 font-medium">
        <span className="inline-flex items-center gap-2">
          <LatencyDot result={result} />
          {result.label}
        </span>
      </TableCell>
      <TableCell>{formatLatency(result)}</TableCell>
      <TableCell>
        <span className="inline-block max-w-44 truncate align-bottom">
          {result.error ?? result.statusCode ?? "n/a"}
        </span>
      </TableCell>
      <TableCell title={result.placementRegion ?? undefined}>{result.cloudflareColo ?? "n/a"}</TableCell>
      <TableCell>{formatProbeTime(result.testedAt)}</TableCell>
    </TableRow>
  );
}

function SharePanel({
  sharePath,
  createdAt,
  copyState,
  onCopy,
}: {
  sharePath: string;
  createdAt: string;
  copyState: "idle" | "copied" | "failed";
  onCopy: () => void;
}) {
  return (
    <section className="min-w-0 pt-1">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-medium leading-tight text-[#173baf]">SHARE</p>
          <h2 className="mt-[3px] text-lg font-semibold leading-tight">Permanent result</h2>
        </div>
        <Button size="icon" variant="outline" type="button" title="Copy result link" onClick={onCopy} className="rounded-[2px] border-border bg-white text-muted-foreground shadow-none hover:border-primary hover:bg-secondary hover:text-accent-foreground">
          {copyState === "copied" ? <Check /> : <Copy />}
        </Button>
      </header>
      <div className="pt-4">
        <code className="block truncate rounded-[2px] border border-border bg-white p-3 text-sm text-[#173baf]">
          {sharePath}
        </code>
        <p className={cn("mt-2 text-sm text-muted-foreground", copyState === "failed" && "text-destructive")} role="status">
          {copyState === "copied"
            ? "Copied share link"
            : copyState === "failed"
              ? "Clipboard blocked. Open the share page and copy from the address bar."
              : `Created ${formatProbeDateTime(createdAt)}`}
        </p>
      </div>
    </section>
  );
}

function HistoryPanel({ currentRun, history }: { currentRun: TestRun; history: TestRun[] }) {
  return (
    <section className="min-w-0 pt-1">
      <header className="flex items-center justify-between gap-3">
        <div><p className="font-mono text-xs font-medium leading-tight text-[#173baf]">HISTORY</p><h2 className="mt-[3px] text-lg font-semibold leading-tight">Recent runs for this URL</h2></div>
      </header>
      <div className="grid gap-1 pt-4">
        {history.map((run) => (
          <Button
            key={run.id}
            asChild
            variant={run.id === currentRun.id ? "secondary" : "outline"}
            className="h-10 justify-between px-3"
          >
            <Link href={`/r/${run.id}`}>
              <span className="truncate text-muted-foreground">{formatProbeDateTime(run.createdAt)}</span>
              <strong className="whitespace-nowrap text-foreground">{summarize(run).median}</strong>
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "failed";
}) {
  return (
    <div className="min-w-0 p-3.5 px-4 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(3)]:border-t max-sm:[&:nth-child(4)]:border-t">
      <span className="font-mono text-xs font-medium leading-tight text-muted-foreground">{label}</span>
      <strong className={cn("mt-[5px] block truncate text-[17px] leading-tight tabular-nums", toneClass(tone))} title={value}>
        {value}
      </strong>
    </div>
  );
}

function LatencyDot({ result }: { result: ProbeResult }) {
  return <span className={cn("size-2.5 rounded-full", latencyTailwindClass(result.totalMs, result.error))} aria-hidden="true" />;
}

function summarize(run: TestRun) {
  const successful = run.results
    .map((result) => result.totalMs)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  if (successful.length === 0) {
    return {
      outcome: "All probes failed",
      fastest: "n/a",
      slowest: "n/a",
      median: "n/a",
      successRate: "0%",
      tone: "failed" as const,
    };
  }

  const failures = run.results.length - successful.length;
  const httpErrors = run.results.filter(
    (result) => typeof result.statusCode === "number" && result.statusCode >= 400,
  ).length;
  const slowest = successful[successful.length - 1];
  return {
    outcome:
      failures > 0
        ? `${failures} failed`
        : httpErrors > 0
          ? `${httpErrors} HTTP error${httpErrors === 1 ? "" : "s"}`
          : slowest > 300
            ? "Degraded"
            : "Healthy",
    fastest: `${successful[0]} ms`,
    slowest: `${slowest} ms`,
    median: `${successful[Math.floor(successful.length / 2)]} ms median`,
    successRate: `${Math.round((successful.length / run.results.length) * 100)}%`,
    tone:
      failures > 0
        ? "failed" as const
        : httpErrors > 0 || slowest > 300
          ? "bad" as const
          : slowest >= 150
            ? "warn" as const
            : "good" as const,
  };
}

function toneClass(tone?: "good" | "warn" | "bad" | "failed") {
  if (tone === "good") return "text-[#16833a]";
  if (tone === "warn") return "text-[#b26a00]";
  if (tone === "bad") return "text-[#c3362b]";
  if (tone === "failed") return "text-[#737b8c]";
  return undefined;
}

