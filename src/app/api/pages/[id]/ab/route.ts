import { NextResponse } from "next/server";
import { abStats, resetAb } from "@/lib/ab";
import { handle, requireOwnedPage, requireSession } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** A/B test results for this page. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  return NextResponse.json({ stats: await abStats(page.id) });
});

/** Resets one test's counters (?test=name). */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  const test = new URL(req.url).searchParams.get("test") ?? "";
  await resetAb(page.id, test);
  return NextResponse.json({ ok: true });
});
