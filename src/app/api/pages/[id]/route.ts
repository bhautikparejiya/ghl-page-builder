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
  const s = requireSession(req);
  const page = await requireOwnedPage(s, (await params).id);
  page.companyId ??= s.companyId;
  const body = (await req.json()) as Partial<Pick<PageDoc, "name" | "settings" | "theme" | "draft">>;
  if (typeof body.name === "string") page.name = body.name.slice(0, 120) || page.name;
  if (body.settings) {
    const st = body.settings;
    page.settings = {
      ...page.settings,
      ...(typeof st.title === "string" ? { title: st.title.slice(0, 200) } : {}),
      ...(typeof st.description === "string" ? { description: st.description.slice(0, 500) } : {}),
      ...(typeof st.ogImage === "string" ? { ogImage: st.ogImage.slice(0, 1000) } : {}),
      ...(typeof st.noindex === "boolean" ? { noindex: st.noindex } : {}),
      ...(st.embedMode === "inline" || st.embedMode === "shadow" ? { embedMode: st.embedMode } : {}),
      ...(typeof st.hideHeader === "boolean" ? { hideHeader: st.hideHeader } : {}),
      ...(typeof st.hideFooter === "boolean" ? { hideFooter: st.hideFooter } : {}),
      ...(typeof st.customCss === "string" ? { customCss: st.customCss.slice(0, 100_000) } : {}),
      ...(typeof st.headCode === "string" ? { headCode: st.headCode.slice(0, 100_000) } : {}),
      ...(typeof st.bodyCode === "string" ? { bodyCode: st.bodyCode.slice(0, 100_000) } : {}),
    };
  }
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
