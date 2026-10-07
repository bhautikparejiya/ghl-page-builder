import type { Component, Editor } from "grapesjs";
import { componentType, getWidget, type Settings, WIDGETS, widgetCss, widgetHtml, type WidgetDef } from "@/lib/widgets";
import { collectFonts } from "@/lib/widgets/css";
import { newUid, wrapperAttrs } from "@/lib/widgets/render";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Component property holding a widget's settings (the single source of truth for its HTML and CSS). */
export const SETTINGS_PROP = "pfSettings";
export const WIDGET_PROP = "pfWidget";
/** Persistent per-instance id; scopes the widget's generated CSS (pf-w-<id>). */
export const UID_PROP = "pfId";

export const isWidget = (c: Component | null | undefined): boolean => !!c?.get?.(WIDGET_PROP);
export const widgetOf = (c: Component | null | undefined): WidgetDef | undefined => (c ? getWidget(c.get?.(WIDGET_PROP)) : undefined);
export const getSettings = (c: Component): Settings => (c.get(SETTINGS_PROP) as Settings) ?? {};
export const uidOf = (c: Component): string => {
  let uid = c.get(UID_PROP) as string | undefined;
  if (!uid) {
    uid = newUid();
    c.set(UID_PROP, uid, { silent: true });
  }
  return uid;
};

/** Settings embedded in template HTML (data-pf-settings='{"text":"…"}'), merged over defaults. */
function parseSettings(el: HTMLElement, defaults: Settings): Settings {
  try {
    return { ...defaults, ...JSON.parse(el.getAttribute("data-pf-settings") || "{}") };
  } catch {
    return defaults;
  }
}

/* ── Generated CSS in the canvas: one <style> per widget instance in the frame's <head> ── */

function canvasStyle(editor: Editor, uid: string, css: string) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.head) return;
  let el = doc.head.querySelector<HTMLStyleElement>(`style[data-pf-uid="${uid}"]`);
  if (!el) {
    el = doc.createElement("style");
    el.setAttribute("data-pf-uid", uid);
    doc.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

/** Removes <style> elements of widgets that are no longer on the page. */
function collectCanvasStyles(editor: Editor) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.head) return;
  const live = new Set<string>();
  editor.getWrapper()?.onAll((c: Component) => {
    if (isWidget(c)) live.add(uidOf(c));
  });
  doc.head.querySelectorAll<HTMLStyleElement>("style[data-pf-uid]").forEach((s) => {
    if (!live.has(s.getAttribute("data-pf-uid")!)) s.remove();
  });
}

export interface WidgetComponentsOptions {
  /** Called when on-canvas text editing starts/stops (for the floating text toolbar). */
  onInlineEdit?: (state: { component: Component; el: HTMLElement } | null) => void;
}

