"use client";

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

      {showBoot ? (
        <div className="terminal__boot" aria-live="polite">
          {bootLines}
        </div>
      ) : null}

      {bootReady ? (
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
  );
}
