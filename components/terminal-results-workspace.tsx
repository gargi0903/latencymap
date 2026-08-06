"use client";

import { ProbeResultsPanel } from "@/components/probe-results-panel";
import type { TestRun } from "@/lib/types";

type TerminalResultsWorkspaceProps = {
  run: TestRun;
  activeSharePath: string | null;
  copyState: string;
  copyShareLink: () => void;
};

export function TerminalResultsWorkspace({
  run,
  activeSharePath,
  copyState,
  copyShareLink,
}: TerminalResultsWorkspaceProps) {
  return (
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
  );
}
