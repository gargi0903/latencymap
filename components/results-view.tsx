"use client";

import Link from "next/link";
import { useState } from "react";
import { CmdLabel } from "@/components/cmd-label";
import { ProbeResultsPanel } from "@/components/probe-results-panel";
import { sharePathForRun } from "@/lib/share-payload";
import type { TestRun } from "@/lib/types";

type Props = {
  initialRun: TestRun;
};

export function ResultsView({ initialRun }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const sharePath = sharePathForRun(initialRun);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  }

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
        <div className="terminal__feed">
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
      </div>
    </section>
  );
}
