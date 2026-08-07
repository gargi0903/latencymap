"use client";

import { ProbeResultsPanel } from "@/components/probe-results-panel";
import { TerminalConsole, type TerminalConsoleProps } from "@/components/terminal-console";
import type { TestRun } from "@/lib/types";

type TerminalDashboardViewProps = TerminalConsoleProps & {
  run: TestRun | null;
  activeSharePath: string | null;
  copyState: string;
  copyShareLink: () => void;
};

export function TerminalDashboardView(props: TerminalDashboardViewProps) {
  const { hasResults, run, activeSharePath, copyState, copyShareLink } = props;

  return (
    <main className="terminal">
      <section
        className={["terminal__session", hasResults ? "terminal__session--results" : null]
          .filter(Boolean)
          .join(" ")}
        aria-label="Latency probe terminal"
      >
        <TerminalConsole {...props} />
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
