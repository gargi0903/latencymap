"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { CmdLabel } from "@/components/cmd-label";
import { PROBE_COUNTRY_LIST } from "@/lib/probe-regions";

const BOOT_LINE_MS = 50;
const BOOT_SKIP_KEY = "latencymap.boot-seen";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type BootStep = {
  id: string;
  className?: string;
  render: () => ReactNode;
};

const BOOT_STEPS: BootStep[] = [
  {
    id: "brand",
    className: "terminal__boot-line--brand",
    render: () => <CmdLabel />,
  },
  {
    id: "starting",
    className: "terminal__boot-line--starting",
    render: () => "starting...",
  },
  {
    id: "what",
    className: "terminal__boot-line--muted",
    render: () => "regional https latency probe",
  },
  {
    id: "where",
    className: "terminal__boot-line--countries",
    render: () => PROBE_COUNTRY_LIST,
  },
  {
    id: "how",
    className: "terminal__boot-line--muted",
    render: () => "measures how long each country takes to reach your url",
  },
  {
    id: "ask",
    className: "terminal__boot-line--handoff",
    render: () => "enter a public https url",
  },
];

const STARTING_STEP_INDEX = BOOT_STEPS.findIndex((step) => step.id === "starting");

function hasSeenBoot() {
  try {
    return sessionStorage.getItem(BOOT_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function markBootSeen() {
  try {
    sessionStorage.setItem(BOOT_SKIP_KEY, "1");
  } catch {}
}

function subscribeBootSkipPreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getBootSkipPreferenceSnapshot() {
  return hasSeenBoot() || prefersReducedMotion();
}

function getServerBootSkipPreferenceSnapshot() {
  return false;
}

export function useTerminalBoot() {
  const autoSkipBoot = useSyncExternalStore(
    subscribeBootSkipPreference,
    getBootSkipPreferenceSnapshot,
    getServerBootSkipPreferenceSnapshot,
  );
  const [bootDismissed, setBootDismissed] = useState(false);
  const [animatedBootLines, setAnimatedBootLines] = useState(0);

  const showBoot = !autoSkipBoot && !bootDismissed;
  const visibleBootLines = autoSkipBoot ? BOOT_STEPS.length : animatedBootLines;
  const bootReady = !showBoot;

  function skipBoot() {
    markBootSeen();
    setBootDismissed(true);
    setAnimatedBootLines(BOOT_STEPS.length);
  }

  useEffect(() => {
    if (autoSkipBoot || !showBoot) {
      markBootSeen();
      return;
    }

    if (animatedBootLines >= BOOT_STEPS.length) {
      setBootDismissed(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setAnimatedBootLines((count) => count + 1);
    }, BOOT_LINE_MS);

    return () => window.clearTimeout(timer);
  }, [autoSkipBoot, showBoot, animatedBootLines]);

  return {
    autoSkipBoot,
    showBoot,
    visibleBootLines,
    bootReady,
    skipBoot,
  };
}

export function renderBootLines(visibleBootLines: number): ReactNode[] {
  const bootLines: ReactNode[] = [];
  for (const step of BOOT_STEPS.slice(0, visibleBootLines)) {
    if (step.id === "starting" && visibleBootLines > STARTING_STEP_INDEX + 1) {
      continue;
    }
    bootLines.push(
      <p key={step.id} className={["terminal__boot-line", step.className].filter(Boolean).join(" ")}>
        {step.render()}
      </p>,
    );
  }
  return bootLines;
}
