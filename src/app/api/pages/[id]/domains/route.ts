import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { addDomain, listDomainsForPage, normalizeHost, normalizePath, removeDomain } from "@/lib/domains";
import { handle, HttpError, requireOwnedPage, requireSession } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Optional: register the domain on the Vercel project automatically (VERCEL_TOKEN + VERCEL_PROJECT_ID). */
async function addToVercel(host: string): Promise<string | null> {
  const token = process.env.VERCEL_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  const res = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains${team}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: host }),
  });
  if (res.ok || res.status === 409) return null;
  return `Saved, but the domain couldn't be added to hosting automatically (${res.status}). Add it in your hosting dashboard.`;
}

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const page = await requireOwnedPage(requireSession(req), (await params).id);
  const target = config.pagesUrl ? new URL(config.pagesUrl).host : new URL(config.appUrl).host;
  return NextResponse.json({ domains: await listDomainsForPage(page.id), cnameTarget: process.env.CUSTOM_DOMAIN_CNAME || "cname.vercel-dns.com", appHost: target });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  const page = await requireOwnedPage(s, (await params).id);
  const body = (await req.json()) as { host?: string; path?: string };
  const host = normalizeHost(body.host);
  if (!host) throw new HttpError(400, "Enter a domain like offer.yourbusiness.com");
  const appHosts = [config.appUrl, config.pagesUrl].filter(Boolean).map((u) => new URL(u).host);
  if (appHosts.includes(host)) throw new HttpError(400, "That's this app's own domain.");
  const result = await addDomain({ host, path: normalizePath(body.path), pageId: page.id, locationId: s.locationId });
  if (!result.ok) throw new HttpError(409, result.error);
  const warning = await addToVercel(host);
  return NextResponse.json({ domains: await listDomainsForPage(page.id), warning });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  const page = await requireOwnedPage(s, (await params).id);
  const url = new URL(req.url);
  await removeDomain(normalizeHost(url.searchParams.get("host")), normalizePath(url.searchParams.get("path")), s.locationId);
  return NextResponse.json({ domains: await listDomainsForPage(page.id) });
});
