import type { Component, Editor } from "grapesjs";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const SITE_PART_TYPE = "pf-site-part";

export interface SitePartPreview {
  id: string;
  name: string;
  html: string;
  css: string;
}

export const isSitePart = (c: Component | null | undefined) => c?.get("type") === SITE_PART_TYPE;

/**
 * Read-only preview of the site header/footer around the page being edited. It is never part of the page:
 * toHTML() returns nothing and it is stripped from saved project data (see stripSiteParts).
 */
export default function sitePart(editor: Editor) {
  editor.DomComponents.addType(SITE_PART_TYPE, {
    model: {
      defaults: {
        name: "Site part",
        draggable: false,
        droppable: false,
        removable: false,
        copyable: false,
        editable: false,
        stylable: false,
        highlightable: true,
        traits: [],
        toolbar: [],
      },
      toHTML() {
        return "";
      },
    },
    view: {
      onRender(this: any) {
        const m = this.model as Component;
        const part = m.get("pfPart") as "header" | "footer";
        const doc = m.get("pfDoc") as SitePartPreview;
        this.el.classList.add("pf-site-part", `pf-site-part--${part}`);
        this.el.setAttribute("data-pf-site-part", `${part === "header" ? "Site header" : "Site footer"}: ${doc.name}`);
        this.el.innerHTML = `<style>${doc.css.replace(/<\//g, "")}</style>${doc.html}`;
      },
    },
  } as any);
}

/** Adds the header/footer previews to the canvas (outside undo history). */
export function showSiteParts(editor: Editor, parts: { header: SitePartPreview | null; footer: SitePartPreview | null }) {
  const wrapper = editor.getWrapper();
  if (!wrapper) return;
  wrapper.components().filter((c: Component) => isSitePart(c)).forEach((c: Component) => c.remove({ avoidStore: true } as any));
  const opts = { avoidStore: true } as any;
  if (parts.header) wrapper.components().add({ type: SITE_PART_TYPE, name: `Site header: ${parts.header.name}`, pfPart: "header", pfPartId: parts.header.id, pfDoc: parts.header }, { ...opts, at: 0 });
  if (parts.footer) wrapper.components().add({ type: SITE_PART_TYPE, name: `Site footer: ${parts.footer.name}`, pfPart: "footer", pfPartId: parts.footer.id, pfDoc: parts.footer }, opts);
}

/** Removes site-part previews from project data before it is saved. */
export function stripSiteParts<T>(projectData: T): T {
  const walk = (node: any): any => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.filter((n) => !(n && n.type === SITE_PART_TYPE)).map(walk);
    const out: any = {};
    for (const [k, v] of Object.entries(node)) out[k] = k === "components" || k === "pages" || k === "frames" || k === "component" ? walk(v) : v;
    return out;
  };
  return walk(projectData);
}

/** Index just before the footer preview, so "add at the end" lands above the site footer. */
export function endIndex(editor: Editor): number | undefined {
  const comps = editor.getWrapper()?.components();
  if (!comps) return undefined;
  const last = comps.at(comps.length - 1);
  return last && isSitePart(last) && last.get("pfPart") === "footer" ? comps.length - 1 : undefined;
}
