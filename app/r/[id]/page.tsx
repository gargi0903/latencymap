import { notFound } from "next/navigation";
import { ResultsView } from "@/components/results-view";
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

  return <ResultsView initialRun={run} initialHistory={history} />;
}
