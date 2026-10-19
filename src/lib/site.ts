import { num, query } from "./db";

/** Which pages a header/footer template applies to. */
export interface SitePartRule {
  itemId: string;
  mode: "all" | "include" | "exclude";
  /** Page ids for "include" / "exclude". */
  pages: string[];
}

/** Site-wide settings for a sub-account: header/footer templates and custom code. */
export interface SiteSettings {
  headers: SitePartRule[];
  footers: SitePartRule[];
  /** CSS added to every page. */
  css: string;
  /** HTML/JS added to <head> of every hosted page (and the top of embedded pages). */
  headCode: string;
  /** HTML/JS added before </body> of every page. */
  bodyCode: string;
  /** Also show the site header/footer on pages embedded in HighLevel funnels (off by default: funnels usually have their own). */
  inEmbeds: boolean;
  updatedAt?: number;
}

export const EMPTY_SITE: SiteSettings = { headers: [], footers: [], css: "", headCode: "", bodyCode: "", inEmbeds: false };

const MAX_CODE = 100_000;

function cleanRules(v: unknown): SitePartRule[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 20)
    .map((r) => {
      const x = (r ?? {}) as Partial<SitePartRule>;
      const mode = x.mode === "include" || x.mode === "exclude" ? x.mode : "all";
      return {
        itemId: String(x.itemId ?? "").replace(/[^\w-]/g, ""),
        mode,
        pages: Array.isArray(x.pages) ? x.pages.map((p) => String(p).replace(/[^\w-]/g, "")).filter(Boolean).slice(0, 500) : [],
      } as SitePartRule;
    })
    .filter((r) => r.itemId);
}

export function normalizeSite(input: Partial<SiteSettings> | null | undefined): SiteSettings {
  const s = input ?? {};
  const code = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_CODE) : "");
  return {
    headers: cleanRules(s.headers),
    footers: cleanRules(s.footers),
    css: code(s.css),
    headCode: code(s.headCode),
    bodyCode: code(s.bodyCode),
    inEmbeds: !!s.inEmbeds,
    updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : undefined,
  };
}

export async function getSiteSettings(locationId: string): Promise<SiteSettings> {
  const rows = await query<{ settings: SiteSettings; updated_at: unknown }>("SELECT settings, updated_at FROM site_settings WHERE location_id = $1", [locationId]);
  return rows[0] ? normalizeSite({ ...rows[0].settings, updatedAt: num(rows[0].updated_at) }) : { ...EMPTY_SITE };
}

export async function saveSiteSettings(locationId: string, input: Partial<SiteSettings>): Promise<SiteSettings> {
  const clean = normalizeSite(input);
  const now = Date.now();
  await query(
    `INSERT INTO site_settings (location_id, settings, updated_at) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (location_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at`,
    [locationId, JSON.stringify(clean), now],
  );
  return { ...clean, updatedAt: now };
}

/**
 * The template that applies to a page. Rules that name the page ("Only on…") win over site-wide ones,
 * so a landing page can have its own header while the rest of the site shares one.
 */
export function pickPart(rules: SitePartRule[], pageId: string): SitePartRule | null {
  return (
    rules.find((r) => r.mode === "include" && r.pages.includes(pageId)) ??
    rules.find((r) => r.mode === "all") ??
    rules.find((r) => r.mode === "exclude" && !r.pages.includes(pageId)) ??
    null
  );
}
