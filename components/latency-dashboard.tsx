"use client";

import { Activity, Copy, Loader2, Play, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { ResultsView } from "@/components/results-view";
import type { TestRun } from "@/lib/types";

type CreateTestResponse = {
  run: TestRun;
  history: TestRun[];
  error?: string;
};

export function LatencyDashboard() {
  const [url, setUrl] = useState("https://api.github.com");
  const [run, setRun] = useState<TestRun | null>(null);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json()) as CreateTestResponse;

      if (!response.ok) {
        setError(body.error ?? "Unable to run latency test.");
        return;
      }

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
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Latencymap</p>
          <h1>Test API latency from global probes</h1>
        </div>
        <div className="topbar-status">
          <ShieldCheck size={18} />
          <span>Public HTTP/S only</span>
        </div>
      </header>

      <section className="tool-panel">
        <form className="url-form" onSubmit={onSubmit}>
          <label htmlFor="url">Target URL</label>
          <div className="url-row">
            <input
              id="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="api.example.com/health"
              spellCheck={false}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
              <span>{isLoading ? "Testing" : "Run test"}</span>
            </button>
          </div>
        </form>

        {error ? <div className="error-banner">{error}</div> : null}

        {!run ? (
          <div className="empty-state">
            <Activity size={24} />
            <div>
              <h2>No probe results yet</h2>
              <p>Configure real probe endpoints, then run a one-time check to see markers, latency numbers, and a shareable result URL.</p>
            </div>
          </div>
        ) : (
          <ResultsView initialRun={run} initialHistory={history} />
        )}
      </section>

      {run ? (
        <button
          className="copy-fab"
          type="button"
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          title="Copy share link"
        >
          <Copy size={18} />
          <span>Copy link</span>
        </button>
      ) : null}
    </main>
  );
}
