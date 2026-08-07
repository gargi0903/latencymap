"use client";

import { useEffect, useRef } from "react";
import { ProbeResultsPanel } from "@/components/probe-results-panel";
import { TerminalConsole } from "@/components/terminal-console";
import { renderBootLines, useTerminalBoot } from "@/components/use-terminal-boot";
import { useTerminalInputCapture } from "@/components/use-terminal-input-capture";
import { sharePathForRun } from "@/lib/share-payload";
import { useCopyShareLink } from "@/lib/use-copy-share-link";
import { useLatencyTest } from "@/lib/use-latency-test";

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
  const bootLines = showBoot ? renderBootLines(visibleBootLines) : null;

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

  return (
    <main className="terminal">
      <section
        className={["terminal__session", hasResults ? "terminal__session--results" : null]
          .filter(Boolean)
          .join(" ")}
        aria-label="Latency probe terminal"
      >
        <TerminalConsole
          inputRef={inputRef}
          url={url}
          setUrl={setUrl}
          onSubmit={onSubmit}
          showBoot={showBoot}
          bootReady={bootReady}
          bootLines={bootLines}
          isLoading={isLoading}
          error={error}
          hasResults={hasResults}
        />
        {hasResults && run ? (
          <div className="terminal__workspace">
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
        ) : null}
      </section>
    </main>
  );
}
