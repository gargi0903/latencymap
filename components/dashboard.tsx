"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type FormEvent,
  type ReactNode,
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

function useTerminalBoot() {
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

function renderBootLines(visibleBootLines: number): ReactNode[] {
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

type TerminalInputCaptureOptions = {
  inputRef: RefObject<HTMLInputElement | null>;
  bootReadyRef: RefObject<boolean>;
  isLoadingRef: RefObject<boolean>;
  runTestRef: RefObject<(targetUrl?: string) => Promise<void>>;
  skipBoot: () => void;
  setUrl: Dispatch<SetStateAction<string>>;
  focusWhenReady: boolean;
};

function focusTerminalInput(input: HTMLInputElement | null) {
  input?.focus({ preventScroll: true });
}

function bindTerminalListeners(options: Omit<TerminalInputCaptureOptions, "focusWhenReady">) {
  const { inputRef, bootReadyRef, isLoadingRef, runTestRef, skipBoot, setUrl } = options;

  function focusInput() {
    if (!bootReadyRef.current) {
      skipBoot();
      return;
    }

    focusTerminalInput(inputRef.current);
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
  bootReadyRef,
  isLoadingRef,
  runTestRef,
  skipBoot,
  setUrl,
  focusWhenReady,
}: TerminalInputCaptureOptions) {
  useEffect(() => {
    if (focusWhenReady) {
      focusTerminalInput(inputRef.current);
    }
  }, [focusWhenReady, inputRef]);

  useEffect(
    () =>
      bindTerminalListeners({
        inputRef,
        bootReadyRef,
        isLoadingRef,
        runTestRef,
        skipBoot,
        setUrl,
      }),
    [bootReadyRef, inputRef, isLoadingRef, runTestRef, setUrl, skipBoot],
  );
}

type TerminalConsoleProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  url: string;
  setUrl: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showBoot: boolean;
  bootReady: boolean;
  bootLines: ReactNode[] | null;
  isLoading: boolean;
  error: string | null;
  hasResults: boolean;
};

function PromptForm({
  inputRef,
  url,
  setUrl,
  onSubmit,
}: Pick<TerminalConsoleProps, "inputRef" | "url" | "setUrl" | "onSubmit">) {
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

function ConsoleStatuses({ isLoading, error }: Pick<TerminalConsoleProps, "isLoading" | "error">) {
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

function TerminalConsole(props: TerminalConsoleProps) {
  const { showBoot, bootReady, bootLines, hasResults, isLoading, error } = props;

  return (
    <div className="terminal__console">
      {bootReady && !hasResults ? (
        <p className="terminal__boot-line terminal__boot-line--brand terminal__masthead">
          <CmdLabel />
        </p>
      ) : null}
      {showBoot ? (
        <div className="terminal__boot" aria-live="polite">
          {bootLines}
        </div>
      ) : null}
      {bootReady ? <PromptForm {...props} /> : null}
      <ConsoleStatuses isLoading={isLoading} error={error} />
    </div>
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
