import { num, query } from "./db";

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[^\w-]/g, "")
    .slice(0, max);

/** Counts a view or a conversion for one A/B variant. */
export async function recordAb(pageId: string, test: unknown, variant: unknown, kind: "view" | "conversion") {
  const t = clean(test, 40);
  const v = clean(variant, 20);
  if (!t || !v) return;
  const col = kind === "view" ? "views" : "conversions";
  await query(
    `INSERT INTO ab_stats (page_id, test, variant, ${col}) VALUES ($1, $2, $3, 1)
     ON CONFLICT (page_id, test, variant) DO UPDATE SET ${col} = ab_stats.${col} + 1`,
    [pageId, t, v],
  );
}

export interface AbVariantStats {
  test: string;
  variant: string;
  views: number;
  conversions: number;
}

export async function abStats(pageId: string): Promise<AbVariantStats[]> {
  const rows = await query<{ test: string; variant: string; views: unknown; conversions: unknown }>(
    "SELECT test, variant, views, conversions FROM ab_stats WHERE page_id = $1 ORDER BY test, variant",
    [pageId],
  );
  return rows.map((r) => ({ test: r.test, variant: r.variant, views: num(r.views), conversions: num(r.conversions) }));
}

export async function resetAb(pageId: string, test: string) {
  await query("DELETE FROM ab_stats WHERE page_id = $1 AND test = $2", [pageId, clean(test, 40)]);
}
