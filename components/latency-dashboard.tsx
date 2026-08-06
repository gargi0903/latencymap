"use client";

import { useEffect, useRef } from "react";
import { TerminalDashboardView } from "@/components/terminal-dashboard-view";
import { renderBootLines, useTerminalBoot } from "@/components/use-terminal-boot";
import { useTerminalInputCapture } from "@/components/use-terminal-input-capture";
import { sharePathForRun } from "@/lib/share-payload";
import { useCopyShareLink } from "@/lib/use-copy-share-link";
import { useLatencyTest } from "@/lib/use-latency-test";
import type { TestRun } from "@/lib/types";

function resolveSharePath(sharePath: string | null, run: TestRun | null) {
  if (sharePath) {
    return sharePath;
  }

  return run ? sharePathForRun(run) : null;
}

export function LatencyDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runTestRef = useRef<(targetUrl?: string) => Promise<void>>(async () => {});
  const isLoadingRef = useRef(false);
  const bootReadyRef = useRef(false);
  const { url, setUrl, run, sharePath, error, isLoading, onSubmit, runTest } = useLatencyTest();
  const activeSharePath = resolveSharePath(sharePath, run);
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
    <TerminalDashboardView
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
      run={run}
      activeSharePath={activeSharePath}
      copyState={copyState}
      copyShareLink={copyShareLink}
    />
  );
}
