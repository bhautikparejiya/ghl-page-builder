import { NextResponse } from "next/server";
import { handle, requireOwnedPage, requireSession } from "@/lib/http";
import { addRevision, AUTOSAVE_SNAPSHOT_MS, deletePage, lastRevisionAt, PageDoc, savePage } from "@/lib/pages";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  return NextResponse.json({ page });
});

/** Save draft / rename / settings / theme. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  const body = (await req.json()) as Partial<Pick<PageDoc, "name" | "settings" | "theme" | "draft">>;
  if (typeof body.name === "string") page.name = body.name.slice(0, 120) || page.name;
  if (body.settings) page.settings = { ...page.settings, ...body.settings };
  if (body.theme) page.theme = { ...page.theme, ...body.theme };
  if (body.draft) page.draft = body.draft;
  page.updatedAt = Date.now();
  await savePage(page);
  if (body.draft) {
    // Periodic draft snapshot so unpublished work can be recovered too.
    const last = await lastRevisionAt(page.id, "autosave");
    if (!last || page.updatedAt - last > AUTOSAVE_SNAPSHOT_MS) await addRevision(page, "autosave");
  }
  return NextResponse.json({ ok: true, updatedAt: page.updatedAt });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  await deletePage(page);
  return NextResponse.json({ ok: true });
});
