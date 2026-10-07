import { spacingDecls } from "./css";
import type { ControlGroup, CssBuilder, Responsive, Settings, Spacing } from "./types";

/**
 * The Advanced tab, shared by every widget. Settings live alongside the widget's own settings
 * under `_`-prefixed keys. The data-gpb-* attribute names are what runtime.js / runtime.css already understand.
 */
export const ADVANCED: ControlGroup[] = [
  {
    label: "Spacing",
    controls: [
      { type: "spacing", key: "_margin", label: "Margin", responsive: true },
      { type: "spacing", key: "_padding", label: "Padding", responsive: true },
      { type: "number", key: "_zIndex", label: "Z-index", step: 1 },
    ],
  },
  {
    label: "Motion",
    controls: [
      {
        type: "select",
        key: "_anim",
        label: "Entrance animation",
        options: [
          { value: "", label: "None" },
          { value: "fade-up", label: "Fade up" },
          { value: "fade-down", label: "Fade down" },
          { value: "slide-left", label: "Slide in from right" },
          { value: "slide-right", label: "Slide in from left" },
          { value: "zoom-in", label: "Zoom in" },
          { value: "flip-up", label: "Flip up" },
        ],
      },
      { type: "number", key: "_animDelay", label: "Animation delay", unit: "ms", min: 0, step: 50, when: (s) => !!s._anim },
      {
        type: "select",
        key: "_hover",
        label: "Hover effect",
        options: [
          { value: "", label: "None" },
          { value: "lift", label: "Lift" },
          { value: "grow", label: "Grow" },
          { value: "glow", label: "Glow" },
          { value: "tilt", label: "Tilt" },
        ],
      },
    ],
  },
  {
    label: "Visibility & behavior",
    controls: [
      {
        type: "select",
        key: "_hide",
        label: "Hide on",
        options: [
          { value: "", label: "Always visible" },
          { value: "desktop", label: "Desktop" },
          { value: "tablet", label: "Tablet" },
          { value: "mobile", label: "Mobile" },
        ],
      },
      { type: "select", key: "_openPopup", label: "On click, open popup", options: "popups" },
    ],
  },
  {
    label: "Attributes",
    closed: true,
    controls: [
      { type: "text", key: "_cssId", label: "CSS ID", placeholder: "e.g. signup", help: "Lets buttons link here with #signup." },
      { type: "text", key: "_cssClass", label: "CSS classes", placeholder: "class-one class-two" },
    ],
  },
  {
    label: "Custom CSS",
    closed: true,
    controls: [
      {
        type: "code",
        key: "_customCss",
        label: "CSS for this widget only",
        placeholder: "& { opacity: .95 }\n& a:hover { text-decoration: underline }",
        help: "Use & to target this widget. Applies on all devices.",
      },
    ],
  },
];

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Attributes for the widget wrapper element (in addition to its classes). */
export function advancedAttrs(s: Settings): Record<string, string> {
  const a: Record<string, string> = {};
  const id = str(s._cssId).trim().replace(/[^\w-]/g, "");
  if (id) a.id = id;
  if (s._anim) {
    a["data-gpb-anim"] = str(s._anim);
    if (typeof s._animDelay === "number" && s._animDelay > 0) a["data-gpb-delay"] = String(s._animDelay);
  }
  if (s._hover) a["data-gpb-hover"] = str(s._hover);
  if (s._hide) a["data-gpb-hide"] = str(s._hide);
  if (s._openPopup) a["data-gpb-open"] = str(s._openPopup);
  return a;
}

export function advancedClasses(s: Settings): string[] {
  return str(s._cssClass)
    .split(/\s+/)
    .map((c) => c.replace(/[^\w-]/g, ""))
    .filter(Boolean);
}

export function advancedCss(s: Settings, css: CssBuilder) {
  css.responsive("&", s._margin as Responsive<Spacing> | undefined, (v) => spacingDecls("margin", v));
  css.responsive("&", s._padding as Responsive<Spacing> | undefined, (v) => spacingDecls("padding", v));
  if (typeof s._zIndex === "number") css.rule("&", { position: "relative", "z-index": s._zIndex });
}
