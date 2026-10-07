import { NextResponse } from "next/server";
import { handle, HttpError, requireOwnedPage, requireSession } from "@/lib/http";
import { addRevision, getRevisionDoc, listRevisions, savePage } from "@/lib/pages";

type Ctx = { params: Promise<{ id: string }> };

/** Revision history (publishes + periodic draft snapshots). */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  return NextResponse.json({ revisions: await listRevisions(page.id) });
});

/** Restore a revision into the draft. The current draft is snapshotted first, so a restore can be undone. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  const { revisionId } = (await req.json()) as { revisionId?: number };
  const doc = typeof revisionId === "number" ? await getRevisionDoc(page.id, revisionId) : null;
  if (!doc) throw new HttpError(404, "Revision not found");
  await addRevision(page, "restore");
  page.draft = doc.draft;
  page.theme = doc.theme;
  page.updatedAt = Date.now();
  await savePage(page);
  return NextResponse.json({ ok: true });
});
