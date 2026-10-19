import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/http";
import { listLibrary } from "@/lib/library";
import { listPages } from "@/lib/pages";
import { getSiteSettings, saveSiteSettings, type SiteSettings } from "@/lib/site";

/** Site settings, plus the header/footer templates and pages the settings dialog needs. */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const [site, items, pages] = await Promise.all([getSiteSettings(s.locationId), listLibrary(s.locationId, s.companyId), listPages(s.locationId)]);
  const parts = items
    .filter((i) => i.kind === "header" || i.kind === "footer")
    .map(({ id, name, kind, thumbnail, ownerType, updatedAt }) => ({ id, name, kind, thumbnail, ownerType, updatedAt }));
  return NextResponse.json({ site, parts, pages: pages.map((p) => ({ id: p.id, name: p.name })) });
});

export const PUT = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json()) as Partial<SiteSettings>;
  return NextResponse.json({ site: await saveSiteSettings(s.locationId, body) });
});
