import { NextRequest, NextResponse } from "next/server";
import { listRunsForUrl } from "@/lib/storage";
import { normalizeAndValidatePublicUrl } from "@/lib/url-safety";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }

  const validation = await normalizeAndValidatePublicUrl(url);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const history = await listRunsForUrl(validation.url, 10);
  return NextResponse.json({ history });
}
