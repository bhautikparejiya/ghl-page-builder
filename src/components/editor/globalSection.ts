import type { Component, Editor } from "grapesjs";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GLOBAL_TYPE = "pf-global";

export interface GlobalDoc {
  name: string;
  html: string;
  css: string;
}

/** Content of global sections known to this editor session (filled from the library). */
const docs = new Map<string, GlobalDoc>();
const listeners = new Set<() => void>();

export function setGlobalDocs(items: { id: string; name: string; doc?: { html: string; css: string } }[]) {
  for (const it of items) if (it.doc) docs.set(it.id, { name: it.name, html: it.doc.html, css: it.doc.css });
  listeners.forEach((fn) => fn());
}

/**
 * A reference to a global section. On the canvas it shows the section's current content (read-only);
 * when published it becomes a placeholder that live pages fill with the latest version.
 */
export default function globalSection(editor: Editor) {
  editor.DomComponents.addType(GLOBAL_TYPE, {
    isComponent: (el: HTMLElement) => (el?.getAttribute?.("data-pf-global") ? { type: GLOBAL_TYPE, pfGlobalId: el.getAttribute("data-pf-global"), components: [] } : false),
    model: {
      defaults: {
        name: "Global section",
        droppable: false,
        editable: false,
        stylable: false,
        traits: [],
        draggable: (_src: Component, target: Component) => target.get("type") === "wrapper",
      },
      init(this: Component) {
        this.components().reset();
        const doc = docs.get(this.get("pfGlobalId"));
        if (doc) this.set("name", `Global: ${doc.name}`, { silent: true });
      },
      toHTML(this: Component) {
        return `<div data-pf-global="${String(this.get("pfGlobalId")).replace(/[^\w-]/g, "")}"></div>`;
      },
    },
    view: {
      init(this: any) {
        this._refresh = () => this.renderGlobal();
        listeners.add(this._refresh);
      },
      removed(this: any) {
        listeners.delete(this._refresh);
      },
      onRender(this: any) {
        this.renderGlobal();
      },
      renderGlobal(this: any) {
        const id = String(this.model.get("pfGlobalId"));
        const doc = docs.get(id);
        this.el.classList.add("pf-global-ref");
        this.el.setAttribute("data-pf-global-name", doc?.name ?? "not found");
        this.el.innerHTML = doc ? doc.html : `<div class="pf-embed-empty">This global section was deleted or isn't shared with this account.</div>`;
        const head = editor.Canvas.getDocument()?.head;
        if (head && doc) {
          let style = head.querySelector<HTMLStyleElement>(`style[data-pf-global="${id}"]`);
          if (!style) {
            style = head.ownerDocument.createElement("style");
            style.setAttribute("data-pf-global", id);
            head.appendChild(style);
          }
          style.textContent = doc.css;
        }
      },
    },
  } as any);
}

/** Global reference id of a component, if it is one. */
export const globalIdOf = (c: Component | null | undefined) => (c?.get("type") === GLOBAL_TYPE ? String(c.get("pfGlobalId")) : null);
