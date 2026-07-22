import { NextResponse } from "next/server";
import { getTestRun, listRunsForUrl } from "@/lib/storage";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const run = await getTestRun(id);

  if (!run) {
    return NextResponse.json({ error: "Test run not found." }, { status: 404 });
  }

  const history = await listRunsForUrl(run.normalizedUrl, 5);
  return NextResponse.json({ run, history });
}
