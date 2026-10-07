import { effectiveKit, kitCss } from "./brandkit";
import { getKit } from "./kits";
import { getGlobalSections } from "./library";
import { getLocationData } from "./locationData";
import type { PageDoc } from "./pages";
import { fontUrlFor } from "./theme";

export interface ComposedPage {
  html: string;
  css: string;
  fontUrl: string;
  modules: string[];
  jsonLd?: string;
  logoUrl?: string;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ESC[c]);

const GLOBAL_RE = /<div data-pf-global="([\w-]+)"><\/div>/g;
const TOKEN_RE = /\{\{\s*(location|custom_values)\.([\w-]+)\s*\}\}/g;
const KIT_LOGO_RE = /<span class="pf-nav-logo-kit" data-pf-kit-logo>([^<]*)<\/span>/g;

/**
 * Builds what a live page serves from its published snapshot plus things that can change without
 * republishing: the brand kit, global sections, the sub-account's details and custom values.
 */
export async function composePublished(page: PageDoc): Promise<ComposedPage | null> {
  const pub = page.published;
  if (!pub) return null;

  let html = pub.html;
  let css = pub.css;
  const fonts = new Set(pub.fonts ?? []);

  // Global sections: placeholders are replaced with the section's current content.
  const globalIds = [...html.matchAll(GLOBAL_RE)].map((m) => m[1]);
  if (globalIds.length) {
    const docs = await getGlobalSections([...new Set(globalIds)]);
    html = html.replace(GLOBAL_RE, (_m, id: string) => {
      const doc = docs.get(id);
      if (!doc) return "";
      (doc.fonts ?? []).forEach((f) => fonts.add(f));
      return doc.html;
    });
    for (const id of new Set(globalIds)) {
      const doc = docs.get(id);
      if (doc) css += doc.css;
    }
  }

  const { kit: baseKit } = await getKit(page.locationId, page.companyId);
  const kit = effectiveKit(baseKit, pub.theme);
  kit.fonts.heading && fonts.add(kit.fonts.heading);
  kit.fonts.body && fonts.add(kit.fonts.body);

  // {{location.name}}, {{custom_values.key}}: only fetched when the page uses them.
  let logoUrl = kit.logoUrl;
  if (/\{\{\s*(location|custom_values)\./.test(html) || (!logoUrl && html.includes("data-pf-kit-logo"))) {
    const data = await getLocationData(page.locationId, page.companyId);
    logoUrl ||= data.logoUrl;
    html = html.replace(TOKEN_RE, (_m, ns: string, key: string) => esc((ns === "location" ? data.location : data.customValues)[key] ?? ""));
  }
  if (logoUrl) html = html.replace(KIT_LOGO_RE, (_m, alt: string) => `<img class="pf-nav-logo" src="${esc(logoUrl!)}" alt="${alt}">`);

  // Runtime modules = interactive widgets present on the final page (data-gpb="tabs" → /runtime/m/tabs.js).
  const modules = new Set([...html.matchAll(/data-gpb="([\w-]+)"/g)].map((m) => m[1]));

  return {
    html,
    css: kitCss(kit, ".gpb-root") + css,
    fontUrl: fontUrlFor([...fonts]),
    modules: [...modules],
    jsonLd: pub.jsonLd,
    logoUrl,
  };
}
