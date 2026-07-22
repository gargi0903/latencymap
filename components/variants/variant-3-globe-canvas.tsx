"use client";

import { ArrowRight } from "lucide-react";
import { IdleGlobe } from "@/components/variants/idle-globe";
import { VariantResults } from "@/components/variants/variant-results";
import { VariantToolbar } from "@/components/variants/variant-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLatencyTest } from "@/lib/use-latency-test";
import { cn } from "@/lib/utils";

export function Variant3GlobeCanvas() {
  const test = useLatencyTest();
  const showResults = test.hasResults || test.isLoading || test.error;

  return (
    <main className="v3">
      <div className="v3-canvas">
        {!showResults ? (
          <IdleGlobe className="v3-globe" />
        ) : (
          <div className="v3-results-scroll">
            <VariantResults {...test} />
          </div>
        )}

        <header className={cn("v3-float", showResults && "v3-float--mini")}>
          <VariantToolbar id="3" title="Globe canvas" inverted />
          <form className="v3-bar" onSubmit={test.onSubmit}>
            <Input
              value={test.url}
              onChange={(e) => test.setUrl(e.target.value)}
              placeholder="https://api.example.com"
              spellCheck={false}
              className="v3-bar__input"
              autoFocus={!showResults}
            />
            <Button type="submit" size="icon" disabled={test.isLoading} aria-label="Run test">
              <ArrowRight />
            </Button>
            {showResults ? (
              <Button type="button" variant="outline" size="sm" onClick={test.reset}>
                New
              </Button>
            ) : null}
          </form>
        </header>
      </div>
    </main>
  );
}
