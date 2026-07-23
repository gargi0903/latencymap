"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatLatency, formatProbeStatus } from "@/lib/latency-display";
import { PROBE_COUNTRIES, PROBE_COUNTRY_LIST, probeCountryName } from "@/lib/probe-regions";
import type { ProbeResult } from "@/lib/types";
import { useLatencyTest } from "@/lib/use-latency-test";

const INTERACTIVE_SELECTOR = "button, a, textarea, select, canvas, [role='button']";
const BOOT_LINE_MS = 50;
const BOOT_SKIP_KEY = "latencymap.boot-seen";

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
    render: () => PROBE_COUNTRIES.join(" · "),
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

function CmdLabel() {
  return (
    <>
      <span className="terminal__cmd-latency">latency</span>{" "}
      <span className="terminal__cmd-map">map</span>
    </>
  );
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

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function markBootSeen() {
  try {
    sessionStorage.setItem(BOOT_SKIP_KEY, "1");
  } catch {
    // Ignore storage failures in private browsing.
  }
}

function sortResultsByLatencyDesc(results: ProbeResult[]) {
  return [...results].sort((a, b) => {
    if (a.totalMs === null && b.totalMs === null) return 0;
    if (a.totalMs === null) return 1;
    if (b.totalMs === null) return -1;
    return b.totalMs - a.totalMs;
  });
}

export function LatencyDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runTestRef = useRef<(targetUrl?: string) => Promise<void>>(async () => {});
  const isLoadingRef = useRef(false);
  const bootReadyRef = useRef(false);
  const { url, setUrl, run, sharePath, error, isLoading, onSubmit, runTest } = useLatencyTest();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [showBoot, setShowBoot] = useState(true);
  const [visibleBootLines, setVisibleBootLines] = useState(0);
  const [bootResolved, setBootResolved] = useState(false);

  const bootReady = !showBoot;
  const hasResults = Boolean(run && !isLoading);
  const activeSharePath = sharePath ?? (run ? `/r/${run.id}` : null);
  const sortedResults = useMemo(
    () => (run ? sortResultsByLatencyDesc(run.results) : []),
    [run],
  );
  const currentRegion = selectedRegion ?? sortedResults[0]?.region ?? null;

  runTestRef.current = runTest;
  isLoadingRef.current = isLoading;
  bootReadyRef.current = bootReady;

  function skipBoot() {
    markBootSeen();
    setShowBoot(false);
    setVisibleBootLines(BOOT_STEPS.length);
  }

  useEffect(() => {
    if (hasSeenBoot() || prefersReducedMotion()) {
      markBootSeen();
      setShowBoot(false);
      setVisibleBootLines(BOOT_STEPS.length);
    }

    setBootResolved(true);
  }, []);

  useEffect(() => {
    if (!bootResolved) {
      return;
    }

    if (!showBoot) {
      markBootSeen();
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    if (visibleBootLines >= BOOT_STEPS.length) {
      setShowBoot(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleBootLines((count) => count + 1);
    }, BOOT_LINE_MS);

    return () => window.clearTimeout(timer);
  }, [bootResolved, showBoot, visibleBootLines]);

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

  async function copyShareLink() {
    if (!activeSharePath) return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${activeSharePath}`);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
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
              {BOOT_STEPS.slice(0, visibleBootLines)
                .filter(
                  (step) =>
                    step.id !== "starting" || visibleBootLines <= STARTING_STEP_INDEX + 1,
                )
                .map((step) => (
                  <p key={step.id} className={["terminal__boot-line", step.className].filter(Boolean).join(" ")}>
                    {step.render()}
                  </p>
                ))}
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
              <p className="terminal__log terminal__log--complete" role="status">
                <span className="terminal__arrow">✓</span>
                probe complete · {run.results.length} regions
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
                {activeSharePath ? (
                  <button
                    type="button"
                    className="terminal__link"
                    title="Copy permanent share link"
                    onClick={copyShareLink}
                  >
                    {copyState === "copied" ? "copied" : "share"}
                  </button>
                ) : null}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
