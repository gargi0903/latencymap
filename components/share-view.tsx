"use client";

import Link from "next/link";
import { sharePathForRun } from "@/lib/share";
import type { TestRun } from "@/lib/types";
import { CmdLabel, ResultsPanel, useCopyShareLink } from "@/components/results-panel";

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
        <ResultsPanel
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
