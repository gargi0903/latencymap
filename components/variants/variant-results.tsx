import { Loader2 } from "lucide-react";
import { ResultsView } from "@/components/results-view";
import { Alert } from "@/components/ui/alert";
import type { TestRun } from "@/lib/types";

type Props = {
  isLoading: boolean;
  error: string | null;
  run: TestRun | null;
  url: string;
};

export function VariantResults({ isLoading, error, run, url }: Props) {
  if (isLoading) {
    return (
      <Alert className="flex items-center gap-3 border-border bg-secondary text-accent-foreground" role="status">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span className="min-w-0 truncate">Probing {url || "target URL"}…</span>
      </Alert>
    );
  }

  if (error) {
    return <Alert variant="destructive">{error}</Alert>;
  }

  if (!run) return null;

  return <ResultsView initialRun={run} />;
}
