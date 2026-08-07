"use client";

import type { FormEvent, ReactNode, RefObject } from "react";
import { CmdLabel } from "@/components/cmd-label";
import { PROBE_COUNTRY_LIST } from "@/lib/probe-regions";

export type TerminalConsoleProps = {
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

function Masthead({ visible }: { visible: boolean }) {
  return visible ? <Wordmark /> : null;
}

export function TerminalConsole(props: TerminalConsoleProps) {
  const { showBoot, bootReady, bootLines, hasResults, isLoading, error } = props;

  return (
    <div className="terminal__console">
      <Masthead visible={bootReady && !hasResults} />
      {showBoot ? <BootPanel bootLines={bootLines} /> : null}
      {bootReady ? <PromptForm {...props} /> : null}
      <ConsoleStatuses isLoading={isLoading} error={error} />
    </div>
  );
}
