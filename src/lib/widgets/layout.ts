import { color, length, px, spacingDecls } from "./css";
import { ALIGN3, boxControls, boxCss, FLEX_ALIGN, icon, num, opts, str } from "./shared";
import { defineWidget, type Length, type Responsive, type Spacing } from "./types";

const ROW = icon('<rect x="3" y="6" width="7" height="12" rx="1.5"/><rect x="14" y="6" width="7" height="12" rx="1.5"/>', 16);
const COL = icon('<rect x="6" y="3" width="12" height="7" rx="1.5"/><rect x="6" y="14" width="12" height="7" rx="1.5"/>', 16);

const JUSTIFY = opts(["flex-start", "Start"], ["center", "Center"], ["flex-end", "End"], ["space-between", "Space between"], ["space-around", "Space around"]);
const ALIGN_ITEMS = opts(["stretch", "Stretch"], ["flex-start", "Start"], ["center", "Center"], ["flex-end", "End"]);

export const section = defineWidget({
  type: "section",
  label: "Section",
  icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/>'),
  category: "Layout",
  keywords: "row band block wrapper",
  noAdvancedSpacing: true,
  defaults: () => ({}),
  container: {
    tag: (s) => str(s.tag, "section"),
    rejects: ["pf-section"],
    parents: ["wrapper"],
  },
  content: [
    {
      label: "Layout",
      controls: [
        { type: "number", key: "contentWidth", label: "Content width", unit: "px", min: 320, max: 1920, step: 10, help: "Children are centered up to this width. Default 1140px." },
        { type: "toggle", key: "fullWidth", label: "Stretch content to full width" },
        { type: "length", key: "minHeight", label: "Min height", responsive: true, units: ["px", "vh"] },
        {
          type: "buttons",
          key: "vAlign",
          label: "Vertical align",
          options: opts(["flex-start", "Top"], ["center", "Middle"], ["flex-end", "Bottom"]),
          when: (s) => !!s.minHeight,
        },
        { type: "number", key: "gap", label: "Space between items", unit: "px", min: 0, max: 200, responsive: true },
        { type: "select", key: "tag", label: "HTML tag", options: opts(["section", "section"], ["header", "header"], ["footer", "footer"], ["div", "div"]) },
      ],
    },
  ],
  design: [
    {
      label: "Background",
      controls: [
        { type: "background", key: "background", label: "Background" },
        { type: "color", key: "textColor", label: "Text color" },
      ],
    },
    {
      label: "Spacing",
      controls: [{ type: "spacing", key: "padding", label: "Padding", responsive: true, help: "Default: 80px top/bottom (56px on mobile)." }],
    },
    { label: "Border & shadow", closed: true, controls: boxControls("box", { padding: false, background: false }) },
  ],
  render: () => "",
  css: (s, css) => {
    if (s.fullWidth) css.rule("&", { "--pf-content": "100%" });
    else if (typeof s.contentWidth === "number") css.rule("&", { "--pf-content": px(s.contentWidth) });
    css.responsive("&", s.minHeight as Responsive<Length>, (v) => ({ "min-height": length(v) }));
    css.rule("&", { "justify-content": s.minHeight ? str(s.vAlign) || undefined : undefined, color: color(s.textColor) });
    css.responsive("&", s.gap as Responsive<number>, (v) => ({ gap: px(v) }));
    css.responsive("&", s.padding as Responsive<Spacing>, (v) => spacingDecls("padding", v));
    boxCss(css, "&", { background: s.background }, "");
    boxCss(css, "&", s, "box");
  },
});

