import { spacingDecls } from "./css";
import type { ControlGroup, CssBuilder, Responsive, Settings, Spacing, WidgetDef } from "./types";

/**
 * The Advanced tab, shared by every widget. Settings live alongside the widget's own settings
 * under `_`-prefixed keys. data-gpb-* attribute names are what the runtime already understands.
 */
export function advancedGroups(def: WidgetDef): ControlGroup[] {
  const isContainer = !!def.container;
  return [
    {
      label: "Spacing",
      controls: [
        { type: "spacing", key: "_margin", label: "Margin", responsive: true },
        ...(def.noAdvancedSpacing ? [] : [{ type: "spacing" as const, key: "_padding", label: "Padding", responsive: true }]),
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
        {
          type: "select",
          key: "_scrollFx",
          label: "Scroll effect",
          options: [
            { value: "", label: "None" },
            { value: "parallax", label: "Parallax (moves slower)" },
            { value: "fade", label: "Fade in and out" },
            { value: "scale", label: "Grow while scrolling in" },
          ],
        },
        { type: "number", key: "_scrollSpeed", label: "Effect strength", min: 1, max: 10, slider: true, when: (s) => !!s._scrollFx },
        {
          type: "buttons",
          key: "_sticky",
          label: "Sticky",
          options: [
            { value: "", label: "Off" },
            { value: "top", label: "Top" },
            { value: "bottom", label: "Bottom" },
          ],
          help: "Stays in view while its parent scrolls past.",
        },
        { type: "number", key: "_stickyOffset", label: "Sticky offset", unit: "px", min: 0, when: (s) => !!s._sticky },
      ],
    },
    {
      label: "Visibility & behavior",
      controls: [
        { type: "toggle", key: "_hideDesktop", label: "Hide on desktop" },
        { type: "toggle", key: "_hideTablet", label: "Hide on tablet" },
        { type: "toggle", key: "_hideMobile", label: "Hide on mobile" },
        { type: "select", key: "_openPopup", label: "On click, open popup", options: "popups" },
      ],
    },
    {
      label: "Display conditions",
      closed: true,
      controls: [
        { type: "datetime", key: "_condFrom", label: "Show from", help: "Visitor's local time." },
        { type: "datetime", key: "_condTo", label: "Show until" },
        { type: "text", key: "_condParam", label: "Only if URL has", placeholder: "utm_source=facebook", help: "A query parameter, optionally with =value." },
        {
          type: "buttons",
          key: "_condVisitor",
          label: "Visitors",
          options: [
            { value: "", label: "All" },
            { value: "new", label: "New" },
            { value: "returning", label: "Returning" },
          ],
        },
      ],
    },
    ...(isContainer
      ? [
          {
            label: "A/B test",
            closed: true,
            controls: [
              {
                type: "text" as const,
                key: "_abTest",
                label: "Test name",
                placeholder: "hero-test",
                help: "Give two or more sections the same test name. Each visitor sees one of them; views and form conversions are counted per variant.",
              },
              { type: "text" as const, key: "_abVariant", label: "Variant name", placeholder: "A", when: (s: Settings) => !!s._abTest },
            ],
          },
        ]
      : []),
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
          label: "CSS for this element only",
          language: "css",
          placeholder: "& { opacity: .95 }\n& a:hover { text-decoration: underline }",
          help: "Use & to target this element. Applies on all devices.",
        },
      ],
    },
  ];
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

const slug = (v: unknown, max = 40) =>
  str(v)
    .trim()
    .replace(/[^\w-]+/g, "-")
    .slice(0, max);

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
  if (s._openPopup) a["data-gpb-open"] = str(s._openPopup);
  if (s._scrollFx) {
    a["data-pf-scroll"] = str(s._scrollFx);
    a["data-pf-speed"] = String(typeof s._scrollSpeed === "number" ? s._scrollSpeed : 4);
  }
  const cond: Record<string, string> = {};
  if (s._condFrom) cond.from = str(s._condFrom);
  if (s._condTo) cond.to = str(s._condTo);
  if (s._condParam) cond.param = str(s._condParam).slice(0, 200);
  if (s._condVisitor) cond.visitor = str(s._condVisitor);
  if (Object.keys(cond).length) a["data-pf-cond"] = JSON.stringify(cond);
  if (s._abTest) {
    a["data-pf-ab"] = slug(s._abTest);
    a["data-pf-variant"] = slug(s._abVariant || "A", 20) || "A";
  }
  return a;
}

export function advancedClasses(s: Settings): string[] {
  const out = str(s._cssClass)
    .split(/\s+/)
    .map((c) => c.replace(/[^\w-]/g, ""))
    .filter(Boolean);
  // Legacy single-select "hide on" value from the first widget version.
  if (s._hideDesktop || s._hide === "desktop") out.push("pf-hide-desktop");
  if (s._hideTablet || s._hide === "tablet") out.push("pf-hide-tablet");
  if (s._hideMobile || s._hide === "mobile") out.push("pf-hide-mobile");
  return out;
}

export function advancedCss(s: Settings, css: CssBuilder, def: WidgetDef) {
  css.responsive("&", s._margin as Responsive<Spacing> | undefined, (v) => spacingDecls("margin", v));
  if (!def.noAdvancedSpacing) css.responsive("&", s._padding as Responsive<Spacing> | undefined, (v) => spacingDecls("padding", v));
  if (typeof s._zIndex === "number") css.rule("&", { position: "relative", "z-index": s._zIndex });
  if (s._sticky === "top" || s._sticky === "bottom") {
    css.rule("&", {
      position: "sticky",
      [s._sticky]: `${typeof s._stickyOffset === "number" ? s._stickyOffset : 0}px`,
      "z-index": typeof s._zIndex === "number" ? s._zIndex : 40,
    });
  }
}
