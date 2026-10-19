import type { Editor } from "grapesjs";
import { SECTIONS, toEditorHtml } from "@/lib/blueprints";
import { componentType, WIDGETS } from "@/lib/widgets";
import { iconSvg } from "@/lib/widgets/render";
import { icon } from "@/lib/widgets/shared";
import { SETTINGS_PROP, widgetBlock } from "./widgetComponents";

/** Library tile icon from the icon set. */
const tile = (name: string) => `<span class="gpb-tile-icon">${iconSvg(name)}</span>`;

/** The widget library: layout presets, every schema widget, and ready-made sections. */
export default function gpbPlugin(editor: Editor) {
  /* ── Widget library ── */
  const bm = editor.BlockManager;
  const L = "Layout";

  const ROW = { direction: { desktop: "row", mobile: "column" }, gap: { desktop: 32, mobile: 20 } };
  const columns = (id: string, label: string, widths: (number | null)[], media: string) =>
    bm.add(id, {
      label,
      category: L,
      media,
      content: {
        type: componentType("container"),
        [SETTINGS_PROP]: ROW,
        components: widths.map((w) => ({
          type: componentType("container"),
          [SETTINGS_PROP]: w ? { width: { desktop: { value: w, unit: "%" }, mobile: { value: 100, unit: "%" } } } : {},
        })),
      } as any,
    });

  bm.add("pf-section", widgetBlock("section", L));
  bm.add("pf-container", widgetBlock("container", L));
  columns("pf-cols-2", "2 Columns", [null, null], icon('<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>'));
  columns(
    "pf-cols-3",
    "3 Columns",
    [null, null, null],
    icon('<rect x="2" y="5" width="6" height="14" rx="1"/><rect x="9" y="5" width="6" height="14" rx="1"/><rect x="16" y="5" width="6" height="14" rx="1"/>'),
  );
  columns(
    "pf-cols-4",
    "4 Columns",
    [null, null, null, null],
    icon('<rect x="2" y="5" width="4" height="14" rx="1"/><rect x="7.3" y="5" width="4" height="14" rx="1"/><rect x="12.6" y="5" width="4" height="14" rx="1"/><rect x="18" y="5" width="4" height="14" rx="1"/>'),
  );
  columns("pf-cols-1-2", "1/3 + 2/3", [32, null], icon('<rect x="3" y="5" width="6" height="14" rx="1"/><rect x="11" y="5" width="10" height="14" rx="1"/>'));
  columns("pf-cols-2-1", "2/3 + 1/3", [null, 32], icon('<rect x="3" y="5" width="10" height="14" rx="1"/><rect x="15" y="5" width="6" height="14" rx="1"/>'));
  bm.add(
    "pf-card",
    widgetBlock("container", L, {
      label: "Card",
      media: icon('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>'),
      settings: {
        background: { type: "color", color: "global:background" },
        border: { style: "solid", width: 1, color: "#e5e7eb" },
        radius: { desktop: 16 },
        shadow: { preset: "sm" },
        padding: { desktop: { top: 28, right: 28, bottom: 28, left: 28 } },
      },
      components: [
        { type: componentType("heading"), [SETTINGS_PROP]: { html: "Card title", tag: "h3" } },
        { type: componentType("text"), [SETTINGS_PROP]: { html: "<p>Use cards to group related content. Drop any widget inside.</p>" } },
      ],
    }),
  );

  // Every other widget, in its own category.
  for (const def of WIDGETS) {
    if (def.type === "section" || def.type === "container") continue;
    bm.add(componentType(def.type), widgetBlock(def.type, def.category === "Layout" ? L : def.category));
  }
  // A ready-made button pair.
  bm.add(
    "pf-buttons",
    widgetBlock("container", "Basic", {
      label: "Button group",
      media: icon('<rect x="2" y="9" width="9" height="6" rx="3"/><rect x="13" y="9" width="9" height="6" rx="3"/>'),
      settings: { direction: { desktop: "row" }, gap: { desktop: 12 }, wrap: true },
      components: [
        { type: componentType("button"), [SETTINGS_PROP]: { text: "Get started", link: { url: "#" }, size: "lg", variant: "solid" } },
        { type: componentType("button"), [SETTINGS_PROP]: { text: "Learn more", link: { url: "#" }, size: "lg", variant: "outline" } },
      ],
    }),
  );

  for (const [id, sec] of Object.entries(SECTIONS)) {
    bm.add(`pf-s-${id}`, { label: sec.label, category: "Sections", media: tile(sec.icon), content: toEditorHtml(sec.nodes) });
  }
}

