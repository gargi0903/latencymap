import { notFound } from "next/navigation";
import Link from "next/link";
import { LatencymapWordmark } from "@/components/latencymap-wordmark";
import { ResultsView } from "@/components/results-view";
import { Button } from "@/components/ui/button";
import { getTestRun, listRunsForUrl } from "@/lib/storage";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ResultPage({ params }: Props) {
  const { id } = await params;
  const run = await getTestRun(id);

  if (!run) {
    notFound();
  }

  const history = await listRunsForUrl(run.normalizedUrl, 5);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-4 sm:px-6 lg:px-7">
      <header className="mb-8 flex min-h-14 items-center justify-between">
        <LatencymapWordmark className="wordmark--header" />
        <Button asChild variant="outline" size="sm">
          <Link href="/">New test</Link>
        </Button>
      </header>
      <ResultsView initialRun={run} initialHistory={history} />
      </div>
    </main>
  );
}
