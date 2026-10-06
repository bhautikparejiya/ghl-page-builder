import { NextResponse } from "next/server";
import { handle, HttpError, requireOwnedPage, requireSession } from "@/lib/http";
import { createPage, listPages } from "@/lib/pages";
import { TEMPLATES } from "@/lib/templates";

export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const pages = await listPages(s.locationId);
  const templates = TEMPLATES.map(({ id, name, description, thumbnail }) => ({ id, name, description, thumbnail }));
  return NextResponse.json({ pages, templates });
});

/** Create a page from a template, or duplicate an existing page. */
export const POST = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json()) as { name?: string; templateId?: string; duplicateOf?: string };

  if (body.duplicateOf) {
    const src = await requireOwnedPage(s, body.duplicateOf);
    const page = await createPage(s.locationId, {
      name: body.name || `${src.name} (copy)`,
      html: src.draft.html,
      css: src.draft.css,
      projectData: src.draft.projectData,
      theme: src.theme,
    });
    return NextResponse.json({ page });
  }

  const tpl = TEMPLATES.find((t) => t.id === (body.templateId || "blank"));
  if (!tpl) throw new HttpError(400, "Unknown template");
  const page = await createPage(s.locationId, {
    name: body.name || tpl.name,
    html: tpl.html,
    css: tpl.css,
    theme: tpl.theme,
  });
  return NextResponse.json({ page });
});
