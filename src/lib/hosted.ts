import { composePublished } from "./compose";
import { config } from "./config";
import type { PageDoc } from "./pages";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const notFound = () => new Response("<!doctype html><title>Not found</title><h1>Page not found</h1>", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });

/** Standalone HTML document for a published page (hosted link and custom domains). */
export async function renderHostedPage(page: PageDoc, opts: { canonical?: string } = {}): Promise<Response> {
  const composed = await composePublished(page);
  if (!composed) return notFound();
  const app = config.appUrl;
  const s = page.settings;
  const title = esc(s.title || page.name);
  const desc = esc(s.description || "");
  const image = s.ogImage && /^https?:\/\//.test(s.ogImage) ? esc(s.ogImage) : "";
  const canonical = opts.canonical ? esc(opts.canonical) : "";
  const moduleCss = composed.modules.map((m) => `<link rel="stylesheet" href="${app}/runtime/m/${encodeURIComponent(m)}.css">`).join("\n");
  const moduleJs = composed.modules.map((m) => `<script src="${app}/runtime/m/${encodeURIComponent(m)}.js"></script>`).join("\n");
  // JSON-LD can't contain a closing script tag.
  const jsonLd = composed.jsonLd ? `<script type="application/ld+json">${composed.jsonLd.replace(/<\//g, "<\\/")}</script>` : "";

  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
${s.noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${canonical ? `<meta property="og:url" content="${canonical}">` : ""}
${image ? `<meta property="og:image" content="${image}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
${composed.logoUrl ? `<link rel="icon" href="${esc(composed.logoUrl)}">` : ""}
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${composed.fontUrl ? `<link rel="stylesheet" href="${composed.fontUrl}">` : ""}
<link rel="stylesheet" href="${app}/runtime/core.css">
${moduleCss}
<style>body{margin:0}${composed.css}</style>
${jsonLd}
</head>
<body>
<div class="gpb-root">${composed.html}</div>
<script src="${app}/runtime/core.js"></script>
${moduleJs}
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
