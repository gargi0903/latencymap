"use client";

import { VariantResults } from "@/components/variants/variant-results";
import { VariantToolbar } from "@/components/variants/variant-toolbar";
import { ConstraintsRail } from "@/components/variants/constraints-rail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLatencyTest } from "@/lib/use-latency-test";
import { cn } from "@/lib/utils";

export function Variant5Receipt() {
  const test = useLatencyTest();
  const showResults = test.hasResults || test.isLoading || test.error;

  return (
    <main className="v5">
      <VariantToolbar id="5" title="Receipt unfold" />

      <section className={cn("v5-stage", showResults && "v5-stage--open")}>
        {!showResults ? (
          <form className="v5-slot" onSubmit={test.onSubmit}>
            <p className="v5-slot__title">Drop a public URL</p>
            <Input
              value={test.url}
              onChange={(e) => test.setUrl(e.target.value)}
              placeholder="https://"
              spellCheck={false}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={test.isLoading}>
              Measure
            </Button>
            <ConstraintsRail className="v-rail v-rail--stacked v-rail--tight" />
          </form>
        ) : (
          <>
            <div className="v5-strip">
              <p className="v5-strip__url">{test.url}</p>
              {test.run ? (
                <p className="v5-strip__meta">
                  {test.run.results.filter((r) => !r.error).length}/{test.run.results.length} probes · share at /r/
                  {test.run.id}
                </p>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={test.reset}>
                New test
              </Button>
            </div>
            <div className="v5-expand">
              <VariantResults {...test} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
