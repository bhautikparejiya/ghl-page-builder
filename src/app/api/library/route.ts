import { NextResponse } from "next/server";
import { handle, HttpError, requireSession } from "@/lib/http";
import { createLibraryItem, getGlobalSections, type LibraryDoc, type LibraryKind, listLibrary } from "@/lib/library";

const MAX_DOC = 2_000_000;
const MAX_THUMB = 400_000;

/** Saved sections and pages for this sub-account, plus templates shared by its agency. */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const items = await listLibrary(s.locationId, s.companyId);
  // Global sections are shown read-only on the canvas, so their rendered HTML/CSS comes along.
  const docs = await getGlobalSections(items.filter((i) => i.isGlobal).map((i) => i.id));
  return NextResponse.json({
    items: items.map((i) => (i.isGlobal && docs.has(i.id) ? { ...i, doc: { html: docs.get(i.id)!.html, css: docs.get(i.id)!.css } } : i)),
    canShare: s.userType === "agency" && !!s.companyId,
  });
});

export const POST = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json()) as {
    kind?: LibraryKind;
    name?: string;
    category?: string;
    isGlobal?: boolean;
    shareWithAgency?: boolean;
    doc?: LibraryDoc;
    thumbnail?: string;
  };
  if (!body.doc || (body.kind !== "section" && body.kind !== "page")) throw new HttpError(400, "Missing content");
  if (JSON.stringify(body.doc).length > MAX_DOC) throw new HttpError(413, "This content is too large to save.");
  const share = !!body.shareWithAgency;
  if (share && (s.userType !== "agency" || !s.companyId)) throw new HttpError(403, "Only agency users can share with all sub-accounts.");
  const thumb = typeof body.thumbnail === "string" && body.thumbnail.startsWith("data:image/") && body.thumbnail.length < MAX_THUMB ? body.thumbnail : undefined;
  const item = await createLibraryItem({
    ownerType: share ? "company" : "location",
    ownerId: share ? s.companyId! : s.locationId,
    kind: body.kind,
    name: String(body.name || "Untitled").slice(0, 120),
    category: String(body.category || "").slice(0, 60),
    isGlobal: body.kind === "section" && !!body.isGlobal,
    doc: body.doc,
    thumbnail: thumb,
  });
  return NextResponse.json({ item });
});
