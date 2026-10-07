import { num, query } from "./db";

export interface DomainMapping {
  host: string;
  path: string;
  pageId: string;
  locationId: string;
  createdAt: number;
}

/** "WWW.Example.com." → "www.example.com"; invalid hosts → "". */
export function normalizeHost(input: unknown): string {
  const h = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h) ? h : "";
}

export function normalizePath(input: unknown): string {
  const p = "/" + String(input ?? "").trim().replace(/^\/+|\/+$/g, "");
  return /^\/[\w\-/]*$/.test(p) ? p : "/";
}

export async function findDomain(host: string, path: string): Promise<DomainMapping | null> {
  const rows = await query<{ host: string; path: string; page_id: string; location_id: string; created_at: unknown }>(
    "SELECT * FROM domains WHERE host = $1 AND path = $2",
    [host, path],
  );
  const r = rows[0];
  return r ? { host: r.host, path: r.path, pageId: r.page_id, locationId: r.location_id, createdAt: num(r.created_at) } : null;
}

export async function listDomainsForHost(host: string): Promise<DomainMapping[]> {
  const rows = await query<{ host: string; path: string; page_id: string; location_id: string; created_at: unknown }>(
    "SELECT * FROM domains WHERE host = $1 ORDER BY path",
    [host],
  );
  return rows.map((r) => ({ host: r.host, path: r.path, pageId: r.page_id, locationId: r.location_id, createdAt: num(r.created_at) }));
}

export async function listDomainsForPage(pageId: string): Promise<DomainMapping[]> {
  const rows = await query<{ host: string; path: string; page_id: string; location_id: string; created_at: unknown }>(
    "SELECT * FROM domains WHERE page_id = $1 ORDER BY host, path",
    [pageId],
  );
  return rows.map((r) => ({ host: r.host, path: r.path, pageId: r.page_id, locationId: r.location_id, createdAt: num(r.created_at) }));
}

/** Adds a mapping. Fails if the host+path already points to another sub-account's page. */
export async function addDomain(m: Omit<DomainMapping, "createdAt">): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await findDomain(m.host, m.path);
  if (existing && existing.locationId !== m.locationId) return { ok: false, error: "This domain is already used by another account." };
  await query(
    `INSERT INTO domains (host, path, page_id, location_id, created_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (host, path) DO UPDATE SET page_id = EXCLUDED.page_id`,
    [m.host, m.path, m.pageId, m.locationId, Date.now()],
  );
  return { ok: true };
}

export async function removeDomain(host: string, path: string, locationId: string) {
  await query("DELETE FROM domains WHERE host = $1 AND path = $2 AND location_id = $3", [host, path, locationId]);
}
