import { buttonHtml } from "./button";
import { color, px, typography } from "./css";
import { esc, linkAttrs, safeSrc } from "./render";
import { boxControls, boxCss, icon, list, num, opts } from "./shared";
import { defineWidget, type LinkValue, type Typography } from "./types";

/** Reuses the navbar runtime (mobile toggle) and styles: .gpb-nav[data-gpb=navbar]. */
export const navbar = defineWidget({
  type: "navbar",
  label: "Navbar",
  icon: icon('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M6 6.5h4M14 6.5h1M17 6.5h1"/>'),
  category: "Layout",
  keywords: "header menu navigation logo",
  topLevel: true,
  defaults: () => ({
    brand: "Brand.",
    links: [
      { text: "Features", link: { url: "#features" } },
      { text: "Reviews", link: { url: "#testimonials" } },
      { text: "Pricing", link: { url: "#pricing" } },
      { text: "FAQ", link: { url: "#faq" } },
    ],
    ctaText: "Get started",
    ctaLink: { url: "#signup" },
    sticky: true,
  }),
  content: [
    {
      label: "Brand",
      controls: [
        { type: "image", key: "logo", label: "Logo", help: "Leave empty to use the brand kit logo, or the text below." },
        { type: "text", key: "brand", label: "Brand text" },
        { type: "number", key: "logoHeight", label: "Logo height", unit: "px", min: 16, max: 120 },
        { type: "link", key: "brandLink", label: "Brand link" },
      ],
    },
    {
      label: "Menu",
      controls: [
        {
          type: "repeater",
          key: "links",
          label: "Links",
          itemLabel: "text",
          addLabel: "Add link",
          newItem: () => ({ text: "Link", link: { url: "#" } }),
          fields: [
            { type: "text", key: "text", label: "Text" },
            { type: "link", key: "link", label: "Link" },
          ],
        },
        { type: "buttons", key: "layout", label: "Menu position", options: opts(["", "Right"], ["center", "Center"]) },
      ],
    },
    {
      label: "Button",
      controls: [
        { type: "text", key: "ctaText", label: "Button text", help: "Empty = no button." },
        { type: "link", key: "ctaLink", label: "Button link" },
      ],
    },
    { label: "Behavior", controls: [{ type: "toggle", key: "sticky", label: "Stick to the top when scrolling" }] },
  ],
  design: [
    { label: "Bar", controls: [...boxControls("bar"), { type: "number", key: "contentWidth", label: "Content width", unit: "px", min: 600, max: 1920, step: 10 }] },
    {
      label: "Links",
      controls: [
        { type: "color", key: "linkColor", label: "Color" },
        { type: "color", key: "linkHover", label: "Hover color" },
        { type: "typography", key: "linkTypography", label: "Typography" },
        { type: "color", key: "brandColor", label: "Brand text color" },
      ],
    },
  ],
  render: (s) => {
    const logo = safeSrc(s.logo);
    const brand = logo
      ? `<img class="pf-nav-logo" src="${esc(logo)}" alt="${esc(s.brand)}">`
      : `<span class="pf-nav-logo-kit" data-pf-kit-logo>${esc(s.brand)}</span>`;
    const links = list<{ text?: string; link?: LinkValue }>(s.links)
      .map((l) => `<a${linkAttrs(l.link)}>${esc(l.text)}</a>`)
      .join("");
    const cta = s.ctaText ? buttonHtml({ text: s.ctaText, link: s.ctaLink, size: "sm" }, "gpb-btn") : "";
    return `<nav class="gpb-nav pf-nav${s.layout === "center" ? " pf-nav--center" : ""}" data-gpb="navbar"><div class="pf-nav-inner"><a class="gpb-nav-brand"${linkAttrs((s.brandLink as LinkValue) ?? { url: "#" })}>${brand}</a><button class="gpb-nav-toggle" type="button" aria-label="Menu">☰</button><div class="gpb-nav-links">${links}${cta}</div></div></nav>`;
  },
  css: (s, css) => {
    if (s.sticky) css.rule("&", { position: "sticky", top: 0, "z-index": 60 });
    boxCss(css, ".gpb-nav", s, "bar");
    css.rule(".pf-nav-inner", { "max-width": px(s.contentWidth) });
    css.rule(".pf-nav-logo", { height: px(num(s.logoHeight, 36)) });
    css.rule(".gpb-nav-brand", { color: color(s.brandColor) });
    css.rule(".gpb-nav-links a:not(.pf-btn)", { color: color(s.linkColor) });
    css.rule(".gpb-nav-links a:not(.pf-btn):hover", { color: color(s.linkHover) });
    typography(css, ".gpb-nav-links a:not(.pf-btn)", s.linkTypography as Typography);
    css.rule(".gpb-nav-toggle", { color: color(s.linkColor) });
  },
});
