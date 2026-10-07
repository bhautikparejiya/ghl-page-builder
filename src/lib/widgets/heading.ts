import { color, typography } from "./css";
import { linkAttrs, sanitizeRich, textToHtml } from "./render";
import { ALIGN, HEADING_TAGS, icon, str } from "./shared";
import { defineWidget, type LinkValue, type Responsive, type Settings, type Typography } from "./types";

const TAGS = HEADING_TAGS.map((t) => t.value);

/** Heading HTML from settings. Older versions stored plain `text`. */
export const headingHtml = (s: Settings) => (typeof s.html === "string" ? sanitizeRich(s.html, true) : textToHtml(s.text));

export default defineWidget({
  type: "heading",
  label: "Heading",
  icon: icon('<path d="M6 4v16M18 4v16M6 12h12"/>'),
  category: "Basic",
  keywords: "title h1 h2 headline",
  defaults: () => ({ html: "Your powerful headline goes here", tag: "h2" }),
  inline: { selector: ".pf-heading-title", key: "html" },
  content: [
    {
      label: "Heading",
      controls: [
        { type: "richtext", key: "html", label: "Text", inline: true, help: "Tip: double-click the heading on the page to edit it there." },
        { type: "link", key: "link", label: "Link" },
        { type: "select", key: "tag", label: "HTML tag", options: HEADING_TAGS },
        { type: "buttons", key: "align", label: "Alignment", responsive: true, options: ALIGN },
      ],
    },
  ],
  design: [
    {
      label: "Text",
      controls: [
        { type: "color", key: "color", label: "Color" },
        { type: "typography", key: "typography", label: "Typography" },
        { type: "color", key: "highlightFrom", label: "Highlight gradient start", help: "Used by words marked as highlighted." },
        { type: "color", key: "highlightTo", label: "Highlight gradient end" },
      ],
    },
  ],
  render: (s) => {
    const tag = TAGS.includes(str(s.tag)) ? str(s.tag) : "h2";
    const link = s.link as LinkValue | undefined;
    const inner = headingHtml(s);
    return `<${tag} class="pf-heading-title">${link?.url ? `<a${linkAttrs(link)}>${inner}</a>` : inner}</${tag}>`;
  },
  css: (s, css) => {
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "text-align": v }));
    css.rule(".pf-heading-title", { color: color(s.color) });
    typography(css, ".pf-heading-title", s.typography as Typography);
    if (s.highlightFrom || s.highlightTo) {
      css.rule(".gpb-gradient-text", {
        "background-image": `linear-gradient(90deg, ${color(s.highlightFrom) ?? "var(--gpb-primary)"}, ${color(s.highlightTo) ?? "var(--gpb-secondary)"})`,
      });
    }
  },
});
