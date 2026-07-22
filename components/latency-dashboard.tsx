"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { LatencymapMark } from "@/components/latencymap-mark";
import { ResultsView } from "@/components/results-view";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TestRun } from "@/lib/types";
import { cn } from "@/lib/utils";

type CreateTestResponse = {
  run: TestRun;
  history: TestRun[];
  error?: string;
};

export function LatencyDashboard() {
  const [url, setUrl] = useState("");
  const [run, setRun] = useState<TestRun | null>(null);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRun(null);
    setHistory([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as CreateTestResponse | null;
        setError(body?.error ?? "Unable to run latency test.");
        return;
      }

      const body = (await response.json()) as CreateTestResponse;

      setRun(body.run);
      setHistory(body.history);
      window.history.replaceState(null, "", `/r/${body.run.id}`);
    } catch {
      setError("Unable to reach the Latencymap API.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/*
        THESIS: A real request is the interface; generic dashboard cards are not.
        OWN-WORLD: Mineral canvas, cobalt command state, field-sheet rules, and quiet white work surfaces.
        STORY: Enter one public URL, understand the bounded request, then inspect regional evidence.
        FIRST VIEWPORT: A single horizontal command band owns the page; its conditions rail anchors the task below.
        FORM: Network field sheet — operational, spare, and built around one submitted URL.
      */}
      <header className="bg-background">
        <div className="mx-auto flex min-h-[112px] w-full max-w-[1180px] items-center justify-center gap-4 px-4 sm:gap-5 sm:px-6 lg:px-7" aria-label="Latencymap">
          <LatencymapMark className="size-14 shrink-0 text-primary sm:size-[68px]" />
          <span className="wordmark wordmark--header">Latencymap</span>
        </div>
      </header>

      <section className={cn("mx-auto grid w-full max-w-[1180px] px-4 sm:px-6 lg:px-7", run ? "gap-7 py-[30px] pb-[42px]" : "min-h-[calc(100svh-56px)] content-start py-16 sm:py-20 lg:py-28")}>
          <div className={cn("w-full", !run && "grid items-start gap-12 lg:grid-cols-[minmax(0,.82fr)_minmax(460px,1.18fr)] lg:gap-16")}>
            {!run ? (
              <div className="max-w-[540px] lg:pt-3">
                <p className="font-mono text-xs font-medium text-[#173baf]">one-time / regional request</p>
                <h1 className="mt-4 max-w-[11ch] text-[clamp(2.25rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-balance">Test an endpoint from the edge.</h1>
                <p className="mt-5 max-w-[50ch] text-[17px] leading-7 text-muted-foreground">Run one bounded request through real regional probes. Get the exact timings, status codes, and execution colos back.</p>
              </div>
            ) : null}

            <form className={cn("grid w-full overflow-hidden", !run && "border border-border bg-white", run && "max-w-[960px]")} aria-label="Run a latency test" onSubmit={onSubmit}>
              <div className={cn("grid gap-3", !run && "p-5 sm:p-6")}>
                <label htmlFor="url" className="font-mono text-xs font-medium leading-tight text-muted-foreground">Public endpoint URL</label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_156px]">
                  <Input
                    id="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://api.example.com/health"
                    spellCheck={false}
                    className="h-12 min-w-0 rounded-[2px] border-input bg-white px-3.5 font-mono text-[15px] shadow-none"
                  />
                  <Button type="submit" disabled={isLoading} className="h-12 rounded-[2px] border border-primary font-semibold shadow-none">
                    {isLoading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    <span>{isLoading ? "Testing" : "Test endpoint"}</span>
                  </Button>
                </div>
                <p className="text-xs leading-[1.45] text-muted-foreground">HTTP/S only. Local and private addresses are blocked before any probe runs.</p>
              </div>
              {!run ? (
                <dl className="grid grid-cols-3 border-t border-border">
                  <Constraint label="Method" value="GET" />
                  <Constraint label="Timeout" value="5 s" />
                  <Constraint label="Redirects" value="3 max" />
                </dl>
              ) : null}
            </form>
          </div>

          {error || isLoading || run ? (
            <section className="min-w-0">
              {isLoading ? (
                <Alert className="mb-4 flex items-center gap-3 rounded-[2px] border-[#b9cbff] bg-secondary text-[#173baf]" role="status">
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  <span className="min-w-0 truncate">Testing {url.trim() || "target URL"}...</span>
                </Alert>
              ) : null}

              {error ? (
                <Alert variant="destructive" className="mb-4">
                  {error}
                </Alert>
              ) : null}

              {run ? <ResultsView initialRun={run} initialHistory={history} /> : null}
            </section>
          ) : null}
      </section>
    </main>
  );
}

function Constraint({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-border p-4 last:border-r-0 sm:p-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
