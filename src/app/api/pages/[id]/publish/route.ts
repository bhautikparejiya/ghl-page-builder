import { NextResponse } from "next/server";
import { handle, requireOwnedPage, requireSession } from "@/lib/http";
import { addRevision, type FormConfig, type PageDoc, savePage } from "@/lib/pages";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : undefined);

/** Saves the current draft and makes it live for the loader snippet and hosted URL. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  const page = await requireOwnedPage(s, (await params).id);
  const body = (await req.json()) as {
    draft: PageDoc["draft"];
    theme?: PageDoc["theme"];
    forms?: Record<string, FormConfig>;
    fonts?: string[];
    jsonLd?: string;
  };
  if (body.theme) page.theme = { ...page.theme, ...body.theme };
  page.draft = body.draft;
  page.companyId ??= s.companyId;
  const now = Date.now();
  page.updatedAt = now;

  const forms: Record<string, FormConfig> = {};
  for (const [id, f] of Object.entries(body.forms ?? {}).slice(0, 50)) {
    forms[id.slice(0, 64)] = {
      tags: (f.tags ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 20),
      workflowId: str(f.workflowId, 64),
      successMessage: str(f.successMessage, 500),
      redirectUrl: str(f.redirectUrl, 1000),
      pipelineId: str(f.pipelineId, 64),
      stageId: str(f.stageId, 64),
      opportunityName: str(f.opportunityName, 200),
      opportunityValue: typeof f.opportunityValue === "number" && Number.isFinite(f.opportunityValue) ? f.opportunityValue : undefined,
    };
  }

  let jsonLd: string | undefined;
  if (typeof body.jsonLd === "string" && body.jsonLd.length < 100_000) {
    try {
      jsonLd = JSON.stringify(JSON.parse(body.jsonLd));
    } catch {
      jsonLd = undefined;
    }
  }

  page.published = {
    html: page.draft.html,
    css: page.draft.css,
    theme: page.theme,
    forms,
    fonts: (body.fonts ?? []).filter((f) => typeof f === "string" && /^[\w\s-]{1,60}$/.test(f)).slice(0, 20),
    jsonLd,
    publishedAt: now,
    version: (page.published?.version ?? 0) + 1,
  };
  await savePage(page);
  await addRevision(page, "publish", page.published.version);
  return NextResponse.json({ ok: true, publishedAt: now, version: page.published.version });
});