export const container = defineWidget({
  type: "container",
  label: "Container",
  icon: icon('<rect x="3" y="4" width="18" height="16" rx="2" stroke-dasharray="3 2"/><rect x="7" y="8" width="10" height="8" rx="1"/>'),
  category: "Layout",
  keywords: "column columns row flex grid box group div",
  noAdvancedSpacing: true,
  defaults: () => ({}),
  container: {
    tag: (s) => str(s.tag, "div"),
    rejects: ["pf-section"],
  },
  content: [
    {
      label: "Layout",
      controls: [
        { type: "buttons", key: "layout", label: "Layout", options: opts(["flex", "Flex"], ["grid", "Grid"]) },
        {
          type: "buttons",
          key: "direction",
          label: "Direction",
          responsive: true,
          options: [
            { value: "column", label: "Stacked", icon: COL },
            { value: "row", label: "Side by side", icon: ROW },
          ],
          when: (s) => s.layout !== "grid",
        },
        { type: "number", key: "columns", label: "Columns", min: 1, max: 12, responsive: true, when: (s) => s.layout === "grid" },
        { type: "select", key: "justify", label: "Justify", options: JUSTIFY, responsive: true, placeholder: "Start" },
        { type: "select", key: "align", label: "Align items", options: ALIGN_ITEMS, responsive: true, placeholder: "Stretch" },
        { type: "number", key: "gap", label: "Gap", unit: "px", min: 0, max: 200, responsive: true },
        { type: "toggle", key: "wrap", label: "Wrap onto new lines", when: (s) => s.layout !== "grid" },
      ],
    },
    {
      label: "Size",
      controls: [
        { type: "length", key: "width", label: "Width", responsive: true, units: ["%", "px"], help: "Empty = share the row equally." },
        { type: "length", key: "minHeight", label: "Min height", responsive: true, units: ["px", "vh"] },
        { type: "select", key: "tag", label: "HTML tag", options: opts(["div", "div"], ["article", "article"], ["aside", "aside"], ["nav", "nav"], ["header", "header"], ["footer", "footer"]) },
      ],
    },
  ],
  design: [
    { label: "Box", controls: boxControls() },
    { label: "Text", controls: [{ type: "color", key: "textColor", label: "Text color" }] },
  ],
  render: () => "",
  css: (s, css) => {
    if (s.layout === "grid") {
      css.rule("&", { display: "grid" });
      css.responsive("&", (s.columns as Responsive<number>) ?? { desktop: 2 }, (v) => ({ "grid-template-columns": `repeat(${Math.max(1, Math.min(12, v))}, minmax(0, 1fr))` }));
    } else {
      css.responsive("&", s.direction as Responsive<string>, (v) => ({ "flex-direction": v === "row" ? "row" : "column" }));
      if (s.wrap) css.rule("&", { "flex-wrap": "wrap" });
    }
    css.responsive("&", s.justify as Responsive<string>, (v) => ({ "justify-content": v }));
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "align-items": v }));
    css.responsive("&", s.gap as Responsive<number>, (v) => ({ gap: px(v) }));
    css.responsive("&", s.width as Responsive<Length>, (v) => {
      const w = length(v, "%");
      return w ? { width: w, flex: "0 1 auto", "max-width": "100%" } : { width: "auto", flex: "1 1 0" };
    });
    css.responsive("&", s.minHeight as Responsive<Length>, (v) => ({ "min-height": length(v) }));
    css.rule("&", { color: color(s.textColor) });
    boxCss(css, "&", s);
  },
});

export const spacer = defineWidget({
  type: "spacer",
  label: "Spacer",
  icon: icon('<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>'),
  category: "Basic",
  keywords: "gap space empty",
  defaults: () => ({ height: { desktop: 48 } }),
  content: [{ label: "Spacer", controls: [{ type: "number", key: "height", label: "Height", unit: "px", min: 0, max: 400, slider: true, responsive: true }] }],
  design: [],
  render: () => "",
  css: (s, css) => css.responsive("&", s.height as Responsive<number>, (v) => ({ height: px(v) })),
});

export const divider = defineWidget({
  type: "divider",
  label: "Divider",
  icon: icon('<path d="M3 12h18"/>'),
  category: "Basic",
  keywords: "line separator hr rule",
  defaults: () => ({ style: "solid" }),
  content: [
    {
      label: "Divider",
      controls: [
        { type: "buttons", key: "style", label: "Style", options: opts(["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"], ["double", "Double"]) },
        { type: "length", key: "width", label: "Width", units: ["%", "px"], responsive: true },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Line",
      controls: [
        { type: "color", key: "color", label: "Color" },
        { type: "number", key: "weight", label: "Thickness", unit: "px", min: 1, max: 20, slider: true },
        { type: "number", key: "gap", label: "Space above and below", unit: "px", min: 0, max: 120, responsive: true },
      ],
    },
  ],
  render: () => `<hr class="pf-divider-line">`,
  css: (s, css) => {
    const weight = num(s.weight, 1);
    css.rule(".pf-divider-line", {
      "border-top": `${s.style === "double" ? Math.max(3, weight) : weight}px ${str(s.style, "solid")} ${color(s.color) ?? "var(--gpb-border)"}`,
    });
    css.responsive(".pf-divider-line", s.width as Responsive<Length>, (v) => ({ width: length(v, "%") }));
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "align-items": FLEX_ALIGN[v] }));
    css.responsive("&", s.gap as Responsive<number>, (v) => ({ "padding-top": px(v), "padding-bottom": px(v) }));
  },
});
