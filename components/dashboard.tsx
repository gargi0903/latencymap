"use client";

import {
  useEffect,
  useRef,
  type Dispatch,
  type FormEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { PROBE_COUNTRY_LIST } from "@/lib/regions";
import { sharePathForRun } from "@/lib/share";
import { CmdLabel, ResultsPanel, useCopyShareLink } from "@/components/results-panel";
import { useLatencyTest } from "@/components/use-latency-test";

type TerminalKeyHandlerOptions = {
  input: HTMLInputElement;
  isLoading: boolean;
  runTest: (targetUrl?: string) => Promise<void>;
  setUrl: Dispatch<SetStateAction<string>>;
  focusInput: () => void;
};

function shouldIgnoreKeyEvent(event: KeyboardEvent, input: HTMLInputElement) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return true;
  }

  if (isInteractiveTarget(event.target) && event.target !== input) {
    return true;
  }

  return document.activeElement === input;
}

export function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, textarea, select, [role='button']"));
}

export function handleTerminalKeyDown(event: KeyboardEvent, options: TerminalKeyHandlerOptions) {
  if (shouldIgnoreKeyEvent(event, options.input)) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    options.focusInput();
    if (!options.isLoading) {
      void options.runTest();
    }
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    options.focusInput();
    options.setUrl((current) => current.slice(0, -1));
    return;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    options.focusInput();
    options.setUrl((current) => current + event.key);
  }
}

type TerminalInputCaptureOptions = {
  inputRef: RefObject<HTMLInputElement | null>;
  isLoadingRef: RefObject<boolean>;
  runTestRef: RefObject<(targetUrl?: string) => Promise<void>>;
  setUrl: Dispatch<SetStateAction<string>>;
};

function focusTerminalInput(input: HTMLInputElement | null) {
  input?.focus({ preventScroll: true });
}

function bindTerminalListeners(options: TerminalInputCaptureOptions) {
  const { inputRef, isLoadingRef, runTestRef, setUrl } = options;

  function focusInput() {
    focusTerminalInput(inputRef.current);
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

    handleTerminalKeyDown(event, {
      input,
      isLoading: Boolean(isLoadingRef.current),
      runTest: runTestRef.current,
      setUrl,
      focusInput,
    });
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}

function useTerminalInputCapture({
  inputRef,
  isLoadingRef,
  runTestRef,
  setUrl,
}: TerminalInputCaptureOptions) {
  useEffect(() => {
    focusTerminalInput(inputRef.current);
  }, [inputRef]);

  useEffect(
    () => bindTerminalListeners({ inputRef, isLoadingRef, runTestRef, setUrl }),
    [inputRef, isLoadingRef, runTestRef, setUrl],
  );
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
  const activeSharePath = sharePath ?? (run ? sharePathForRun(run) : null);
  const { copyState, copyShareLink } = useCopyShareLink(activeSharePath);
  const hasResults = Boolean(run && !isLoading);

  useEffect(() => {
    runTestRef.current = runTest;
    isLoadingRef.current = isLoading;
  });

  useTerminalInputCapture({
    inputRef,
    isLoadingRef,
    runTestRef,
    setUrl,
  });

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
