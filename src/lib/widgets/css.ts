import type { Background, Border, CssBuilder, Decls, Device, Length, Responsive, Shadow, Spacing, Typography } from "./types";

/** Must match the editor's device breakpoints (Editor.tsx deviceManager). */
export const MEDIA: Record<Device, string | null> = {
  desktop: null,
  tablet: "(max-width: 1023px)",
  mobile: "(max-width: 767px)",
};

/** Core brand colors, always present in every brand kit. Custom kit colors use --pf-c-<id>. */
export const CORE_COLORS = [
  { id: "primary", label: "Primary", cssVar: "--gpb-primary" },
  { id: "secondary", label: "Accent", cssVar: "--gpb-secondary" },
  { id: "text", label: "Text", cssVar: "--gpb-text" },
  { id: "background", label: "Background", cssVar: "--gpb-bg" },
] as const;

export const colorVar = (id: string) => CORE_COLORS.find((c) => c.id === id)?.cssVar ?? `--pf-c-${id.replace(/[^\w-]/g, "")}`;

/** "global:primary" → var(--gpb-primary); "global:brand-2" → var(--pf-c-brand-2); plain colors pass through. */
export function color(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  if (v.startsWith("global:")) return `var(${colorVar(v.slice(7))})`;
  // Only allow characters that can appear in CSS colors (no ; { } that could break out of the declaration).
  return /^[#\w\s(),.%/-]+$/.test(v) ? v : undefined;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const px = (v: unknown) => (isNum(v) ? `${v}px` : undefined);

export function length(v: Length | undefined, fallbackUnit: Length["unit"] = "px"): string | undefined {
  if (!v || !isNum(v.value)) return undefined;
  return `${v.value}${v.unit || fallbackUnit}`;
}

/** Spacing → longhands for the sides that are set. */
export function spacingDecls(prop: "margin" | "padding", s: Spacing | undefined): Decls {
  if (!s) return {};
  const u = s.unit || "px";
  const out: Decls = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    if (isNum(s[side])) out[`${prop}-${side}`] = `${s[side]}${u}`;
  }
  return out;
}

/** Font setting → CSS font-family value. */
export function fontFamily(font: string | undefined): string | undefined {
  if (!font) return undefined;
  if (font === "heading") return "var(--gpb-font-heading)";
  if (font === "body") return "var(--gpb-font-body)";
  if (font.startsWith("family:")) {
    const name = font.slice(7).replace(/[^\w\s-]/g, "");
    return name ? `'${name}', sans-serif` : undefined;
  }
  return undefined;
}

export function typography(css: CssBuilder, selector: string, t: Typography | undefined) {
  if (!t) return;
  css.rule(selector, {
    "font-family": fontFamily(t.font),
    "font-weight": t.weight || undefined,
    "letter-spacing": isNum(t.letterSpacing) ? `${t.letterSpacing}px` : undefined,
    "text-transform": t.transform || undefined,
    "font-style": t.style || undefined,
  });
  css.responsive(selector, t.size, (v) => ({ "font-size": px(v) }));
  css.responsive(selector, t.lineHeight, (v) => ({ "line-height": isNum(v) ? String(v) : undefined }));
}

export function backgroundDecls(b: Background | undefined): Decls {
  if (!b?.type) return {};
  if (b.type === "color") return { background: color(b.color) };
  if (b.type === "gradient") {
    const g = b.gradient ?? {};
    const from = color(g.from) ?? "var(--gpb-primary)";
    const to = color(g.to) ?? "var(--gpb-secondary)";
    return { background: `linear-gradient(${isNum(g.angle) ? g.angle : 135}deg, ${from}, ${to})` };
  }
  const img = b.image ?? {};
  const url = safeCssUrl(img.url);
  if (!url) return { "background-color": color(b.color) };
  return {
    "background-color": color(b.color),
    "background-image": `url("${url}")`,
    "background-size": img.size || "cover",
    "background-position": /^[\w\s%.-]+$/.test(img.position || "") ? img.position : "center",
    "background-repeat": img.repeat ? "repeat" : "no-repeat",
    "background-attachment": img.fixed ? "fixed" : undefined,
  };
}

/** Background + optional overlay (drawn with ::before so children stay above it). */
export function background(css: CssBuilder, selector: string, b: Background | undefined) {
  css.rule(selector, backgroundDecls(b));
  const o = b?.overlay;
  if (b?.type === "image" && o?.color) {
    const sel = selector === "&" ? "&" : selector;
    css.rule(`${sel}::before`, {
      content: '""',
      position: "absolute",
      inset: 0,
      background: color(o.color),
      opacity: isNum(o.opacity) ? o.opacity / 100 : 0.5,
      "pointer-events": "none",
      "border-radius": "inherit",
    });
    css.rule(`${sel} > *`, { position: "relative" });
  }
}

export function borderDecls(b: Border | undefined): Decls {
  if (!b?.style) return {};
  if (b.style === "none") return { border: "none" };
  return { border: `${isNum(b.width) ? b.width : 1}px ${b.style} ${color(b.color) ?? "var(--gpb-border)"}` };
}

const SHADOWS: Record<string, string> = {
  sm: "0 1px 3px rgba(15,23,42,.12)",
  md: "0 8px 24px -8px rgba(15,23,42,.22)",
  lg: "0 20px 50px -20px rgba(15,23,42,.35)",
  xl: "0 32px 80px -24px rgba(15,23,42,.45)",
};

export function shadowValue(s: Shadow | undefined): string | undefined {
  if (!s?.preset) return undefined;
  if (s.preset === "none") return "none";
  if (s.preset !== "custom") return SHADOWS[s.preset];
  const n = (v: unknown, d: number) => (isNum(v) ? v : d);
  return `${n(s.x, 0)}px ${n(s.y, 10)}px ${n(s.blur, 30)}px ${n(s.spread, 0)}px ${color(s.color) ?? "rgba(15,23,42,.25)"}`;
}

/** URLs placed inside url("…"): only http(s), root-relative and data:image are allowed. */
export function safeCssUrl(url: unknown): string {
  const u = String(url ?? "").trim();
  // The value is placed inside url("…"): only characters that could end the string or the rule are a problem.
  if (!u || /["\\<\n\r]/.test(u)) return "";
  if (/^(https?:)?\/\//i.test(u) || u.startsWith("/") || /^data:image\//i.test(u)) return u.replace(/ /g, "%20");
  return "";
}

/** Resolves the value shown/applied for a device: tablet inherits desktop, mobile inherits tablet. */
export function resolveResponsive<T>(v: Responsive<T> | undefined, device: Device): T | undefined {
  if (!v) return undefined;
  if (device === "mobile") return v.mobile ?? v.tablet ?? v.desktop;
  if (device === "tablet") return v.tablet ?? v.desktop;
  return v.desktop;
}

/** Collects scoped rules and serialises them grouped by media query. */
export function createCssBuilder(scope: string): CssBuilder & { toString(): string } {
  const buckets: Record<Device, string[]> = { desktop: [], tablet: [], mobile: [] };
  const raws: string[] = [];

  const scoped = (selector: string) =>
    selector
      .split(",")
      .map((part) => {
        const p = part.trim();
        return p.includes("&") ? p.replace(/&/g, scope) : `${scope} ${p}`;
      })
      .join(",");

  const rule = (selector: string, decls: Decls, device: Device = "desktop") => {
    const body = Object.entries(decls)
      .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== "")
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    if (body) buckets[device].push(`${scoped(selector)}{${body}}`);
  };

  return {
    rule,
    responsive(selector, value, toDecls) {
      if (!value) return;
      for (const d of ["desktop", "tablet", "mobile"] as Device[]) {
        const v = value[d];
        if (v !== undefined && v !== null) rule(selector, toDecls(v), d);
      }
    },
    raw(css) {
      raws.push(css);
    },
    toString() {
      return (
        (["desktop", "tablet", "mobile"] as Device[])
          .filter((d) => buckets[d].length)
          .map((d) => (MEDIA[d] ? `@media ${MEDIA[d]}{${buckets[d].join("")}}` : buckets[d].join("")))
          .join("") + raws.join("")
      );
    },
  };
}

/** Google font families referenced by settings ("family:Name"), for loading on the page. */
export function collectFonts(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (value.startsWith("family:")) out.add(value.slice(7));
  } else if (Array.isArray(value)) value.forEach((v) => collectFonts(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectFonts(v, out));
  return out;
}
