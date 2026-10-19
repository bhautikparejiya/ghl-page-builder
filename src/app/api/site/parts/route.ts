import { NextResponse } from "next/server";
import { SITE_PARTS, toEditorHtml, toRendered } from "@/lib/blueprints";
import { handle, HttpError, requireSession } from "@/lib/http";
import { createLibraryItem } from "@/lib/library";

/** Creates a header or footer template from a starter, ready to edit in the editor. */
export const POST = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json()) as { kind?: "header" | "footer"; template?: string; name?: string };
  if (body.kind !== "header" && body.kind !== "footer") throw new HttpError(400, "kind must be header or footer");
  const starter = SITE_PARTS[body.kind].find((t) => t.id === body.template) ?? SITE_PARTS[body.kind][0];
  const { html, css } = toRendered(starter.nodes, "s");
  const item = await createLibraryItem({
    ownerType: "location",
    ownerId: s.locationId,
    kind: body.kind,
    name: String(body.name || `${body.kind === "header" ? "Header" : "Footer"}: ${starter.label}`).slice(0, 120),
    category: "Site",
    isGlobal: false,
    // The editor parses `components` from widget markup on first open; html/css serve live pages until then.
    doc: { components: toEditorHtml(starter.nodes), html, css },
  });
  return NextResponse.json({ item });
});

/** Starter templates offered when creating a header or footer. */
export const GET = handle(async (req: Request) => {
  requireSession(req);
  const strip = (list: (typeof SITE_PARTS)["header"]) => list.map(({ id, label, description }) => ({ id, label, description }));
  return NextResponse.json({ header: strip(SITE_PARTS.header), footer: strip(SITE_PARTS.footer) });
});
