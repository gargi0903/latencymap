"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GlobePanel } from "@/components/globe-panel";
import { latencyHexColor } from "@/lib/latency-display";
import { PROBE_COUNTRIES, PROBE_COUNTRY_LIST, probeCountryName } from "@/lib/probe-regions";
import { useLatencyTest } from "@/lib/use-latency-test";

const INTERACTIVE_SELECTOR = "button, a, textarea, select, canvas, [role='button']";
const BOOT_LINE_MS = 90;

type BootStep = {
  id: string;
  className?: string;
  render: () => ReactNode;
};

const BOOT_STEPS: BootStep[] = [
  {
    id: "start",
    className: "terminal__boot-line--brand",
    render: () => (
      <>
        <CmdLabel />
        <span className="terminal__boot-starting"> starting...</span>
      </>
    ),
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

export function LatencyDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runTestRef = useRef<(targetUrl?: string) => Promise<void>>(async () => {});
  const isLoadingRef = useRef(false);
  const bootReadyRef = useRef(false);
  const { url, setUrl, run, error, isLoading, onSubmit, runTest } = useLatencyTest();
  const [view, setView] = useState<"globe" | "table">("globe");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [visibleBootLines, setVisibleBootLines] = useState(0);

  const bootReady = visibleBootLines >= BOOT_STEPS.length;
  const hasResults = Boolean(run && !isLoading);

  runTestRef.current = runTest;
  isLoadingRef.current = isLoading;
  bootReadyRef.current = bootReady;

  const currentRegion = selectedRegion ?? run?.results[0]?.region ?? null;

  function skipBoot() {
    setVisibleBootLines(BOOT_STEPS.length);
  }

  useEffect(() => {
    if (bootReady) {
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleBootLines((count) => count + 1);
    }, BOOT_LINE_MS);

    return () => window.clearTimeout(timer);
  }, [bootReady, visibleBootLines]);

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
    if (!run) return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${run.id}`);
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
          <div className="terminal__boot" aria-live="polite">
            {BOOT_STEPS.slice(0, visibleBootLines).map((step) => (
              <p key={step.id} className={["terminal__boot-line", step.className].filter(Boolean).join(" ")}>
                {step.render()}
              </p>
            ))}
          </div>

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
          <div className={["terminal__workspace", view === "globe" ? "terminal__workspace--globe" : "terminal__workspace--table"].join(" ")}>
            <div className="terminal__feed">
              <p className="terminal__log terminal__log--summary">
                <span className="terminal__arrow">→</span>
                <span className="terminal__summary-meta">{run.results.length} regions · </span>
                <span className="terminal__summary-url">{run.normalizedUrl}</span>
              </p>

              <div className="terminal__view" role="group" aria-label="Result view">
                <button
                  type="button"
                  className="terminal__view-btn"
                  aria-pressed={view === "globe"}
                  onClick={() => setView("globe")}
                >
                  globe
                </button>
                <button
                  type="button"
                  className="terminal__view-btn"
                  aria-pressed={view === "table"}
                  onClick={() => setView("table")}
                >
                  table
                </button>
              </div>

              {view === "table" ? (
                <div className="terminal__table" role="table" aria-label="Latency by country">
                  <div className="terminal__table-head" role="row">
                    <span role="columnheader">country</span>
                    <span role="columnheader">latency</span>
                  </div>
                  {run.results.map((result) => (
                    <div key={result.region} className="terminal__table-row" role="row">
                      <span className="terminal__region" role="cell">
                        {probeCountryName(result.region)}
                      </span>
                      <span
                        className="terminal__ms"
                        role="cell"
                        style={{ color: latencyHexColor(result.totalMs, result.error) }}
                      >
                        {result.error ?? `${result.totalMs} ms`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="terminal__log terminal__log--footer">
                <span className="terminal__arrow">→</span>
                {copyState === "copied" ? (
                  "link copied"
                ) : (
                  <>
                    share{" "}
                    <button type="button" className="terminal__link" onClick={copyShareLink}>
                      /r/{run.id}
                    </button>
                  </>
                )}
              </p>
            </div>

            {view === "globe" ? (
              <div className="terminal__stage">
                <GlobePanel
                  key={run.id}
                  variant="minimal"
                  results={run.results}
                  selectedRegion={currentRegion}
                  onSelectRegion={setSelectedRegion}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
