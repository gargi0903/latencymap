"use client";

import { TerminalConsole } from "@/components/terminal-console";
import type { TerminalConsoleProps } from "@/components/terminal-console-props";
import { TerminalResultsWorkspace } from "@/components/terminal-results-workspace";
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
          <TerminalResultsWorkspace
            run={run}
            activeSharePath={activeSharePath}
            copyState={copyState}
            copyShareLink={copyShareLink}
          />
        ) : null}
      </section>
    </main>
  );
}
