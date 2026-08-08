import { notFound } from "next/navigation";
import { decodeSharePayload } from "@/lib/share-payload";

type SharePageProps = {
  params: Promise<{ id: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  const run = decodeSharePayload(id);
  if (!run) {
    notFound();
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
      {JSON.stringify(run, null, 2)}
    </main>
  );
}
