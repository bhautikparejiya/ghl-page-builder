import { recordAb } from "@/lib/ab";
import { CORS_HEADERS } from "@/lib/http";
import { getPage } from "@/lib/pages";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** View beacon from live pages: { pageId, variants: { [test]: variant } }. */
export async function POST(req: Request) {
  try {
    const body = JSON.parse(await req.text()) as { pageId?: string; variants?: Record<string, string> };
    const entries = Object.entries(body.variants ?? {}).slice(0, 10);
    if (body.pageId && entries.length) {
      const page = await getPage(body.pageId);
      if (page?.published) await Promise.all(entries.map(([t, v]) => recordAb(page.id, t, v, "view")));
    }
  } catch {
    // Beacons are fire-and-forget.
  }
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
