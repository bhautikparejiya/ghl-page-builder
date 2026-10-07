import { num, query } from "./db";
import { ghlFetch } from "./ghl";

/** Sub-account details and custom values used for {{location.*}} / {{custom_values.*}} on live pages. */
export interface LocationData {
  location: Record<string, string>;
  customValues: Record<string, string>;
  logoUrl?: string;
}

const TTL = 10 * 60 * 1000;

interface GhlLocation {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  timezone?: string;
  business?: { name?: string; logoUrl?: string; website?: string; address?: string; city?: string; state?: string };
}

async function fetchLocationData(locationId: string, companyId?: string | null): Promise<LocationData> {
  const [loc, cv] = await Promise.allSettled([
    ghlFetch<{ location: GhlLocation }>(locationId, `/locations/${encodeURIComponent(locationId)}`, {}, companyId ?? undefined),
    ghlFetch<{ customValues: { fieldKey?: string; name?: string; value?: string }[] }>(
      locationId,
      `/locations/${encodeURIComponent(locationId)}/customValues`,
      {},
      companyId ?? undefined,
    ),
  ]);
  const l = loc.status === "fulfilled" ? (loc.value.location ?? {}) : {};
  const b = l.business ?? {};
  const fullAddress = [l.address || b.address, l.city || b.city, l.state || b.state, l.postalCode, l.country].filter(Boolean).join(", ");
  const location: Record<string, string> = {
    name: b.name || l.name || "",
    phone: l.phone || "",
    email: l.email || "",
    website: l.website || b.website || "",
    address: fullAddress,
    city: l.city || b.city || "",
    state: l.state || b.state || "",
    country: l.country || "",
    postal_code: l.postalCode || "",
  };
  const customValues: Record<string, string> = {};
  if (cv.status === "fulfilled") {
    for (const v of cv.value.customValues ?? []) {
      // fieldKey looks like "{{ custom_values.my_value }}"
      const key = (v.fieldKey ?? "").match(/custom_values\.([\w-]+)/)?.[1] ?? (v.name ?? "").toLowerCase().replace(/\W+/g, "_");
      if (key) customValues[key] = v.value ?? "";
    }
  }
  return { location, customValues, logoUrl: b.logoUrl || l.logoUrl || undefined };
}

/** Cached for 10 minutes; falls back to stale data (or empty values) if HighLevel can't be reached. */
export async function getLocationData(locationId: string, companyId?: string | null): Promise<LocationData> {
  const rows = await query<{ data: LocationData; fetched_at: unknown }>("SELECT data, fetched_at FROM location_cache WHERE location_id = $1", [locationId]);
  const cached = rows[0];
  if (cached && Date.now() - num(cached.fetched_at) < TTL) return cached.data;
  try {
    const data = await fetchLocationData(locationId, companyId);
    await query(
      `INSERT INTO location_cache (location_id, data, fetched_at) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (location_id) DO UPDATE SET data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at`,
      [locationId, JSON.stringify(data), Date.now()],
    );
    return data;
  } catch {
    return cached?.data ?? { location: {}, customValues: {} };
  }
}

export async function clearLocationCache(locationId: string) {
  await query("DELETE FROM location_cache WHERE location_id = $1", [locationId]);
}
