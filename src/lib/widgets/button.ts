import { color, px, shadowValue, spacingDecls, typography } from "./css";
import { esc, iconSvg, linkAttrs } from "./render";
import { ALIGN, icon, opts } from "./shared";
import { type CssBuilder, defineWidget, type LinkValue, type Responsive, type Settings, type Shadow, type Spacing, type Typography } from "./types";

const ALIGN_STRETCH = [...ALIGN.slice(0, 3), { ...ALIGN[3], value: "stretch", label: "Full width" }];

/** Shared by the Button widget and other widgets that render a call-to-action. */
export function buttonHtml(s: Settings, extraClass = "") {
  const cls = [
    "pf-btn",
    s.size === "sm" && "pf-btn--sm",
    s.size === "lg" && "pf-btn--lg",
    s.variant === "outline" && "pf-btn--outline",
    s.variant === "ghost" && "pf-btn--ghost",
    extraClass,
  ]
    .filter(Boolean)
    .join(" ");
  const ico = s.icon ? iconSvg(s.icon) : "";
  const text = `<span class="pf-btn-text">${esc(s.text)}</span>`;
  return `<a class="${cls}"${linkAttrs(s.link as LinkValue)}>${s.iconPosition === "after" ? text + ico : ico + text}</a>`;
}

export default defineWidget({
  type: "button",
  label: "Button",
  icon: icon('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/>'),
  category: "Basic",
  keywords: "cta link call to action",
  defaults: () => ({ text: "Click here", link: { url: "#" }, size: "md", variant: "solid" }),
  inline: { selector: ".pf-btn-text", key: "text", plain: true },
  content: [
    {
      label: "Button",
      controls: [
        { type: "text", key: "text", label: "Text" },
        { type: "link", key: "link", label: "Link", help: "Use #section-id to scroll to a section on this page." },
        { type: "buttons", key: "size", label: "Size", options: opts(["sm", "S"], ["md", "M"], ["lg", "L"]) },
        { type: "buttons", key: "align", label: "Alignment", responsive: true, options: ALIGN_STRETCH },
        { type: "icon", key: "icon", label: "Icon", allowNone: true },
        { type: "buttons", key: "iconPosition", label: "Icon position", options: opts(["before", "Before"], ["after", "After"]), when: (s) => !!s.icon },
      ],
    },
  ],
  design: [
    {
      label: "Style",
      controls: [
        { type: "buttons", key: "variant", label: "Style", options: opts(["solid", "Filled"], ["outline", "Outline"], ["ghost", "Text"]) },
        { type: "typography", key: "typography", label: "Typography" },
      ],
    },
    {
      label: "Colors",
      controls: [
        { type: "color", key: "textColor", label: "Text" },
        { type: "color", key: "bgColor", label: "Background", when: (s) => s.variant !== "outline" && s.variant !== "ghost" },
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
        { type: "shadow", key: "shadow", label: "Shadow" },
      ],
    },
  ],
  render: (s) => buttonHtml(s),
  css: (s, css) => buttonCss(s, css, "&", ".pf-btn"),
});

export function buttonCss(s: Settings, css: CssBuilder, wrap: string, btn: string) {
  css.responsive(wrap, s.align as Responsive<string>, (v) => (v === "stretch" ? { "text-align": "left" } : { "text-align": v }));
  css.responsive(btn, s.align as Responsive<string>, (v) =>
    v === "stretch" ? { display: "flex", width: "100%" } : { display: "inline-flex", width: "auto" },
  );
  css.rule(btn, {
    color: color(s.textColor),
    background: s.variant === "outline" || s.variant === "ghost" ? undefined : color(s.bgColor),
    "border-color": color(s.borderColor),
    "border-width": px(s.borderWidth),
    "border-radius": px(s.radius),
  });
  css.rule(`${btn}:hover`, {
    color: color(s.hoverTextColor),
    background: color(s.hoverBgColor),
    "border-color": color(s.hoverBorderColor),
  });
  typography(css, btn, s.typography as Typography);
  css.responsive(btn, s.padding as Responsive<Spacing>, (v) => spacingDecls("padding", v));
  css.rule(btn, { "box-shadow": shadowValue(s.shadow as Shadow) });
}
