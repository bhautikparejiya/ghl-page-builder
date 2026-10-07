import { color, px, spacingDecls, typography } from "./css";
import { esc, linkAttrs } from "./render";
import { ALIGN, icon } from "./shared";
import { defineWidget, type LinkValue, type Responsive, type Spacing, type Typography } from "./types";

const ALIGN_STRETCH = [...ALIGN.slice(0, 3), { ...ALIGN[3], value: "stretch", label: "Full width" }];

export default defineWidget({
  type: "button",
  label: "Button",
  icon: icon('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/>'),
  category: "Basic",
  defaults: () => ({ text: "Click here", link: { url: "#" }, size: "md", variant: "solid" }),
  content: [
    {
      label: "Button",
      controls: [
        { type: "text", key: "text", label: "Text" },
        { type: "link", key: "link", label: "Link", help: "Use #section-id to scroll to a section on this page." },
        {
          type: "buttons",
          key: "size",
          label: "Size",
          options: [
            { value: "sm", label: "S" },
            { value: "md", label: "M" },
            { value: "lg", label: "L" },
          ],
        },
        { type: "buttons", key: "align", label: "Alignment", responsive: true, options: ALIGN_STRETCH },
      ],
    },
  ],
  design: [
    {
      label: "Style",
      controls: [
        {
          type: "buttons",
          key: "variant",
          label: "Style",
          options: [
            { value: "solid", label: "Filled" },
            { value: "outline", label: "Outline" },
          ],
        },
        { type: "typography", key: "typography", label: "Typography" },
      ],
    },
    {
      label: "Colors",
      controls: [
        { type: "color", key: "textColor", label: "Text" },
        { type: "color", key: "bgColor", label: "Background", when: (s) => s.variant !== "outline" },
        { type: "color", key: "borderColor", label: "Border" },
        { type: "color", key: "hoverTextColor", label: "Text on hover" },
        { type: "color", key: "hoverBgColor", label: "Background on hover" },
        { type: "color", key: "hoverBorderColor", label: "Border on hover" },
      ],
    },
    {
      label: "Shape",
      closed: true,
      controls: [
        { type: "number", key: "radius", label: "Corner radius", unit: "px", min: 0, max: 60, slider: true },
        { type: "number", key: "borderWidth", label: "Border width", unit: "px", min: 0, max: 10, slider: true },
        { type: "spacing", key: "padding", label: "Padding", responsive: true },
      ],
    },
  ],
  render: (s) => {
    const cls = ["pf-btn", s.size === "sm" && "pf-btn--sm", s.size === "lg" && "pf-btn--lg", s.variant === "outline" && "pf-btn--outline"]
      .filter(Boolean)
      .join(" ");
    return `<a class="${cls}"${linkAttrs(s.link as LinkValue)}>${esc(s.text)}</a>`;
  },
  css: (s, css) => {
    css.responsive("&", s.align as Responsive<string>, (v) =>
      v === "stretch" ? { "text-align": "left" } : { "text-align": v },
    );
    css.responsive(".pf-btn", s.align as Responsive<string>, (v) =>
      v === "stretch" ? { display: "flex", width: "100%" } : { display: "inline-flex", width: "auto" },
    );
    css.rule(".pf-btn", {
      color: color(s.textColor),
      background: s.variant === "outline" ? undefined : color(s.bgColor),
      "border-color": color(s.borderColor),
      "border-width": px(s.borderWidth),
      "border-radius": px(s.radius),
    });
    css.rule(".pf-btn:hover", {
      color: color(s.hoverTextColor),
      background: color(s.hoverBgColor),
      "border-color": color(s.hoverBorderColor),
    });
    typography(css, ".pf-btn", s.typography as Typography);
    css.responsive(".pf-btn", s.padding as Responsive<Spacing>, (v) => spacingDecls("padding", v));
  },
});
