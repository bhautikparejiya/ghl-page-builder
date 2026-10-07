import { color, px, spacingDecls, typography } from "./css";
import { esc, textToParagraphs } from "./render";
import { icon } from "./shared";
import { defineWidget, type Responsive, type Settings, type Spacing, type Typography } from "./types";

type Item = { title?: string; body?: string };

/** Reuses the existing accordion runtime (data-gpb="accordion" + gpb-acc-* markup). */
export default defineWidget({
  type: "accordion",
  label: "Accordion",
  icon: icon('<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="9" rx="1"/><path d="M15 6.5h3"/>'),
  category: "Widgets",
  defaults: () => ({
    items: [
      { title: "How long does setup take?", body: "Most customers publish their first page in under 15 minutes using our templates." },
      { title: "Do leads go into my CRM?", body: "Yes. Every form submission creates or updates a contact, applies your tags and can start a workflow." },
      { title: "Can I cancel anytime?", body: "Absolutely. There are no contracts. Cancel with one click." },
    ],
    firstOpen: true,
    singleOpen: true,
    icon: "plus",
  }),
  content: [
    {
      label: "Items",
      controls: [
        {
          type: "repeater",
          key: "items",
          label: "Items",
          itemLabel: "title",
          addLabel: "Add item",
          newItem: (): Settings => ({ title: "New question", body: "Write the answer here." }),
          fields: [
            { type: "text", key: "title", label: "Title" },
            { type: "text", key: "body", label: "Content", multiline: true, help: "Leave a blank line to start a new paragraph." },
          ],
        },
      ],
    },
    {
      label: "Behavior",
      controls: [
        { type: "toggle", key: "firstOpen", label: "First item open on load" },
        { type: "toggle", key: "singleOpen", label: "Only one item open at a time" },
        {
          type: "buttons",
          key: "icon",
          label: "Icon",
          options: [
            { value: "plus", label: "Plus" },
            { value: "chevron", label: "Chevron" },
          ],
        },
      ],
    },
  ],
  design: [
    {
      label: "Items",
      controls: [
        { type: "color", key: "itemBg", label: "Background" },
        { type: "color", key: "borderColor", label: "Border color" },
        { type: "number", key: "radius", label: "Corner radius", unit: "px", min: 0, max: 40, slider: true },
        { type: "number", key: "gap", label: "Space between", unit: "px", min: 0, max: 60, slider: true, responsive: true },
      ],
    },
    {
      label: "Title",
      controls: [
        { type: "color", key: "titleColor", label: "Color" },
        { type: "color", key: "iconColor", label: "Icon color" },
        { type: "typography", key: "titleTypography", label: "Typography" },
        { type: "spacing", key: "titlePadding", label: "Padding", responsive: true },
      ],
    },
    {
      label: "Content",
      closed: true,
      controls: [
        { type: "color", key: "bodyColor", label: "Color" },
        { type: "typography", key: "bodyTypography", label: "Typography" },
      ],
    },
  ],
  render: (s) => {
    const items = (Array.isArray(s.items) ? s.items : []) as Item[];
    const body = items
      .map(
        (it, i) =>
          `<div class="gpb-acc-item${i === 0 && s.firstOpen ? " is-open" : ""}"><button class="gpb-acc-head" type="button">${esc(it.title)}</button><div class="gpb-acc-body"><div class="gpb-acc-content">${textToParagraphs(it.body)}</div></div></div>`,
      )
      .join("");
    const iconCls = s.icon === "chevron" ? " pf-acc-icon-chevron" : "";
    return `<div class="gpb-accordion${iconCls}" data-gpb="accordion" data-single="${s.singleOpen ? "true" : "false"}">${body}</div>`;
  },
  css: (s, css) => {
    css.rule(".gpb-acc-item", {
      background: color(s.itemBg),
      "border-color": color(s.borderColor),
      "border-radius": px(s.radius),
    });
    css.responsive(".gpb-acc-item", s.gap as Responsive<number>, (v) => ({ "margin-bottom": px(v) }));
    css.rule(".gpb-acc-head", { color: color(s.titleColor) });
    css.rule(".gpb-acc-head::after", { color: color(s.iconColor) });
    typography(css, ".gpb-acc-head", s.titleTypography as Typography);
    css.responsive(".gpb-acc-head", s.titlePadding as Responsive<Spacing>, (v) => spacingDecls("padding", v));
    css.rule(".gpb-acc-content", { color: color(s.bodyColor) });
    typography(css, ".gpb-acc-content", s.bodyTypography as Typography);
  },
});
