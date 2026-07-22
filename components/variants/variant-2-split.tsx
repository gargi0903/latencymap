"use client";

import { VariantResults } from "@/components/variants/variant-results";
import { VariantToolbar } from "@/components/variants/variant-toolbar";
import { ConstraintsRail } from "@/components/variants/constraints-rail";
import { IdleGlobe } from "@/components/variants/idle-globe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLatencyTest } from "@/lib/use-latency-test";

export function Variant2Split() {
  const test = useLatencyTest();
  const showResults = test.hasResults || test.isLoading || test.error;

  return (
    <main className="v2">
      <VariantToolbar id="2" title="Split instrument" />

      <div className="v2-grid">
        <aside className="v2-rail">
          <p className="v2-rail__line">Command stays here. Evidence fills the canvas.</p>
          <form className="v2-form" onSubmit={test.onSubmit}>
            <label htmlFor="v2-url" className="v2-label">
              Public URL
            </label>
            <Input
              id="v2-url"
              value={test.url}
              onChange={(e) => test.setUrl(e.target.value)}
              placeholder="https://"
              spellCheck={false}
            />
            <Button type="submit" className="w-full" disabled={test.isLoading}>
              {test.isLoading ? "Running…" : "Run test"}
            </Button>
          </form>
          <ConstraintsRail className="v-rail v-rail--stacked" />
          {showResults ? (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={test.reset}>
              New URL
            </Button>
          ) : null}
        </aside>

        <section className="v2-canvas">
          {!showResults ? (
            <IdleGlobe className="v2-globe-idle" label="Results appear here" />
          ) : (
            <div className="v2-results">
              <VariantResults {...test} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
