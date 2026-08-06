"use client";

import type { FormEvent, ReactNode, RefObject } from "react";
import { CmdLabel } from "@/components/cmd-label";
import type { TerminalConsoleProps } from "@/components/terminal-console-props";
import { PROBE_COUNTRY_LIST } from "@/lib/probe-regions";

function Wordmark() {
  return (
    <p className="terminal__boot-line terminal__boot-line--brand terminal__masthead">
      <CmdLabel />
    </p>
  );
}

function BootPanel({ bootLines }: { bootLines: ReactNode[] | null }) {
  return (
    <div className="terminal__boot" aria-live="polite">
      {bootLines}
    </div>
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
  return (
    <>
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
    </>
  );
}

export function TerminalConsole({
  inputRef,
  url,
  setUrl,
  onSubmit,
  showBoot,
  bootReady,
  bootLines,
  isLoading,
  error,
  hasResults,
}: TerminalConsoleProps) {
  return (
    <div className="terminal__console">
      {bootReady && !hasResults ? <Wordmark /> : null}
      {showBoot ? <BootPanel bootLines={bootLines} /> : null}
      {bootReady ? (
        <PromptForm inputRef={inputRef} url={url} setUrl={setUrl} onSubmit={onSubmit} />
      ) : null}
      <ConsoleStatuses isLoading={isLoading} error={error} />
    </div>
  );
}
