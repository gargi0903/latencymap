"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  formatLatency,
  formatProbeMetadataValue,
  formatProbeStatus,
  formatProbeTimestamp,
  isProbeFailed,
  latencyHexColor,
  latencyMeasurementNote,
  defaultSelectedRegion,
  sortResultsByRegionOrder,
} from "@/lib/results";
import { PROBE_COUNTRY_LIST, probeCountryName } from "@/lib/regions";
import { sharePathForRun } from "@/lib/share";
import type { ProbeResult, TestRun } from "@/lib/types";

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

function CmdLabel() {
  return (
    <>
      <span className="terminal__cmd-latency">latency</span>{" "}
      <span className="terminal__cmd-map">map</span>
    </>
  );
}

function useCopyShareLink(sharePath: string | null) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const copyShareLink = useCallback(async () => {
    if (!sharePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  }, [sharePath]);

  return { copyState, copyShareLink };
}

type CreateTestResponse = {
  run: TestRun;
  sharePath: string;
  error?: string;
};

export async function fetchLatencyTest(trimmed: string): Promise<
  | { ok: true; run: TestRun; sharePath: string }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch("/api/tests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as CreateTestResponse | null;
      return { ok: false, error: body?.error ?? "Unable to run latency test." };
    }

    const body = (await response.json()) as CreateTestResponse;
    return { ok: true, run: body.run, sharePath: body.sharePath };
  } catch {
    return { ok: false, error: "Unable to reach the Latencymap API." };
  }
}

function useLatencyTest() {
  const [url, setUrl] = useState("");
  const [run, setRun] = useState<TestRun | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runTest(targetUrl?: string) {
    const trimmed = (targetUrl ?? url).trim();
    if (!trimmed) return;

    setUrl(trimmed);
    setError(null);
    setRun(null);
    setSharePath(null);
    setIsLoading(true);

    try {
      const result = await fetchLatencyTest(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setRun(result.run);
      setSharePath(result.sharePath);
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runTest();
  }

  return {
    url,
    setUrl,
    run,
    sharePath,
    error,
    isLoading,
    runTest,
    onSubmit,
  };
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

type ProbeResultsPanelProps = {
  results: ProbeResult[];
  footer?: ReactNode;
};

function rowClassName(selected: boolean, failed: boolean) {
  return ["terminal__table-row", selected ? "terminal__table-row--selected" : null, failed ? "terminal__table-row--failed" : null]
    .filter(Boolean)
    .join(" ");
}

function ProbeInspector({ result }: { result: ProbeResult }) {
  const failed = isProbeFailed(result);
  const latencyColor = latencyHexColor(result.totalMs, result.error);

  return (
    <dl className="terminal__inspector" aria-label={`Probe details for ${probeCountryName(result.region)}`}>
      <div className="terminal__inspector-row">
        <dt>latency</dt>
        <dd style={{ color: failed ? undefined : latencyColor }}>
          {failed ? formatProbeStatus(result) : formatLatency(result)}
        </dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>status</dt>
        <dd>{formatProbeMetadataValue(result.statusCode)}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>region</dt>
        <dd>{result.label}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>colo</dt>
        <dd>{formatProbeMetadataValue(result.cloudflareColo)}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>placement</dt>
        <dd>{formatProbeMetadataValue(result.placementRegion)}</dd>
      </div>
      <div className="terminal__inspector-row">
        <dt>tested at</dt>
        <dd>{formatProbeTimestamp(result.testedAt)}</dd>
      </div>
    </dl>
  );
}

function ResultLatency({ result }: { result: ProbeResult }) {
  const failed = isProbeFailed(result);
  return (
    <span
      className={["terminal__ms", failed ? "terminal__ms--failed" : null].filter(Boolean).join(" ")}
      style={failed ? undefined : { color: latencyHexColor(result.totalMs, result.error) }}
    >
      {failed ? formatProbeStatus(result) : formatLatency(result)}
    </span>
  );
}

function ResultRow({
  result,
  selected,
  index,
  onSelect,
}: {
  result: ProbeResult;
  selected: boolean;
  index: number;
  onSelect: (region: string) => void;
}) {
  return (
    <li className="terminal__table-item">
      <button
        type="button"
        className={rowClassName(selected, isProbeFailed(result))}
        style={{ animationDelay: `${index * 45}ms` }}
        onClick={() => onSelect(result.region)}
      >
        <span className="terminal__region">{probeCountryName(result.region)}</span>
        <ResultLatency result={result} />
      </button>
    </li>
  );
}

function ResultsBody({
  orderedResults,
  currentRegion,
  selectedResult,
  onSelect,
}: {
  orderedResults: ProbeResult[];
  currentRegion: string | null;
  selectedResult: ProbeResult | null;
  onSelect: (region: string) => void;
}) {
  return (
    <div className="terminal__results-body">
      <h2 className="terminal__section-title">results</h2>
      <ul className="terminal__table" aria-label="Latency by country">
        {orderedResults.map((result, index) => (
          <ResultRow
            key={result.region}
            result={result}
            selected={currentRegion === result.region}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {selectedResult ? <ProbeInspector result={selectedResult} /> : null}
      <p className="terminal__log terminal__log--muted terminal__results-note">{latencyMeasurementNote()}</p>
    </div>
  );
}

function ProbeResultsPanel({ results, footer }: ProbeResultsPanelProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const orderedResults = useMemo(() => sortResultsByRegionOrder(results), [results]);
  const currentRegion = selectedRegion ?? defaultSelectedRegion(results);
  const selectedResult = orderedResults.find((result) => result.region === currentRegion) ?? null;

  return (
    <>
      <p className="terminal__log terminal__log--complete" role="status">
        <span className="terminal__arrow">✓</span>
        probe complete · {results.length} regions
      </p>
      <ResultsBody
        orderedResults={orderedResults}
        currentRegion={currentRegion}
        selectedResult={selectedResult}
        onSelect={setSelectedRegion}
      />
      {footer ? <p className="terminal__log terminal__log--footer">{footer}</p> : null}
    </>
  );
}

type ResultsViewProps = {
  initialRun: TestRun;
};

export function ResultsView({ initialRun }: ResultsViewProps) {
  const sharePath = sharePathForRun(initialRun);
  const { copyState, copyShareLink } = useCopyShareLink(sharePath);

  return (
    <section
      className="terminal__session terminal__session--results"
      aria-label="Shared latency results"
    >
      <div className="terminal__console">
        <p className="terminal__boot-line terminal__boot-line--brand terminal__masthead">
          <CmdLabel />
        </p>
        <p className="terminal__line terminal__line--prompt">
          <span className="terminal__prefix">
            <span className="terminal__prompt" aria-hidden="true">
              $
            </span>
          </span>
          <span className="terminal__input terminal__input--static" title={initialRun.normalizedUrl}>
            {initialRun.normalizedUrl}
          </span>
        </p>
      </div>

      <div className="terminal__workspace">
        <ProbeResultsPanel
          results={initialRun.results}
          footer={
            <>
              <Link href="/" className="terminal__link">
                new test
              </Link>
              <span aria-hidden="true"> · </span>
              <button
                type="button"
                className="terminal__link"
                title="Copy permanent share link"
                onClick={copyShareLink}
              >
                {copyState === "copied" ? "copied" : "share"}
              </button>
            </>
          }
        />
      </div>
    </section>
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
