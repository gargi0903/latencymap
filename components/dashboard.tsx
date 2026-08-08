"use client";

import { useEffect, useRef, type FormEvent, type RefObject } from "react";
import { PROBE_COUNTRY_LIST } from "@/lib/regions";
import { CmdLabel, ResultsPanel, useCopyShareLink } from "@/components/results-panel";
import { useLatencyTest } from "@/components/use-latency-test";

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, textarea, select, [role='button']"));
}

function PromptForm({
  inputRef,
  url,
  setUrl,
  onSubmit,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  url: string;
  setUrl: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
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
  );
}

function ConsoleStatuses({ isLoading, error }: { isLoading: boolean; error: string | null }) {
  if (isLoading) {
    return (
      <p className="terminal__status terminal__log--muted" role="status">
        <span className="terminal__arrow">→</span>
        dispatching to {PROBE_COUNTRY_LIST}…
      </p>
    );
  }

  if (!error) {
    return null;
  }

  return (
    <p className="terminal__status terminal__log--error" role="alert">
      <span className="terminal__arrow">✕</span>
      {error}
    </p>
  );
}

export function LatencyDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runTestRef = useRef<(targetUrl?: string) => Promise<void>>(async () => {});
  const isLoadingRef = useRef(false);
  const { url, setUrl, run, sharePath, error, isLoading, onSubmit, runTest } = useLatencyTest();
  const { copyState, copyShareLink } = useCopyShareLink(sharePath);
  const hasResults = Boolean(run && !isLoading);

  useEffect(() => {
    runTestRef.current = runTest;
    isLoadingRef.current = isLoading;
  });

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });

    function focusInput() {
      inputRef.current?.focus({ preventScroll: true });
    }

    function onPointerDown(event: PointerEvent) {
      if (isInteractiveTarget(event.target)) {
        return;
      }
      focusInput();
    }

    function onKeyDown(event: KeyboardEvent) {
      const input = inputRef.current;
      if (!input) {
        return;
      }

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (isInteractiveTarget(event.target) && event.target !== input) ||
        document.activeElement === input
      ) {
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

  return (
    <main className="terminal">
      <section
        className={["terminal__session", hasResults ? "terminal__session--results" : null]
          .filter(Boolean)
          .join(" ")}
        aria-label="Latency probe terminal"
      >
        <div className="terminal__console">
          {!hasResults ? (
            <p className="terminal__boot-line terminal__boot-line--brand terminal__masthead">
              <CmdLabel />
            </p>
          ) : null}
          <PromptForm inputRef={inputRef} url={url} setUrl={setUrl} onSubmit={onSubmit} />
          <ConsoleStatuses isLoading={isLoading} error={error} />
        </div>
        {hasResults && run ? (
          <div className="terminal__workspace">
            <ResultsPanel
              key={run.id}
              results={run.results}
              footer={
                sharePath ? (
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
