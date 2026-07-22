"use client";

import { ArrowRight } from "lucide-react";
import { ConstraintsRail } from "@/components/variants/constraints-rail";
import { VariantResults } from "@/components/variants/variant-results";
import { VariantToolbar } from "@/components/variants/variant-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLatencyTest } from "@/lib/use-latency-test";
import { cn } from "@/lib/utils";

export function Variant1OmniBar() {
  const test = useLatencyTest();
  const showResults = test.hasResults || test.isLoading || test.error;

  return (
    <main className={cn("v1", showResults && "v1--results")}>
      <VariantToolbar id="1" title="Omni bar" inverted={!showResults} />

      {!showResults ? (
        <section className="v1-idle">
          <p className="v1-idle__line">Paste a public URL. Five regions respond in parallel.</p>
          <form className="v1-omnibar" onSubmit={test.onSubmit} aria-label="Run a latency test">
            <Input
              value={test.url}
              onChange={(e) => test.setUrl(e.target.value)}
              placeholder="https://api.example.com/health"
              spellCheck={false}
              className="v1-omnibar__input"
              autoFocus
            />
            <Button type="submit" className="v1-omnibar__btn">
              Run
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>
          <ConstraintsRail className="v-rail" />
        </section>
      ) : (
        <>
          <div className="v1-pinned">
            <form className="v1-omnibar v1-omnibar--compact" onSubmit={test.onSubmit}>
              <Input
                value={test.url}
                onChange={(e) => test.setUrl(e.target.value)}
                spellCheck={false}
                className="v1-omnibar__input"
              />
              <Button type="submit" size="sm" disabled={test.isLoading}>
                Run again
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={test.reset}>
                Clear
              </Button>
            </form>
          </div>
          <section className="v1-results">
            <VariantResults {...test} />
          </section>
        </>
      )}
    </main>
  );
}
