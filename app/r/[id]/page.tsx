import { notFound } from "next/navigation";
import { ResultsView } from "@/components/share-view";
import { decodeSharePayload } from "@/lib/share";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ResultPage({ params }: Props) {
  const { id } = await params;
  const run = decodeSharePayload(id);

  if (!run) {
    notFound();
  }

  return (
    <main className="terminal">
      <ResultsView initialRun={run} />
    </main>
  );
}