/** Registers one editor component type per schema widget, plus page-structure rules. */
export default function widgetComponents(editor: Editor, opts: WidgetComponentsOptions = {}) {
  const dc = editor.DomComponents;
  let ready = false;

  /** Applies a widget's attributes, classes and CSS to its canvas element. */
  function applyWrapper(view: any, def: WidgetDef, s: Settings, uid: string) {
    const el = view.el as HTMLElement;
    // Swap only what we own; the editor adds its own classes (selected, hovered…) to el.
    const prev: { attrs: string[]; classes: string[] } = view._pf || { attrs: [], classes: [] };
    prev.attrs.forEach((a) => el.removeAttribute(a));
    prev.classes.forEach((c) => el.classList.remove(c));
    const { class: cls, ...attrs } = wrapperAttrs(def, s, uid);
    // Display conditions would hide the element while editing.
    delete attrs["data-pf-cond"];
    const classes = cls.split(" ").filter(Boolean);
    el.classList.add(...classes);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    view._pf = { attrs: Object.keys(attrs), classes };
    canvasStyle(editor, uid, widgetCss(def, s, uid));
  }

  for (const def of WIDGETS) {
    const type = componentType(def.type);
    const isContainer = !!def.container;

    dc.addType(type, {
      isComponent: (el: HTMLElement) => {
        if (el?.getAttribute?.("data-pf-widget") !== def.type) return false;
        // Leaf widgets are generated from settings: their markup is never parsed into child components.
        return { type, [SETTINGS_PROP]: parseSettings(el, def.defaults()), ...(isContainer ? {} : { components: [] }) };
      },
      model: {
        defaults: {
          name: def.label,
          icon: def.icon.replace(/width="\d+" height="\d+"/, 'width="15" height="15"'),
          [WIDGET_PROP]: def.type,
          droppable: isContainer ? (src: Component) => !(def.container!.rejects ?? []).includes(String(src.get("type"))) : false,
          draggable: def.container?.parents ? (_src: Component, target: Component) => def.container!.parents!.includes(String(target.get("type"))) : true,
          editable: false,
          stylable: false,
          traits: [],
        },
        init(this: Component) {
          if (!this.get(SETTINGS_PROP)) this.set(SETTINGS_PROP, def.defaults(), { silent: true });
          uidOf(this);
          if (!isContainer) this.components().reset();
          // Markup comes from settings; attributes/classes parsed from HTML are not used.
          this.setAttributes({}, { silent: true } as any);
          this.setClass([]);
        },
        toHTML(this: Component) {
          const s = (this.get(SETTINGS_PROP) as Settings) ?? {};
          return widgetHtml(def, s, uidOf(this), isContainer ? this.getInnerHTML() : undefined);
        },
      },
      view: {
        events: isContainer ? {} : { dblclick: "startInlineEdit" },
        init(this: any) {
          this.listenTo(this.model, `change:${SETTINGS_PROP}`, this.renderWidget);
        },
        getChildrenContainer(this: any) {
          const inner = def.container?.inner;
          if (!inner) return this.el;
          if (!this._pfInner || !this.el.contains(this._pfInner)) {
            this.el.innerHTML = inner.open + inner.close;
            this._pfInner = this.el.querySelector("[data-pf-children]");
          }
          return this._pfInner;
        },
        onRender(this: any) {
          this.renderWidget();
        },
        renderWidget(this: any) {
          const s = getSettings(this.model);
          const uid = uidOf(this.model);
          applyWrapper(this, def, s, uid);
          if (!isContainer && !this._editing) this.el.innerHTML = def.render(s, { uid });
        },

        /* ── On-canvas text editing ── */
        startInlineEdit(this: any, ev: MouseEvent) {
          if (!def.inline || this._editing) return;
          const target = this.el.querySelector(def.inline.selector) as HTMLElement | null;
          if (!target) return;
          ev.stopPropagation();
          this._editing = true;
          this.el.setAttribute("draggable", "false");
          target.contentEditable = def.inline.plain ? "plaintext-only" : "true";
          target.classList.add("pf-inline-editing");
          target.focus();
          // Put the caret where the user double-clicked.
          const doc = target.ownerDocument as Document;
          const range = (doc as any).caretRangeFromPoint?.(ev.clientX, ev.clientY) as Range | null | undefined;
          if (range) {
            const sel = doc.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
          const stop = (commit: boolean) => {
            target.removeEventListener("blur", onBlur);
            target.removeEventListener("keydown", onKey);
            target.contentEditable = "false";
            target.classList.remove("pf-inline-editing");
            this.el.setAttribute("draggable", "true");
            this._editing = false;
            opts.onInlineEdit?.(null);
            const s = getSettings(this.model);
            const value = def.inline!.plain ? (target.textContent ?? "").trim() : target.innerHTML;
            if (commit && value !== s[def.inline!.key]) this.model.set(SETTINGS_PROP, { ...s, [def.inline!.key]: value });
            else this.renderWidget();
          };
          const onBlur = () => {
            // Using the floating toolbar moves focus to the editor window; keep editing then.
            setTimeout(() => {
              if (document.activeElement?.closest?.("[data-pf-inline-toolbar]")) {
                target.focus();
                return;
              }
              if (this._editing) stop(true);
            }, 0);
          };
          const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
              e.preventDefault();
              stop(false);
            } else if (e.key === "Enter" && def.inline!.plain) {
              e.preventDefault();
              target.blur();
            }
          };
          target.addEventListener("blur", onBlur);
          target.addEventListener("keydown", onKey);
          opts.onInlineEdit?.({ component: this.model, el: target });
        },
      },
    } as any);
  }

  /* ── New ids for copies (duplicate, copy/paste) so their CSS doesn't collide ── */
  editor.on("component:clone", (cloned: Component) => {
    if (!isWidget(cloned)) return;
    cloned.set(UID_PROP, newUid(), { silent: true });
    if (cloned.get(WIDGET_PROP) === "popup") {
      const s = getSettings(cloned);
      const base = String(s.popupId || "popup").replace(/-copy\w*$/, "");
      cloned.set(SETTINGS_PROP, { ...s, popupId: `${base}-copy${newUid().slice(0, 3)}` }, { silent: true });
    }
  });

  /* ── Page structure: widgets dropped on the bare page get a section around them ── */
  editor.on("component:add", (c: Component) => {
    if (!ready) return;
    const def = widgetOf(c);
    const parent = c.parent();
    if (!def || !parent || parent.get("type") !== "wrapper" || def.type === "section" || def.topLevel) return;
    setTimeout(() => {
      if (c.parent() !== parent) return;
      const at = c.index();
      const [sec] = parent.components().add([{ type: componentType("section") }], { at }) as unknown as Component[];
      c.remove({ temporary: true } as any);
      sec.append(c);
      editor.select(c);
    }, 0);
  });

  let gcTimer: ReturnType<typeof setTimeout> | null = null;
  editor.on("component:remove", () => {
    if (gcTimer) clearTimeout(gcTimer);
    gcTimer = setTimeout(() => collectCanvasStyles(editor), 500);
  });

  editor.on("load", () => {
    ready = true;
    // Views rendered before the frame existed couldn't write their <style> yet.
    editor.getWrapper()?.onAll((c: Component) => {
      const def = widgetOf(c);
      if (def) canvasStyle(editor, uidOf(c), widgetCss(def, getSettings(c), uidOf(c)));
    });
  });
}

