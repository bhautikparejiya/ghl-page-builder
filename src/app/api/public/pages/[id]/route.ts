import { NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/http";
import { getPage } from "@/lib/pages";
import { fontUrl, themeCss } from "@/lib/theme";

type Ctx = { params: Promise<{ id: string }> };

/** Published page payload consumed by /loader.js on customer funnel pages. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const page = await getPage(id);
  if (!page?.published) {
    return NextResponse.json({ error: "Page not found or not published" }, { status: 404, headers: CORS_HEADERS });
  }
  const { html, css, theme, version } = page.published;
  return NextResponse.json(
    {
      id: page.id,
      version,
      html,
      css: themeCss(theme, ".gpb-root") + css,
      fontUrl: fontUrl(theme),
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
