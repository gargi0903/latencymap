"use client";

import { LatencymapWordmark } from "@/components/latencymap-wordmark";
import { VariantResults } from "@/components/variants/variant-results";
import { latencyHexColor } from "@/lib/latency-display";
import { useLatencyTest } from "@/lib/use-latency-test";

export function Variant4Cli() {
  const test = useLatencyTest();
  const showResults = test.hasResults || test.isLoading || test.error;

  return (
    <main className="v4">
      <header className="v4-header">
        <LatencymapWordmark inverted className="text-[clamp(1.1rem,2.2vw,1.5rem)]" />
      </header>

      <section className="v4-terminal">
        <div className="v4-shell">
          <form className="v4-line" onSubmit={test.onSubmit}>
            <span className="v4-prompt" aria-hidden="true">
              $
            </span>
            <label htmlFor="v4-url" className="v4-command">
              probe
            </label>
            <input
              id="v4-url"
              value={test.url}
              onChange={(e) => test.setUrl(e.target.value)}
              placeholder="https://api.example.com"
              spellCheck={false}
              className="v4-input"
              autoFocus
            />
          </form>

          {test.isLoading ? (
            <p className="v4-log v4-log--muted">
              <span className="v4-log__arrow">→</span> dispatching to iad, lhr, sin, syd, gru…
            </p>
          ) : null}

          {test.error ? (
            <p className="v4-log v4-log--error">
              <span className="v4-log__arrow">✕</span> {test.error}
            </p>
          ) : null}

          {test.run ? (
            <div className="v4-log-block">
              <p className="v4-log v4-log--summary">
                <span className="v4-log__arrow">→</span> {test.run.results.length} regions · {test.run.normalizedUrl}
              </p>
              {test.run.results.map((result) => (
                <p key={result.region} className="v4-log v4-log--row">
                  <span className="v4-log__region">{result.region}</span>
                  <span
                    className="v4-log__ms"
                    style={{ color: latencyHexColor(result.totalMs, result.error) }}
                  >
                    {result.error ?? `${result.totalMs} ms`}
                  </span>
                  <span className="v4-log__colo">{result.cloudflareColo ?? "—"}</span>
                </p>
              ))}
            </div>
          ) : null}

          {showResults && !test.isLoading ? (
            <div className="v4-actions">
              <button type="button" className="v4-link" onClick={test.reset}>
                clear
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {test.run && !test.isLoading ? (
        <section className="v4-results">
          <div className="v4-results__panel">
            <VariantResults isLoading={false} error={null} run={test.run} url={test.url} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
