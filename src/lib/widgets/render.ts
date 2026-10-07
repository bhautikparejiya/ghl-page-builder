import { advancedAttrs, advancedClasses, advancedCss } from "./advanced";
import { createCssBuilder } from "./css";
import { BRAND_PATHS, ICON_PATHS } from "./icon-data";
import type { LinkValue, Settings, WidgetDef } from "./types";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML content and attribute values. */
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** Plain text → escaped HTML, keeping line breaks. */
export const textToHtml = (v: unknown) => esc(v).replace(/\r?\n/g, "<br>");

/** Plain text → paragraphs (blank line = new paragraph). */
export const textToParagraphs = (v: unknown) =>
  String(v ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${textToHtml(p)}</p>`)
    .join("");

/** Only allow URL schemes that are safe to put in href. */
export function safeUrl(url: unknown): string {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:|sms:|#|\/|\?)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ""; // javascript:, data:, …
  return `https://${u}`;
}

/** Image sources: http(s), root-relative and inline images only. */
export function safeSrc(url: unknown): string {
  const u = String(url ?? "").trim();
  if (/^(https?:)?\/\//i.test(u) || u.startsWith("/") || /^data:image\//i.test(u)) return u;
  return "";
}

export function linkAttrs(link: LinkValue | undefined): string {
  const href = safeUrl(link?.url);
  if (!href) return ' href="#"';
  const rel = [link?.newTab && "noopener", link?.nofollow && "nofollow"].filter(Boolean).join(" ");
  return ` href="${esc(href)}"${link?.newTab ? ' target="_blank"' : ""}${rel ? ` rel="${rel}"` : ""}`;
}

/* ── Rich text ── */

const INLINE_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "a", "br", "span", "sup", "sub", "code", "mark"]);
const BLOCK_TAGS = new Set(["p", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "div"]);
const ALLOWED_CLASSES = new Set(["gpb-gradient-text", "pf-highlight"]);

function cleanAttrs(tag: string, raw: string): string {
  const out: string[] = [];
  const re = /([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    const value = (m[3] ?? m[4] ?? m[5] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    if (tag === "a" && name === "href") {
      const href = safeUrl(value);
      if (href) out.push(`href="${esc(href)}"`);
    } else if (tag === "a" && name === "target" && value === "_blank") {
      out.push('target="_blank" rel="noopener"');
    } else if (name === "class") {
      const cls = value.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c));
      if (cls.length) out.push(`class="${cls.join(" ")}"`);
    } else if (name === "style") {
      // Colors only (from the inline toolbar); anything else is dropped.
      const colorDecl = value.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|var\(--[\w-]+\))\s*(?:;|$)/i);
      if (colorDecl) out.push(`style="color:${colorDecl[1]}"`);
    }
  }
  return out.length ? " " + out.join(" ") : "";
}

/**
 * Keeps a small allow-list of formatting tags and attributes; everything else is removed (tags) or escaped.
 * `inline` restricts output to inline formatting (headings, buttons).
 */
export function sanitizeRich(html: unknown, inline = false): string {
  const src = String(html ?? "");
  const allowed = (t: string) => INLINE_TAGS.has(t) || (!inline && BLOCK_TAGS.has(t));
  let out = "";
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|<!--[\s\S]*?-->|[^<]+|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const token = m[0];
    if (token.startsWith("<!--")) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      if (!allowed(tag)) {
        if (inline && (tag === "p" || tag === "div") && token.startsWith("</")) out += "<br>";
        continue;
      }
      if (token.startsWith("</")) out += tag === "br" ? "" : `</${tag}>`;
      else out += tag === "br" ? "<br>" : `<${tag}${cleanAttrs(tag, m[2])}>`;
    } else if (token === "<") {
      out += "&lt;";
    } else {
      // Text: re-escape anything that isn't an existing entity.
      out += token.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;").replace(/>/g, "&gt;");
    }
  }
  return inline ? out.replace(/(<br>)+$/, "") : out;
}

/* ── Icons ── */

/** Icon value: Lucide name ("rocket") or brand mark ("brand:facebook"). Sized by font-size (1em). */
export function iconSvg(value: unknown, extraClass = ""): string {
  const v = String(value ?? "");
  const cls = `pf-icon${extraClass ? ` ${extraClass}` : ""}`;
  if (v.startsWith("brand:")) {
    const d = BRAND_PATHS[v.slice(6)];
    return d ? `<svg class="${cls}" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>` : "";
  }
  const inner = ICON_PATHS[v];
  return inner
    ? `<svg class="${cls}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
    : "";
}

/* ── Widgets ── */

/** Class that scopes a widget instance's generated CSS. */
export const scopeClass = (uid: string) => `pf-w-${uid}`;

export function widgetCss(def: WidgetDef, s: Settings, uid: string): string {
  const scope = `.${scopeClass(uid)}`;
  const css = createCssBuilder(scope);
  def.css?.(s, css);
  advancedCss(s, css, def);
  const custom = typeof s._customCss === "string" ? s._customCss.replace(/&/g, scope) : "";
  // Never allow generated CSS to close the <style> element it is placed in.
  return (css.toString() + custom).replace(/<\//g, "");
}

export function wrapperAttrs(def: WidgetDef, s: Settings, uid: string): Record<string, string> {
  const extra = def.wrapper?.(s, { uid }) ?? {};
  return {
    ...advancedAttrs(s),
    ...extra.attrs,
    class: ["pf-widget", `pf-${def.type}`, scopeClass(uid), ...advancedClasses(s), ...(extra.classes ?? [])].join(" "),
    "data-pf-widget": def.type,
  };
}

export const attrsToString = (attrs: Record<string, string>) =>
  Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");

export function wrapperTag(def: WidgetDef, s: Settings): string {
  const tag = def.container?.tag?.(s) ?? "div";
  return /^(div|section|header|footer|main|aside|article|nav)$/.test(tag) ? tag : "div";
}

/** Full widget HTML. Containers pass their children's HTML in `children`. */
export function widgetHtml(def: WidgetDef, s: Settings, uid: string, children?: string): string {
  const tag = wrapperTag(def, s);
  let inner: string;
  if (children === undefined) inner = def.render(s, { uid });
  else {
    const box = def.container?.inner;
    inner = box ? box.open.replace(/\sdata-pf-children(="")?/, "") + children + box.close : children;
  }
  return `<${tag}${attrsToString(wrapperAttrs(def, s, uid))}>${inner}</${tag}>`;
}

/** Short random id for widget instances (CSS scope). */
export function newUid(): string {
  return Math.random().toString(36).slice(2, 9);
}
