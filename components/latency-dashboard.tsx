"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CmdLabel } from "@/components/cmd-label";
import { ProbeResultsPanel } from "@/components/probe-results-panel";
import { PROBE_COUNTRY_LIST } from "@/lib/probe-regions";
import { sharePathForRun } from "@/lib/share-payload";
import { useCopyShareLink } from "@/lib/use-copy-share-link";
import { useLatencyTest } from "@/lib/use-latency-test";

const INTERACTIVE_SELECTOR = "button, a, textarea, select, [role='button']";
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

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function Wordmark() {
  return (
    <p className="terminal__boot-line terminal__boot-line--brand terminal__masthead">
      <CmdLabel />
    </p>
  );
}

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
  } catch {
    // Ignore storage failures in private browsing.
  }
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

export function LatencyDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runTestRef = useRef<(targetUrl?: string) => Promise<void>>(async () => {});
  const isLoadingRef = useRef(false);
  const bootReadyRef = useRef(false);
  const { url, setUrl, run, sharePath, error, isLoading, onSubmit, runTest } = useLatencyTest();
  const activeSharePath = sharePath ?? (run ? sharePathForRun(run) : null);
  const { copyState, copyShareLink } = useCopyShareLink(activeSharePath);
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
  const hasResults = Boolean(run && !isLoading);

  useEffect(() => {
    runTestRef.current = runTest;
    isLoadingRef.current = isLoading;
    bootReadyRef.current = bootReady;
  });

  function skipBoot() {
    markBootSeen();
    setBootDismissed(true);
    setAnimatedBootLines(BOOT_STEPS.length);
  }

  useEffect(() => {
    if (autoSkipBoot) {
      markBootSeen();
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!showBoot) {
      markBootSeen();
      inputRef.current?.focus({ preventScroll: true });
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

  useEffect(() => {
    function focusInput() {
      if (!bootReadyRef.current) {
        skipBoot();
        return;
      }

      inputRef.current?.focus({ preventScroll: true });
    }

    function onPointerDown(event: PointerEvent) {
      if (!bootReadyRef.current) {
        event.preventDefault();
        skipBoot();
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      focusInput();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!bootReadyRef.current) {
        event.preventDefault();
        skipBoot();
        return;
      }

      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const input = inputRef.current;
      if (!input) {
        return;
      }

      if (isInteractiveTarget(event.target) && event.target !== input) {
        return;
      }

      if (document.activeElement === input) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        focusInput();
        if (!isLoadingRef.current) {
          void runTestRef.current();
        }
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        focusInput();
        setUrl((current) => current.slice(0, -1));
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        focusInput();
        setUrl((current) => current + event.key);
      }
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [setUrl]);

  const bootLines: ReactNode[] = [];
  if (showBoot) {
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
  }

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
                <span className="terminal__prompt" aria-hidden="true">
                  $
                </span>
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
