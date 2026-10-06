import { config } from "@/lib/config";
import { getPage } from "@/lib/pages";
import { fontUrl, themeCss } from "@/lib/theme";

type Ctx = { params: Promise<{ id: string }> };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Standalone hosted version of a published page (also used for the "View live" button). */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const page = await getPage(id);
  if (!page?.published) {
    return new Response("<h1>Page not found</h1>", { status: 404, headers: { "Content-Type": "text/html" } });
  }
  const { html, css, theme } = page.published;
  const title = esc(page.settings.title || page.name);
  const desc = esc(page.settings.description || "");
  const app = config.appUrl;

  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontUrl(theme)}">
<link rel="stylesheet" href="${app}/runtime.css">
<style>body{margin:0}${themeCss(theme, ".gpb-root")}${css}</style>
</head>
<body>
<div class="gpb-root">${html}</div>
<script src="${app}/runtime.js"></script>
<script>GPB.init(document,{api:${JSON.stringify(app)},pageId:${JSON.stringify(page.id)}});</script>
</body>
</html>`;

  return new Response(doc, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
    },
  });
}
