import { type BrandKit, DEFAULT_KIT, normalizeKit } from "./brandkit";
import { query } from "./db";

const locKey = (id: string) => `loc:${id}`;
const coKey = (id: string) => `co:${id}`;

async function read(key: string): Promise<BrandKit | null> {
  const rows = await query<{ kit: BrandKit }>("SELECT kit FROM brand_kits WHERE key = $1", [key]);
  return rows[0] ? normalizeKit(rows[0].kit) : null;
}

/** The sub-account's kit, else its agency's default kit, else the built-in default. */
export async function getKit(locationId: string, companyId?: string | null): Promise<{ kit: BrandKit; source: "location" | "agency" | "default" }> {
  const own = await read(locKey(locationId));
  if (own) return { kit: own, source: "location" };
  if (companyId) {
    const agency = await read(coKey(companyId));
    if (agency) return { kit: agency, source: "agency" };
  }
  return { kit: DEFAULT_KIT, source: "default" };
}

export async function getAgencyKit(companyId: string): Promise<BrandKit | null> {
  return read(coKey(companyId));
}

export async function saveKit(scope: "location" | "agency", ownerId: string, kit: BrandKit): Promise<BrandKit> {
  const clean = normalizeKit({ ...kit, updatedAt: Date.now() });
  await query(
    `INSERT INTO brand_kits (key, kit, updated_at) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET kit = EXCLUDED.kit, updated_at = EXCLUDED.updated_at`,
    [scope === "agency" ? coKey(ownerId) : locKey(ownerId), JSON.stringify(clean), clean.updatedAt],
  );
  return clean;
}

/** Removes the sub-account's own kit so it follows the agency default again. */
export async function resetLocationKit(locationId: string) {
  await query("DELETE FROM brand_kits WHERE key = $1", [locKey(locationId)]);
}
