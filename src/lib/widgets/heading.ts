import { color, typography } from "./css";
import { linkAttrs, textToHtml } from "./render";
import { defineWidget, type LinkValue, type Responsive, type Typography } from "./types";
import { ALIGN, icon } from "./shared";

const TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div"];

export default defineWidget({
  type: "heading",
  label: "Heading",
  icon: icon('<path d="M6 4v16M18 4v16M6 12h12"/>'),
  category: "Basic",
  defaults: () => ({ text: "Your powerful headline goes here", tag: "h2" }),
  content: [
    {
      label: "Heading",
      controls: [
        { type: "text", key: "text", label: "Text", multiline: true },
        { type: "link", key: "link", label: "Link" },
        { type: "select", key: "tag", label: "HTML tag", options: TAGS.map((t) => ({ value: t, label: t.toUpperCase() })) },
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
      ],
    },
  ],
  render: (s) => {
    const tag = TAGS.includes(s.tag as string) ? (s.tag as string) : "h2";
    const link = s.link as LinkValue | undefined;
    const text = textToHtml(s.text);
    const inner = link?.url ? `<a${linkAttrs(link)}>${text}</a>` : text;
    return `<${tag} class="pf-heading-title">${inner}</${tag}>`;
  },
  css: (s, css) => {
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "text-align": v }));
    css.rule(".pf-heading-title", { color: color(s.color) });
    typography(css, ".pf-heading-title", s.typography as Typography);
  },
});
