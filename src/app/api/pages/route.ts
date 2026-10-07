import { NextResponse } from "next/server";
import { handle, HttpError, requireOwnedPage, requireSession } from "@/lib/http";
import { canRead, getLibraryItem } from "@/lib/library";
import { createPage, listPages } from "@/lib/pages";
import { TEMPLATES } from "@/lib/templates";

export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const pages = await listPages(s.locationId);
  const templates = TEMPLATES.map(({ id, name, description, thumbnail, category }) => ({ id, name, description, thumbnail, category }));
  return NextResponse.json({ pages, templates });
});

/** Create a page from a built-in template, a saved page template (library), or duplicate an existing page. */
export const POST = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json()) as { name?: string; templateId?: string; duplicateOf?: string; libraryId?: string };

  if (body.duplicateOf) {
    const src = await requireOwnedPage(s, body.duplicateOf);
    const page = await createPage(s.locationId, {
      name: body.name || `${src.name} (copy)`,
      html: src.draft.html,
      css: src.draft.css,
      projectData: src.draft.projectData,
      theme: src.theme,
      companyId: s.companyId,
    });
    return NextResponse.json({ page });
  }

  if (body.libraryId) {
    const item = await getLibraryItem(body.libraryId);
    if (!item || !canRead(item, s.locationId, s.companyId) || !item.doc) throw new HttpError(404, "Template not found");
    // Saved pages store editor components; the editor rebuilds the page from them on first load.
    const page = await createPage(s.locationId, {
      name: body.name || item.name,
      html: item.doc.html,
      css: item.doc.css,
      projectData: { pages: [{ component: { type: "wrapper", components: item.doc.components } }], styles: [] },
      companyId: s.companyId,
    });
    return NextResponse.json({ page });
  }

  const tpl = TEMPLATES.find((t) => t.id === (body.templateId || "blank"));
  if (!tpl) throw new HttpError(400, "Unknown template");
  const page = await createPage(s.locationId, {
    name: body.name || tpl.name,
    html: tpl.html,
    css: tpl.css,
    theme: tpl.theme ? { ...tpl.theme, useKit: false } : undefined,
    companyId: s.companyId,
  });
  return NextResponse.json({ page });
});