/** Block-library entry for a schema widget. */
export function widgetBlock(
  widgetType: string,
  category: string,
  overrides: { label?: string; settings?: Settings; components?: any[]; media?: string } = {},
) {
  const def = getWidget(widgetType)!;
  return {
    label: overrides.label ?? def.label,
    category,
    media: overrides.media ?? def.icon,
    content: {
      type: componentType(def.type),
      ...(overrides.settings ? { [SETTINGS_PROP]: { ...def.defaults(), ...overrides.settings } } : {}),
      ...(overrides.components ? { components: overrides.components } : {}),
    },
  };
}

/** CSS and Google fonts for every schema widget in `root` (default: whole page), root included. */
export function collectWidgetCss(editor: Editor, root?: Component): { css: string; fonts: string[] } {
  const out: string[] = [];
  const fonts = new Set<string>();
  const visit = (c: Component) => {
    const def = widgetOf(c);
    if (!def) return;
    const s = getSettings(c);
    out.push(widgetCss(def, s, uidOf(c)));
    collectFonts(s, fonts);
  };
  if (root) visit(root);
  (root ?? editor.getWrapper())?.onAll((c: Component) => {
    if (c !== root) visit(c);
  });
  return { css: out.join(""), fonts: [...fonts] };
}

/** Popup ids on the page, for "On click, open popup" pickers. */
export function listPopups(editor: Editor): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  editor.getWrapper()?.onAll((c: Component) => {
    if (c.get(WIDGET_PROP) === "popup") {
      const id = String(getSettings(c).popupId || "");
      if (id) out.push({ value: id, label: `#${id}` });
    } else {
      const a = c.getAttributes();
      if (a["data-gpb"] === "modal" && a.id) out.push({ value: a.id, label: `#${a.id}` });
    }
  });
  return out;
}

/** Settings of every widget of a type on the page (e.g. accordions with FAQ markup, forms). */
export function findWidgets(editor: Editor, type: string): { component: Component; settings: Settings }[] {
  const out: { component: Component; settings: Settings }[] = [];
  editor.getWrapper()?.onAll((c: Component) => {
    if (c.get(WIDGET_PROP) === type) out.push({ component: c, settings: getSettings(c) });
  });
  return out;
}
