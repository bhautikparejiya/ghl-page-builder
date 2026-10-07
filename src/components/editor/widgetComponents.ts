import type { Component, Editor } from "grapesjs";
import { componentType, getWidget, type Settings, WIDGETS, widgetCss, widgetHtml } from "@/lib/widgets";
import { wrapperAttrs } from "@/lib/widgets/render";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Component property holding a widget's settings (the single source of truth for its HTML and CSS). */
export const SETTINGS_PROP = "pfSettings";
export const WIDGET_PROP = "pfWidget";

export const isWidget = (c: Component | null | undefined): boolean => !!c?.get?.(WIDGET_PROP);

export const getSettings = (c: Component): Settings => (c.get(SETTINGS_PROP) as Settings) ?? {};

/** Scope id for generated CSS. Unique per component within an editor session; HTML and CSS are always built together. */
const uidOf = (c: Component) => (c as any).cid as string;

/** Settings embedded in template HTML (data-pf-settings='{"text":"…"}'), merged over defaults. */
function parseSettings(el: HTMLElement, defaults: Settings): Settings {
  try {
    return { ...defaults, ...JSON.parse(el.getAttribute("data-pf-settings") || "{}") };
  } catch {
    return defaults;
  }
}

/** Registers one editor component type per schema widget. */
export default function widgetComponents(editor: Editor) {
  const dc = editor.DomComponents;

  for (const def of WIDGETS) {
    const type = componentType(def.type);

    dc.addType(type, {
      isComponent: (el: HTMLElement) =>
        el?.getAttribute?.("data-pf-widget") === def.type
          ? { type, [SETTINGS_PROP]: parseSettings(el, def.defaults()), components: [] }
          : false,
      model: {
        defaults: {
          name: def.label,
          icon: def.icon.replace(/width="\d+" height="\d+"/, 'width="15" height="15"'),
          [WIDGET_PROP]: def.type,
          droppable: false,
          editable: false,
          stylable: false,
          traits: [],
        },
        init(this: Component) {
          if (!this.get(SETTINGS_PROP)) this.set(SETTINGS_PROP, def.defaults(), { silent: true });
          // Markup is generated from settings, so anything parsed from HTML is dropped.
          this.components().reset();
          this.setAttributes({}, { silent: true } as any);
          this.setClass([]);
        },
        toHTML(this: Component) {
          return widgetHtml(def, getSettings(this), uidOf(this));
        },
      },
      view: {
        init(this: any) {
          this.listenTo(this.model, `change:${SETTINGS_PROP}`, this.renderWidget);
        },
        onRender(this: any) {
          this.renderWidget();
        },
        renderWidget(this: any) {
          const el = this.el as HTMLElement;
          const s = getSettings(this.model);
          const uid = uidOf(this.model);
          // Swap only the attributes we own; the editor adds its own classes (selected, hovered…) to el.
          const prev: { attrs: string[]; classes: string[] } = this._pf || { attrs: [], classes: [] };
          prev.attrs.forEach((a) => el.removeAttribute(a));
          prev.classes.forEach((c) => el.classList.remove(c));
          const { class: cls, ...attrs } = wrapperAttrs(def, s, uid);
          const classes = cls.split(" ").filter(Boolean);
          el.classList.add(...classes);
          Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
          this._pf = { attrs: Object.keys(attrs), classes };
          el.innerHTML = `<style>${widgetCss(def, s, uid)}</style>${def.render(s)}`;
        },
      },
    } as any);
  }
}

/** Block-library entry for a schema widget. */
export function widgetBlock(widgetType: string, category: string) {
  const def = getWidget(widgetType)!;
  return { label: def.label, category, media: def.icon, content: { type: componentType(def.type) } };
}

/** CSS for every schema widget on the page; appended to the editor's own CSS on save/publish. */
export function collectWidgetCss(editor: Editor): string {
  const out: string[] = [];
  editor.getWrapper()?.onAll((c: Component) => {
    const def = getWidget(c.get(WIDGET_PROP));
    if (def) out.push(widgetCss(def, getSettings(c), uidOf(c)));
  });
  return out.join("");
}

/** Popup ids on the page, for "On click, open popup" pickers. */
export function listPopups(editor: Editor): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  editor.getWrapper()?.onAll((c: Component) => {
    const a = c.getAttributes();
    if (a["data-gpb"] === "modal" && a.id) out.push({ value: a.id, label: `#${a.id}` });
  });
  return out;
}
