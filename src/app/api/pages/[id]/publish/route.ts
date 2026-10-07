import { NextResponse } from "next/server";
import { handle, requireOwnedPage, requireSession } from "@/lib/http";
import { addRevision, FormConfig, PageDoc, savePage } from "@/lib/pages";

type Ctx = { params: Promise<{ id: string }> };

/** Saves the current draft and makes it live for the loader snippet and hosted URL. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  const body = (await req.json()) as {
    draft: PageDoc["draft"];
    theme?: PageDoc["theme"];
    forms?: Record<string, FormConfig>;
  };
  if (body.theme) page.theme = { ...page.theme, ...body.theme };
  page.draft = body.draft;
  const now = Date.now();
  page.updatedAt = now;

  const forms: Record<string, FormConfig> = {};
  for (const [id, f] of Object.entries(body.forms ?? {})) {
    forms[id.slice(0, 64)] = {
      tags: (f.tags ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 20),
      workflowId: f.workflowId || undefined,
      successMessage: f.successMessage?.slice(0, 500),
      redirectUrl: f.redirectUrl?.slice(0, 1000),
    };
  }

  page.published = {
    html: page.draft.html,
    css: page.draft.css,
    theme: page.theme,
    forms,
    publishedAt: now,
    version: (page.published?.version ?? 0) + 1,
  };
  await savePage(page);
  await addRevision(page, "publish", page.published.version);
  return NextResponse.json({ ok: true, publishedAt: now, version: page.published.version });
});
