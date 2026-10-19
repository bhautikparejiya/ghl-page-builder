import { effectiveKit, kitCss } from "./brandkit";
import { getKit } from "./kits";
import { getGlobalSections, getLibraryDocs } from "./library";
import { getLocationData } from "./locationData";
import type { PageDoc } from "./pages";
import { getSiteSettings, pickPart } from "./site";
import { fontUrlFor } from "./theme";

export interface ComposedPage {
  html: string;
  css: string;
  /** Site + page custom code for <head> (hosted pages) or the top of embedded pages. */
  headCode: string;
  /** Site + page custom code before </body>. */
  bodyCode: string;
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
 * republishing: the site header/footer, custom code, brand kit, global sections, the sub-account's
 * details and custom values.
 * `context` is "hosted" for hosted pages / custom domains and "embed" for the loader snippet.
 */
export async function composePublished(page: PageDoc, context: "hosted" | "embed" = "hosted"): Promise<ComposedPage | null> {
  const pub = page.published;
  if (!pub) return null;

  let html = pub.html;
  let css = pub.css;
  const fonts = new Set(pub.fonts ?? []);

  // Site header and footer (templates from the library, picked by their display rules).
  const site = await getSiteSettings(page.locationId);
  const withParts = context === "hosted" || site.inEmbeds;
  const header = withParts && !page.settings.hideHeader ? pickPart(site.headers, page.id) : null;
  const footer = withParts && !page.settings.hideFooter ? pickPart(site.footers, page.id) : null;
  if (header || footer) {
    const docs = await getLibraryDocs([header?.itemId, footer?.itemId].filter(Boolean) as string[]);
    const h = header ? docs.get(header.itemId) : undefined;
    const f = footer ? docs.get(footer.itemId) : undefined;
    if (h) {
      // display:contents keeps a sticky navbar sticky for the whole page, not just inside this wrapper.
      html = `<div class="pf-site-header" style="display:contents">${h.html}</div>${html}`;
      css = h.css + css;
      (h.fonts ?? []).forEach((x) => fonts.add(x));
    }
    if (f) {
      html = `${html}<footer class="pf-site-footer">${f.html}</footer>`;
      css += f.css;
      (f.fonts ?? []).forEach((x) => fonts.add(x));
    }
  }

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

  const ps = page.settings;
  return {
    html,
    // Custom CSS comes last so it can override everything; page CSS wins over site CSS.
    css: kitCss(kit, ".gpb-root") + css + (site.css || "") + (ps.customCss || ""),
    headCode: [site.headCode, ps.headCode].filter(Boolean).join("\n"),
    bodyCode: [site.bodyCode, ps.bodyCode].filter(Boolean).join("\n"),
    fontUrl: fontUrlFor([...fonts]),
    modules: [...modules],
    jsonLd: pub.jsonLd,
    logoUrl,
  };
}
