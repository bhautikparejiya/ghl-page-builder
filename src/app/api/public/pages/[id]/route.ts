import { NextResponse } from "next/server";
import { composePublished } from "@/lib/compose";
import { CORS_HEADERS } from "@/lib/http";
import { getPage } from "@/lib/pages";

type Ctx = { params: Promise<{ id: string }> };

/** Published page payload consumed by /loader.js on customer funnel pages. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const page = await getPage(id);
  const composed = page ? await composePublished(page) : null;
  if (!page?.published || !composed) {
    return NextResponse.json({ error: "Page not found or not published" }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json(
    {
      id: page.id,
      version: page.published.version,
      html: composed.html,
      css: composed.css,
      fontUrl: composed.fontUrl,
      modules: composed.modules,
      embedMode: page.settings.embedMode === "inline" ? "inline" : "shadow",
    },
    {
      headers: {
        ...CORS_HEADERS,
        // Short CDN cache so "Publish" shows up within ~30s without hammering storage.
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
      },
    },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
