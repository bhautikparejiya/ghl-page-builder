import { findDomain, listDomainsForHost, normalizeHost, normalizePath } from "@/lib/domains";
import { notFound, renderHostedPage } from "@/lib/hosted";
import { getPage } from "@/lib/pages";

type Ctx = { params: Promise<{ path?: string[] }> };

const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/**
 * Custom domains. The proxy rewrites requests for hosts that aren't ours to /d/<path>; the original
 * Host header tells us which page to serve.
 */
export async function GET(req: Request, { params }: Ctx) {
  const host = normalizeHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  if (!host) return notFound();
  const raw = "/" + ((await params).path ?? []).join("/");
  const path = normalizePath(raw);
  const origin = `https://${host}`;

  if (raw === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain" } });
  }
  if (raw === "/sitemap.xml") {
    const urls: string[] = [];
    for (const d of await listDomainsForHost(host)) {
      const page = await getPage(d.pageId);
      if (page?.published && !page.settings.noindex) {
        urls.push(`<url><loc>${xmlEsc(origin + (d.path === "/" ? "/" : d.path))}</loc><lastmod>${new Date(page.published.publishedAt).toISOString()}</lastmod></url>`);
      }
    }
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`, {
      headers: { "Content-Type": "application/xml" },
    });
  }

  // Only clean paths map to pages; anything else (files, odd characters) is a 404 rather than the home page.
  if (path !== raw.replace(/\/+$/, "") && !(raw === "/" && path === "/")) return notFound();
  const mapping = await findDomain(host, path);
  if (!mapping) return notFound();
  const page = await getPage(mapping.pageId);
  if (!page?.published || page.locationId !== mapping.locationId) return notFound();
  return renderHostedPage(page, { canonical: origin + (path === "/" ? "/" : path) });
}
