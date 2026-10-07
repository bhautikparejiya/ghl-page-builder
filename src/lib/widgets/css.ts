import type { CssBuilder, Decls, Device, Responsive, Spacing, Typography } from "./types";

/** Must match the editor's device breakpoints (Editor.tsx deviceManager). */
export const MEDIA: Record<Device, string | null> = {
  desktop: null,
  tablet: "(max-width: 1023px)",
  mobile: "(max-width: 767px)",
};

/** Theme tokens a color control can bind to (CSS variables set by themeCss()). */
export const GLOBAL_COLORS = [
  { id: "primary", label: "Primary", cssVar: "--gpb-primary" },
  { id: "secondary", label: "Accent", cssVar: "--gpb-secondary" },
  { id: "text", label: "Text", cssVar: "--gpb-text" },
  { id: "background", label: "Background", cssVar: "--gpb-bg" },
] as const;

/** "global:primary" → var(--gpb-primary); plain colors pass through. */
export function color(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  if (v.startsWith("global:")) {
    const g = GLOBAL_COLORS.find((c) => c.id === v.slice(7));
    return g ? `var(${g.cssVar})` : undefined;
  }
  return v;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const px = (v: unknown) => (isNum(v) ? `${v}px` : undefined);

/** Spacing → shorthand; unset sides are left alone by emitting longhands only for those that are set. */
export function spacingDecls(prop: "margin" | "padding", s: Spacing | undefined): Decls {
  if (!s) return {};
  const u = s.unit || "px";
  const out: Decls = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    if (isNum(s[side])) out[`${prop}-${side}`] = `${s[side]}${u}`;
  }
  return out;
}

const FONT_VAR = { heading: "var(--gpb-font-heading)", body: "var(--gpb-font-body)" };

export function typography(css: CssBuilder, selector: string, t: Typography | undefined) {
  if (!t) return;
  css.rule(selector, {
    "font-family": t.font ? FONT_VAR[t.font] : undefined,
    "font-weight": t.weight || undefined,
    "letter-spacing": isNum(t.letterSpacing) ? `${t.letterSpacing}px` : undefined,
    "text-transform": t.transform || undefined,
    "font-style": t.style || undefined,
  });
  css.responsive(selector, t.size, (v) => ({ "font-size": px(v) }));
  css.responsive(selector, t.lineHeight, (v) => ({ "line-height": isNum(v) ? String(v) : undefined }));
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
    toString() {
      return (["desktop", "tablet", "mobile"] as Device[])
        .filter((d) => buckets[d].length)
        .map((d) => (MEDIA[d] ? `@media ${MEDIA[d]}{${buckets[d].join("")}}` : buckets[d].join("")))
        .join("");
    },
  };
}
