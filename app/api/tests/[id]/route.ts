import { NextResponse } from "next/server";
import { decodeSharePayload } from "@/lib/share-payload";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const run = decodeSharePayload(id);

  if (!run) {
    return NextResponse.json({ error: "Invalid or expired share link." }, { status: 404 });
  }

  return NextResponse.json({ run });
}
