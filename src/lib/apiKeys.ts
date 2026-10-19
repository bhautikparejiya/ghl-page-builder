import crypto from "node:crypto";
import { num, query } from "./db";
import { newId } from "./pages";

export interface ApiKey {
  id: string;
  locationId: string;
  companyId?: string;
  name: string;
  /** First characters of the key, shown so people can tell keys apart. */
  prefix: string;
  createdBy?: string;
  createdAt: number;
  lastUsedAt: number | null;
}

interface Row {
  id: string;
  location_id: string;
  company_id: string | null;
  name: string;
  prefix: string;
  created_by: string | null;
  created_at: unknown;
  last_used_at: unknown;
}

const fromRow = (r: Row): ApiKey => ({
  id: r.id,
  locationId: r.location_id,
  companyId: r.company_id ?? undefined,
  name: r.name,
  prefix: r.prefix,
  createdBy: r.created_by ?? undefined,
  createdAt: num(r.created_at),
  lastUsedAt: r.last_used_at == null ? null : num(r.last_used_at),
});

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Keys look like pfk_<40 random chars>; anything else is rejected before touching the database. */
const KEY_RE = /^pfk_[A-Za-z0-9]{40}$/;

export async function listApiKeys(locationId: string): Promise<ApiKey[]> {
  const rows = await query<Row>(
    "SELECT id, location_id, company_id, name, prefix, created_by, created_at, last_used_at FROM api_keys WHERE location_id = $1 ORDER BY created_at DESC",
    [locationId],
  );
  return rows.map(fromRow);
}

/** Creates a key. The plain token is returned only here; the database keeps its hash. */
export async function createApiKey(input: { locationId: string; companyId?: string; name: string; createdBy?: string }): Promise<{ key: ApiKey; token: string }> {
  const token = `pfk_${newId(40)}`;
  const key: ApiKey = {
    id: newId(),
    locationId: input.locationId,
    companyId: input.companyId,
    name: input.name.slice(0, 80) || "AI assistant",
    prefix: token.slice(0, 10),
    createdBy: input.createdBy,
    createdAt: Date.now(),
    lastUsedAt: null,
  };
  await query(
    `INSERT INTO api_keys (id, location_id, company_id, name, token_hash, prefix, created_by, created_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
    [key.id, key.locationId, key.companyId ?? null, key.name, hash(token), key.prefix, key.createdBy ?? null, key.createdAt],
  );
  return { key, token };
}

export async function revokeApiKey(locationId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM api_keys WHERE id = $1 AND location_id = $2 RETURNING id", [id, locationId]);
  return rows.length > 0;
}

/** The key's owner, or null. Records when it was last used (at most once a minute). */
export async function verifyApiKey(token: string | null | undefined): Promise<ApiKey | null> {
  if (!token || !KEY_RE.test(token)) return null;
  const rows = await query<Row>(
    "SELECT id, location_id, company_id, name, prefix, created_by, created_at, last_used_at FROM api_keys WHERE token_hash = $1",
    [hash(token)],
  );
  if (!rows[0]) return null;
  const key = fromRow(rows[0]);
  const now = Date.now();
  if (!key.lastUsedAt || now - key.lastUsedAt > 60_000) {
    await query("UPDATE api_keys SET last_used_at = $2 WHERE id = $1", [key.id, now]).catch(() => undefined);
  }
  return key;
}
