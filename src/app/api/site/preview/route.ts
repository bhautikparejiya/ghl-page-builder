import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/http";
import { getLibraryDocs } from "@/lib/library";
import { getSiteSettings, pickPart } from "@/lib/site";

/** What the editor shows around a page: its site header/footer (read-only preview) and the site CSS. */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const pageId = new URL(req.url).searchParams.get("pageId") ?? "";
  const site = await getSiteSettings(s.locationId);
  const header = pickPart(site.headers, pageId);
  const footer = pickPart(site.footers, pageId);
  const docs = await getLibraryDocs([header?.itemId, footer?.itemId].filter(Boolean) as string[]);
  const part = (r: typeof header) => {
    const d = r ? docs.get(r.itemId) : undefined;
    return d && r ? { id: r.itemId, name: d.name, html: d.html, css: d.css } : null;
  };
  return NextResponse.json({ header: part(header), footer: part(footer), css: site.css });
});
