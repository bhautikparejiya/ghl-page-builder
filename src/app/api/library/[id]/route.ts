import { NextResponse } from "next/server";
import { handle, HttpError, requireSession } from "@/lib/http";
import { canRead, deleteLibraryItem, getLibraryItem, type LibraryDoc, type LibraryItem, updateLibraryItem } from "@/lib/library";
import type { Session } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function load(s: Session, id: string, write = false): Promise<LibraryItem> {
  const item = await getLibraryItem(id);
  if (!item || !canRead(item, s.locationId, s.companyId)) throw new HttpError(404, "Not found");
  // Agency templates can only be changed by agency users.
  if (write && item.ownerType === "company" && s.userType !== "agency") throw new HttpError(403, "This template is managed by your agency.");
  return item;
}

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  return NextResponse.json({ item: await load(s, (await params).id) });
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  const item = await load(s, (await params).id, true);
  const body = (await req.json()) as { name?: string; category?: string; doc?: LibraryDoc; thumbnail?: string | null };
  await updateLibraryItem(item.id, {
    name: body.name?.slice(0, 120),
    category: body.category?.slice(0, 60),
    doc: body.doc,
    thumbnail: body.thumbnail === null || (typeof body.thumbnail === "string" && body.thumbnail.startsWith("data:image/") && body.thumbnail.length < 400_000) ? body.thumbnail : undefined,
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  const item = await load(s, (await params).id, true);
  await deleteLibraryItem(item.id);
  return NextResponse.json({ ok: true });
});
