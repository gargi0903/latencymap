"use client";

import { useEffect, useRef } from "react";
import { CmdLabel } from "@/components/cmd-label";
import { ProbeResultsPanel } from "@/components/probe-results-panel";
import { renderBootLines, useTerminalBoot } from "@/components/use-terminal-boot";
import { useTerminalInputCapture } from "@/components/use-terminal-input-capture";
import { PROBE_COUNTRY_LIST } from "@/lib/probe-regions";
import { sharePathForRun } from "@/lib/share-payload";
import { useCopyShareLink } from "@/lib/use-copy-share-link";
import { useLatencyTest } from "@/lib/use-latency-test";

function Wordmark() {
  return (
    <p className="terminal__boot-line terminal__boot-line--brand terminal__masthead">
      <CmdLabel />
    </p>
  );
}

export function LatencyDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runTestRef = useRef<(targetUrl?: string) => Promise<void>>(async () => {});
  const isLoadingRef = useRef(false);
  const bootReadyRef = useRef(false);
  const { url, setUrl, run, sharePath, error, isLoading, onSubmit, runTest } = useLatencyTest();
  const activeSharePath = sharePath ?? (run ? sharePathForRun(run) : null);
  const { copyState, copyShareLink } = useCopyShareLink(activeSharePath);
  const { showBoot, visibleBootLines, bootReady, skipBoot } = useTerminalBoot();
  const hasResults = Boolean(run && !isLoading);

  useEffect(() => {
    runTestRef.current = runTest;
    isLoadingRef.current = isLoading;
    bootReadyRef.current = bootReady;
  });

  useTerminalInputCapture({
    inputRef,
    bootReadyRef,
    isLoadingRef,
    runTestRef,
    skipBoot,
    setUrl,
    focusWhenReady: bootReady,
  });

  const bootLines = showBoot ? renderBootLines(visibleBootLines) : null;

  return (
    <main className="terminal">
      <section
        className={["terminal__session", hasResults ? "terminal__session--results" : null]
          .filter(Boolean)
          .join(" ")}
        aria-label="Latency probe terminal"
      >
        <div className="terminal__console">
          {bootReady && !hasResults ? <Wordmark /> : null}

          {showBoot ? (
            <div className="terminal__boot" aria-live="polite">
              {bootLines}
            </div>
          ) : null}

          {bootReady ? (
            <form className="terminal__line terminal__line--prompt" onSubmit={onSubmit}>
              <label htmlFor="url" className="terminal__prefix">
                <span className="terminal__prompt">$</span>
              </label>
              <input
                ref={inputRef}
                id="url"
                name="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://api.example.com"
                spellCheck={false}
                autoComplete="off"
                className="terminal__input"
              />
            </form>
          ) : null}

          {isLoading ? (
            <p className="terminal__status terminal__log--muted" role="status">
              <span className="terminal__arrow">→</span>
              dispatching to {PROBE_COUNTRY_LIST}…
            </p>
          ) : null}

          {error ? (
            <p className="terminal__status terminal__log--error" role="alert">
              <span className="terminal__arrow">✕</span>
              {error}
            </p>
          ) : null}
        </div>

        {hasResults && run ? (
          <div className="terminal__workspace">
            <div className="terminal__feed">
              <ProbeResultsPanel
                key={run.id}
                results={run.results}
                footer={
                  activeSharePath ? (
                    <button
                      type="button"
                      className="terminal__link"
                      title="Copy permanent share link"
                      onClick={copyShareLink}
                    >
                      {copyState === "copied" ? "copied" : "share"}
                    </button>
                  ) : null
                }
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
