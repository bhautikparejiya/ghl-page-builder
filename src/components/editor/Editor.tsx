"use client";

import grapesjs, { type Component, type Editor as GEditor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import customCodePlugin from "grapesjs-custom-code";
import formsPlugin from "grapesjs-plugin-forms";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SECTIONS, toEditorHtml } from "@/lib/blueprints";
import { type BrandKit, DEFAULT_KIT, effectiveKit, kitCss } from "@/lib/brandkit";
import type { FormConfig, PageDoc, PageSettings } from "@/lib/pages";
import { DEFAULT_THEME, FONTS, fontUrlFor, type Theme } from "@/lib/theme";
import { componentType, type Option, type Settings, WIDGETS } from "@/lib/widgets";
import { accordionAnswer } from "@/lib/widgets/accordion";
import { CONTACT_FIELDS, formConfig } from "@/lib/widgets/forms";
import type { Device } from "@/lib/widgets/types";
import { useSession } from "../session";
import { EmbedInstructions, Modal } from "../ui";
import { copyStyle, duplicate, firstAdded, insertSection, insertWidget, pasteStyle, serialize, snapshot, stripIds, topLevelOf } from "./actions";
import globalSection, { GLOBAL_TYPE, setGlobalDocs } from "./globalSection";
import gpbPlugin from "./gpbPlugin";
import type { ControlCtx } from "./panel/controls";
import WidgetPanel from "./panel/WidgetPanel";
import { AddSectionButton, type LibraryListItem, SectionPicker } from "./ui/AddSection";
import BrandKitModal, { type KitInfo } from "./ui/BrandKitModal";
import CommandPalette, { type PaletteCommand, SHORTCUTS } from "./ui/CommandPalette";
import ContextMenu, { type ContextMenuState } from "./ui/ContextMenu";
import InlineToolbar from "./ui/InlineToolbar";
import { LibraryPanel, type SaveOptions, SaveToLibraryModal } from "./ui/Library";
import PageSettingsModal, { AbStats } from "./ui/PageSettings";
import widgetComponents, { collectWidgetCss, findWidgets, getSettings, isWidget, listPopups, uidOf, widgetOf } from "./widgetComponents";

/* eslint-disable @typescript-eslint/no-explicit-any */

type SaveState = "saved" | "saving" | "dirty" | "error";
type Modals = null | "kit" | "theme" | "settings" | "embed" | "history" | "shortcuts" | "palette";
type Kind = "section" | "container" | "widget";

export type EditorMode = { kind: "page"; id: string } | { kind: "library"; id: string };

interface HighLevelData {
  workflows: Option[];
  calendars: Option[];
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  customFields: Option[];
  customValues: Option[];
  errors: Record<string, string>;
}

const EMPTY_HL: HighLevelData = { workflows: [], calendars: [], pipelines: [], customFields: [], customValues: [], errors: {} };

const stripBody = (html: string) => html.replace(/^\s*<body[^>]*>/i, "").replace(/<\/body>\s*$/i, "");
/** Classic form settings are kept server-side only; strip them from the public HTML. */
const stripFormConfig = (html: string) => html.replace(/\sdata-(tags|workflow|success|redirect)="[^"]*"/g, "");

/** Logical page width per device. The canvas is zoomed out to fit when the editor area is narrower. */
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1240, tablet: 820, mobile: 390 };
const DEVICES: Device[] = ["desktop", "tablet", "mobile"];
const RECENT_KEY = "pf-recent-blocks";

/** Selection outline colors per level, so sections, containers and widgets are easy to tell apart. */
const CANVAS_CSS = `
.pf-section.gjs-selected{outline:2px solid #0ea5e9!important;outline-offset:-2px}
.pf-container.gjs-selected{outline:2px solid #f59e0b!important;outline-offset:-2px}
.pf-widget:not(.pf-section):not(.pf-container).gjs-selected{outline:2px solid #4f46e5!important}
`;

/**
 * Keeps "Desktop" rendering a real desktop layout on laptop screens (and inside HighLevel's iframe):
 * the frame keeps its device width and the canvas zooms out instead of triggering mobile breakpoints.
 */
function fitCanvas(editor: GEditor) {
  const el = editor.Canvas.getElement();
  if (!el) return;
  const id = (editor.getDevice() || "desktop") as Device;
  const zoom = Math.min(1, (el.clientWidth - 32) / (DEVICE_WIDTH[id] ?? DEVICE_WIDTH.desktop));
  editor.Devices.get(id)?.set("height", `${Math.floor((el.clientHeight - 32) / zoom)}px`);
  setTimeout(() => editor.Canvas.fitViewport({ ignoreHeight: true, gap: 16, zoom: (z) => Math.min(z, 100) }), 60);
}

function setCanvasHead(editor: GEditor, id: string, tag: "style" | "link", value: string) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.head) return;
  let el = doc.getElementById(id) as HTMLStyleElement | HTMLLinkElement | null;
  if (!el) {
    el = doc.createElement(tag);
    el.id = id;
    if (tag === "link") (el as HTMLLinkElement).rel = "stylesheet";
    doc.head.appendChild(el);
  }
  if (tag === "style") el.textContent = value;
  else if (value && (el as HTMLLinkElement).getAttribute("href") !== value) (el as HTMLLinkElement).href = value;
}

const kindOf = (c: Component | null | undefined): Kind | null => {
  if (!c) return null;
  const t = widgetOf(c)?.type;
  if (!t) return "widget";
  return t === "section" ? "section" : t === "container" || t === "popup" ? "container" : "widget";
};

/** Plain text of a widget, for search results in the command palette. */
const snippet = (s: Settings) =>
  String(s.html ?? s.text ?? s.title ?? s.name ?? s.label ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);

export default function PageEditor({ mode }: { mode: EditorMode }) {
  const { api, user } = useSession();
  const router = useRouter();
  const isPage = mode.kind === "page";
  const editorRef = useRef<GEditor | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HighLevelData>(EMPTY_HL);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyAt = useRef(0);
  const actionsRef = useRef<Record<string, () => void>>({});

  const [page, setPage] = useState<PageDoc | null>(null);
  const [libName, setLibName] = useState("");
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [kitInfo, setKitInfo] = useState<KitInfo>({ kit: DEFAULT_KIT, source: "default", canEditAgency: false, agencyKit: null });
  const [hl, setHl] = useState<HighLevelData>(EMPTY_HL);
  const [library, setLibrary] = useState<LibraryListItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [canShare, setCanShare] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [device, setDevice] = useState<Device>("desktop");
  const [leftTab, setLeftTab] = useState<"blocks" | "layers" | "library">("blocks");
  const [rightTab, setRightTab] = useState<"style" | "settings">("style");
  const [modal, setModal] = useState<Modals>(null);
  const [selected, setSelected] = useState<Component | null>(null);
  const [inline, setInline] = useState<{ component: Component; el: HTMLElement } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [picker, setPicker] = useState<{ after: Component | null } | null>(null);
  const [saveLib, setSaveLib] = useState<{ kind: "section" | "page"; component?: Component } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedAt, setPublishedAt] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [connected, setConnected] = useState(true);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }, []);

  const kit = useMemo(() => effectiveKit(kitInfo.kit, isPage ? theme : undefined), [kitInfo.kit, theme, isPage]);

  /* ── Saving ── */

  const buildDraft = useCallback(() => {
    const ed = editorRef.current!;
    const widgets = collectWidgetCss(ed);
    return { projectData: ed.getProjectData(), html: stripBody(ed.getHtml()), css: (ed.getCss() ?? "") + widgets.css, fonts: widgets.fonts };
  }, []);

  const saveNow = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSave("saving");
    try {
      if (mode.kind === "page") {
        const { projectData, html, css } = buildDraft();
        await api(`/api/pages/${mode.id}`, { method: "PUT", body: { draft: { projectData, html, css } } });
      } else {
        const doc = serialize(ed, "page");
        const thumbnail = await snapshot(ed.Canvas.getBody()?.querySelector<HTMLElement>(".pf-widget"));
        await api(`/api/library/${mode.id}`, { method: "PUT", body: { doc, ...(thumbnail ? { thumbnail } : {}) } });
      }
      setSave("saved");
    } catch {
      setSave("error");
    }
  }, [api, mode, buildDraft]);

  const scheduleSave = useCallback(() => {
    if (Date.now() - readyAt.current < 1500) return; // ignore init-time updates
    setSave("dirty");
    // Library items (global sections) go live on save, so they're saved explicitly.
    if (mode.kind === "library") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 1500);
  }, [saveNow, mode.kind]);

  /* ── Library ── */

  const loadLibrary = useCallback(async () => {
    try {
      const r = await api<{ items: (LibraryListItem & { doc?: { html: string; css: string } })[]; canShare: boolean }>("/api/library");
      setGlobalDocs(r.items);
      setLibrary(r.items);
      setCanShare(r.canShare);
    } catch {
      setLibrary([]);
    } finally {
      setLibraryLoading(false);
    }
  }, [api]);

  /* ── Media picker ── */

  const pickImage = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        const ed = editorRef.current;
        if (!ed) return resolve(null);
        let done = false;
        const finish = (v: string | null) => {
          if (done) return;
          done = true;
          resolve(v);
        };
        ed.AssetManager.open({
          types: ["image"],
          select(asset: any) {
            finish(asset.getSrc());
            ed.AssetManager.close();
          },
        });
        ed.once("asset:close", () => finish(null));
      }),
    [],
  );

  function renderRecent(ed: GEditor) {
    const box = document.getElementById("gpb-recent");
    if (!box) return;
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {}
    const blocks = ids.map((id) => ed.BlockManager.get(id)).filter(Boolean) as any[];
    box.replaceChildren();
    if (!blocks.length) return;
    const el = ed.BlockManager.render(blocks, { external: true });
    if (el) box.appendChild(el);
  }

  /* ── Boot GrapesJS ── */
  useEffect(() => {
    let cancelled = false;
    let editor: GEditor | null = null;

    (async () => {
      let start: { name: string; theme?: Theme; projectData: unknown; html: string; css: string; page?: PageDoc };
      try {
        if (mode.kind === "page") {
          const { page: pg } = await api<{ page: PageDoc }>(`/api/pages/${mode.id}`);
          start = { name: pg.name, theme: pg.theme, projectData: pg.draft.projectData, html: pg.draft.html, css: pg.draft.css, page: pg };
        } else {
          const { item } = await api<{ item: { name: string; doc: { components: unknown } } }>(`/api/library/${mode.id}`);
          start = {
            name: item.name,
            projectData: { pages: [{ component: { type: "wrapper", components: item.doc.components } }], styles: [] },
            html: "",
            css: "",
          };
        }
      } catch (e) {
        setLoadError((e as Error).message);
        return;
      }
      const [wf, media, kitRes, hlRes] = await Promise.all([
        api<{ workflows: { id: string; name: string }[] }>("/api/workflows").catch(() => {
          setConnected(false);
          return { workflows: [] };
        }),
        api<{ files: { src: string; name?: string }[] }>("/api/media").catch(() => ({ files: [] })),
        api<KitInfo>("/api/brand-kit").catch(() => null),
        api<Omit<HighLevelData, "workflows">>("/api/highlevel").catch(() => null),
        loadLibrary(),
      ]);
      if (cancelled) return;

      const hlData: HighLevelData = { ...EMPTY_HL, ...(hlRes ?? {}), workflows: wf.workflows.map((w) => ({ value: w.id, label: w.name })) };
      hlRef.current = hlData;
      setHl(hlData);
      if (kitRes) setKitInfo(kitRes);
      if (start.page) {
        setPage(start.page);
        setTheme(start.page.theme);
        setPublishedAt(start.page.published?.publishedAt ?? null);
      } else setLibName(start.name);

      const startKit = effectiveKit(kitRes?.kit ?? DEFAULT_KIT, start.theme);
      editor = grapesjs.init({
        container: "#gjs",
        height: "100%",
        width: "auto",
        storageManager: false,
        ...(start.projectData ? { projectData: start.projectData as object } : { components: start.html || "", style: start.css || "" }),
        panels: { defaults: [] },
        blockManager: { appendTo: "#gpb-blocks" },
        layerManager: { appendTo: "#gpb-layers" },
        styleManager: { appendTo: "#gpb-styles" },
        selectorManager: { componentFirst: true },
        traitManager: { appendTo: "#gpb-traits" },
        canvasCss: CANVAS_CSS,
        deviceManager: {
          devices: [
            { id: "desktop", name: "Desktop", width: `${DEVICE_WIDTH.desktop}px` },
            { id: "tablet", name: "Tablet", width: `${DEVICE_WIDTH.tablet}px`, widthMedia: "1023px" },
            { id: "mobile", name: "Mobile", width: `${DEVICE_WIDTH.mobile}px`, widthMedia: "767px" },
          ],
        },
        canvas: {
          styles: [fontUrlFor([startKit.fonts.heading, startKit.fonts.body]), "/runtime.css"].filter(Boolean),
          scripts: ["/runtime.js?editor=1"],
        },
        assetManager: {
          assets: media.files,
          upload: "/api/media",
          uploadName: "file",
          uploadFile: async (ev: any) => {
            const files: FileList = ev.dataTransfer ? ev.dataTransfer.files : ev.target.files;
            for (const file of Array.from(files)) {
              const fd = new FormData();
              fd.append("file", file);
              try {
                const r = await api<{ src: string; name: string }>("/api/media", { method: "POST", body: fd });
                editor?.AssetManager.add({ src: r.src, name: r.name });
              } catch (err) {
                alert(`Upload failed: ${(err as Error).message}\nTip: you can also paste an image URL above.`);
              }
            }
          },
        },
        plugins: [
          (ed: GEditor) => formsPlugin(ed, { blocks: [] }),
          (ed: GEditor) => widgetComponents(ed, { onInlineEdit: setInline }),
          globalSection,
          (ed: GEditor) => gpbPlugin(ed, { getWorkflows: () => hlRef.current.workflows.map((w) => ({ id: w.value, name: w.label })) }),
          (ed: GEditor) => customCodePlugin(ed, { blockCustomCode: false as any }),
        ],
      });
      editorRef.current = editor;
      if (process.env.NODE_ENV !== "production") (window as unknown as { gpbEditor: GEditor }).gpbEditor = editor;

      editor.on("load", () => {
        const ed = editor!;
        setCanvasHead(ed, "gpb-theme", "style", kitCss(startKit, "body.gpb-root"));
        ed.runCommand("core:component-outline");
        ed.BlockManager.getCategories().forEach((c: any) => c.set("open", true));
        renderRecent(ed);
        fitCanvas(ed);
        readyAt.current = Date.now();
        setReady(true);

        // Right-click menu on canvas elements.
        ed.Canvas.getWindow()?.addEventListener("contextmenu", (e: MouseEvent) => {
          let el = e.target as any;
          while (el && !el.__gjsv) el = el.parentElement;
          const comp = el?.__gjsv?.model as Component | undefined;
          if (!comp || comp.get("type") === "wrapper") return;
          e.preventDefault();
          ed.select(comp);
          const frame = ed.Canvas.getFrameEl().getBoundingClientRect();
          const zoom = ed.Canvas.getZoom() / 100;
          setCtxMenu({ x: frame.left + e.clientX * zoom, y: frame.top + e.clientY * zoom, component: comp });
        });
      });
      editor.on("update", scheduleSave);
      editor.on("stop:preview", () => setPreview(false));
      editor.on("component:toggled", () => {
        const sel = editor!.getSelected() ?? null;
        setSelected(sel);
        rootRef.current?.setAttribute("data-sel-kind", kindOf(sel) ?? "");
      });
      editor.on("component:hover", (c?: Component) => rootRef.current?.setAttribute("data-hover-kind", kindOf(c) ?? ""));
      editor.on("block:drag:stop", (_c: Component | undefined, block: any) => {
        try {
          const id = block?.getId?.();
          if (!id) return;
          const list = [id, ...JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((x: string) => x !== id)].slice(0, 6);
          localStorage.setItem(RECENT_KEY, JSON.stringify(list));
          renderRecent(editor!);
        } catch {}
      });
      // Google fonts chosen in typography settings must load in the canvas too.
      let fontTimer: ReturnType<typeof setTimeout> | null = null;
      editor.on("component:update:pfSettings", () => {
        if (fontTimer) clearTimeout(fontTimer);
        fontTimer = setTimeout(() => {
          const url = fontUrlFor(collectWidgetCss(editor!).fonts);
          if (url) setCanvasHead(editor!, "gpb-widget-fonts", "link", url);
        }, 400);
      });

      const keymap = (id: string, keys: string, fn: () => void) => editor!.Keymaps.add(id, keys, () => fn(), { prevent: true });
      keymap("pf:duplicate", "⌘+d, ctrl+d", () => duplicate(editor!, editor!.getSelected()));
      keymap("pf:save", "⌘+s, ctrl+s", () => actionsRef.current.save?.());
      keymap("pf:palette", "⌘+k, ctrl+k", () => setModal("palette"));
      keymap("pf:preview", "⌘+shift+p, ctrl+shift+p", () => actionsRef.current.preview?.());
      keymap("pf:device", "⌘+shift+m, ctrl+shift+m", () => actionsRef.current.cycleDevice?.());
      keymap("pf:copy-style", "⌘+alt+c, ctrl+alt+c", () => copyStyle(editor!.getSelected()) && flash("Style copied"));
      keymap("pf:paste-style", "⌘+alt+v, ctrl+alt+v", () => pasteStyle(editor!.getSelected()));
      keymap("pf:shortcuts", "shift+/", () => setModal("shortcuts"));
    })();

    const onResize = () => editorRef.current && fitCanvas(editorRef.current);
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      editor?.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, mode.kind, mode.id]);

  /* Keep the canvas in sync with the brand kit. */
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !ready) return;
    setCanvasHead(ed, "gpb-theme", "style", kitCss(kit, "body.gpb-root"));
    setCanvasHead(ed, "gpb-kit-fonts", "link", fontUrlFor([kit.fonts.heading, kit.fonts.body]));
  }, [kit, ready]);

  /* Warn before leaving with unsaved changes. */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (save === "dirty" || save === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [save]);

  /* Widget search: re-render the library with matching blocks only. */
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !ready) return;
    const q = search.trim().toLowerCase();
    if (!q) {
      ed.BlockManager.render();
      ed.BlockManager.getCategories().forEach((c: any) => c.set("open", true));
      renderRecent(ed);
      return;
    }
    const words = q.split(/\s+/);
    const matches = ed.BlockManager.getAll().filter((b: any) => {
      const id = String(b.getId());
      const def = WIDGETS.find((w) => componentType(w.type) === id);
      const hay = `${b.getLabel()} ${b.getCategoryLabel?.() ?? ""} ${def?.keywords ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    ed.BlockManager.render(matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, ready]);

  /* ── Actions ── */

  const switchDevice = useCallback((d: Device) => {
    setDevice(d);
    const ed = editorRef.current;
    if (!ed) return;
    ed.setDevice(d);
    setTimeout(() => fitCanvas(ed), 30);
  }, []);

  const togglePreview = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    setPreview((p) => {
      if (p) ed.stopCommand("preview");
      else ed.runCommand("preview");
      return !p;
    });
    setTimeout(() => {
      fitCanvas(ed);
      ed.refresh();
    }, 50);
  }, []);

  actionsRef.current = {
    save: () => void saveNow(),
    preview: togglePreview,
    cycleDevice: () => switchDevice(DEVICES[(DEVICES.indexOf(device) + 1) % DEVICES.length]),
  };

  const updateTheme = (patch: Partial<Theme>) => {
    if (!isPage) return;
    const next = { ...theme, ...patch };
    setTheme(next);
    // Color pickers and sliders fire continuously; save once they settle.
    setSave("dirty");
    if (themeTimer.current) clearTimeout(themeTimer.current);
    themeTimer.current = setTimeout(async () => {
      try {
        await api(`/api/pages/${mode.id}`, { method: "PUT", body: { theme: next } });
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 600);
  };

  const publish = async () => {
    const ed = editorRef.current;
    if (!ed || !isPage) return;
    setPublishing(true);
    try {
      const forms: Record<string, FormConfig> = {};
      // Classic forms keep their settings in attributes.
      ed.getWrapper()
        ?.findType("gpb-form")
        .forEach((f) => {
          const a = f.getAttributes();
          forms[a["data-gpb-form"]] = {
            tags: String(a["data-tags"] || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            workflowId: a["data-workflow"] || undefined,
            successMessage: a["data-success"] || undefined,
            redirectUrl: a["data-redirect"] || undefined,
          };
        });
      for (const { component, settings } of findWidgets(ed, "form")) forms[`pf-${uidOf(component)}`] = formConfig(settings);

      // FAQ structured data from accordions marked as FAQ.
      const faqs = findWidgets(ed, "accordion")
        .filter((a) => a.settings.faqSchema)
        .flatMap((a) => (Array.isArray(a.settings.items) ? a.settings.items : []) as { title?: string; html?: string; body?: string }[])
        .map((it) => ({
          "@type": "Question",
          name: String(it.title ?? ""),
          acceptedAnswer: {
            "@type": "Answer",
            text: accordionAnswer(it)
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim(),
          },
        }))
        .filter((q) => q.name);
      const jsonLd = faqs.length ? JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs }) : undefined;

      const { fonts, ...draft } = buildDraft();
      const res = await api<{ publishedAt: number }>(`/api/pages/${mode.id}/publish`, {
        method: "POST",
        body: { draft: { ...draft, html: stripFormConfig(draft.html) }, theme, forms, fonts, jsonLd },
      });
      setPublishedAt(res.publishedAt);
      setSave("saved");
      flash("Published! Live pages update within ~30 seconds.");
    } catch (e) {
      alert(`Publish failed: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  };

  const rename = async (name: string) => {
    if (!name.trim()) return;
    if (isPage && page && name !== page.name) {
      setPage({ ...page, name });
      await api(`/api/pages/${mode.id}`, { method: "PUT", body: { name } }).catch(() => setSave("error"));
    } else if (!isPage && name !== libName) {
      setLibName(name);
      await api(`/api/library/${mode.id}`, { method: "PUT", body: { name } }).catch(() => setSave("error"));
    }
  };

  /* Library operations */

  const insertLibraryItem = async (item: LibraryListItem, after: Component | null) => {
    const ed = editorRef.current;
    if (!ed) return;
    if (item.isGlobal) {
      insertSection(ed, { type: GLOBAL_TYPE, pfGlobalId: item.id }, after);
      return;
    }
    const r = await api<{ item: { doc: { components: unknown[] } } }>(`/api/library/${item.id}`);
    const added = ed
      .getWrapper()!
      .components()
      .add(stripIds(r.item.doc.components) as any[], { at: after ? after.index() + 1 : undefined }) as unknown as Component[];
    if (added[0]) {
      ed.select(added[0]);
      setTimeout(() => added[0].getEl()?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  const saveToLibrary = async (o: SaveOptions) => {
    const ed = editorRef.current!;
    const target = saveLib?.component ?? "page";
    const doc = serialize(ed, target);
    const el = target === "page" ? (ed.Canvas.getBody() as HTMLElement) : target.getEl();
    const thumbnail = await snapshot(el);
    const { item } = await api<{ item: LibraryListItem }>("/api/library", {
      method: "POST",
      body: { kind: saveLib?.kind ?? "section", name: o.name, category: o.category, isGlobal: o.isGlobal, shareWithAgency: o.shareWithAgency, doc, thumbnail },
    });
    if (o.isGlobal && target !== "page") {
      // The section on this page now points to the global version.
      setGlobalDocs([{ id: item.id, name: item.name, doc: { html: doc.html, css: doc.css } }]);
      const at = target.index();
      const parent = target.parent()!;
      target.remove();
      const ref = firstAdded(parent.components().add({ type: GLOBAL_TYPE, pfGlobalId: item.id }, { at }));
      if (ref) ed.select(ref);
    }
    await loadLibrary();
    flash(o.isGlobal ? "Saved as a global section" : "Saved to your library");
  };

  const detachGlobal = async (c: Component) => {
    const ed = editorRef.current!;
    const r = await api<{ item: { doc: { components: unknown[] } } }>(`/api/library/${String(c.get("pfGlobalId"))}`);
    const at = c.index();
    const parent = c.parent()!;
    c.remove();
    const added = parent.components().add(stripIds(r.item.doc.components) as any[], { at }) as unknown as Component[];
    if (added[0]) ed.select(added[0]);
    flash("Detached: this copy is now independent");
  };

  const openGlobal = async (id: string) => {
    if (save !== "saved" && isPage) await saveNow();
    router.push(`/app/editor/lib/${id}`);
  };

  /* ── Panel context ── */

  const getOptions = useCallback(
    (source: string, settings: Settings): Option[] => {
      const ed = editorRef.current;
      switch (source) {
        case "popups":
          return ed ? listPopups(ed) : [];
        case "workflows":
          return hl.workflows;
        case "customFields":
          return [...CONTACT_FIELDS, ...hl.customFields.map((f) => ({ value: f.value, label: `Custom: ${f.label}` }))];
        case "calendars":
          return hl.calendars;
        case "pipelines":
          return hl.pipelines.map((p) => ({ value: p.id, label: p.name }));
        case "stages":
          return hl.pipelines.find((p) => p.id === settings.pipelineId)?.stages.map((s) => ({ value: s.id, label: s.name })) ?? [];
        case "customValues":
          return hl.customValues;
        default:
          return [];
      }
    },
    [hl],
  );

  const ctx: ControlCtx = useMemo(
    () => ({ device, setDevice: switchDevice, getOptions: getOptions as ControlCtx["getOptions"], colors: kit.colors, fonts: FONTS, pickImage }),
    [device, switchDevice, getOptions, kit.colors, pickImage],
  );

  /* ── Command palette ── */

  const commands = useMemo((): PaletteCommand[] => {
    const ed = editorRef.current;
    if (!ed || modal !== "palette") return [];
    const out: PaletteCommand[] = [];
    for (const w of WIDGETS) {
      out.push({ id: `add-${w.type}`, group: "Add widget", label: `Add ${w.label}`, keywords: `${w.keywords ?? ""} ${w.category}`, run: () => insertWidget(ed, w.type) });
    }
    for (const [id, sec] of Object.entries(SECTIONS)) {
      out.push({ id: `sec-${id}`, group: "Add section", label: `Add section: ${sec.label}`, run: () => insertSection(ed, toEditorHtml(sec.nodes), topLevelOf(ed.getSelected())) });
    }
    for (const item of library.filter((i) => i.kind === "section")) {
      out.push({ id: `lib-${item.id}`, group: "Add from library", label: `Add: ${item.name}`, keywords: item.category, run: () => insertLibraryItem(item, topLevelOf(ed.getSelected())) });
    }
    const act = (id: string, label: string, run: () => void, hint?: string, keywords?: string) => out.push({ id, group: "Actions", label, run, hint, keywords });
    if (isPage) act("publish", "Publish", publish, "", "go live");
    act("save", "Save now", () => void saveNow(), "Ctrl+S");
    act("preview", "Toggle preview", togglePreview, "Ctrl+Shift+P");
    act("undo", "Undo", () => ed.UndoManager.undo(), "Ctrl+Z");
    act("redo", "Redo", () => ed.UndoManager.redo(), "Ctrl+Shift+Z");
    DEVICES.forEach((d) => act(`dev-${d}`, `Switch to ${d}`, () => switchDevice(d), "", "device responsive"));
    act("kit", "Brand kit (colors, fonts, logo)", () => setModal("kit"), "", "theme colors fonts");
    if (isPage) {
      act("settings", "Page settings & domains", () => setModal("settings"), "", "seo og image domain");
      act("history", "Revision history", () => setModal("history"), "", "restore");
      act("embed", "Embed in HighLevel", () => setModal("embed"), "", "snippet code");
      act("save-page", "Save this page as a template", () => setSaveLib({ kind: "page" }));
    }
    act("library", "Open library", () => setLeftTab("library"));
    act("layers", "Show layers", () => setLeftTab("layers"));
    act("shortcuts", "Keyboard shortcuts", () => setModal("shortcuts"), "?");
    ed.getWrapper()?.onAll((c: Component) => {
      const def = widgetOf(c);
      if (!def || def.type === "section" || def.type === "container") return;
      const text = snippet(getSettings(c));
      out.push({
        id: `sel-${uidOf(c)}`,
        group: "Go to element",
        label: `${def.label}${text ? `: ${text}` : ""}`,
        run: () => {
          ed.select(c);
          c.getEl()?.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, library, isPage]);

  if (loadError) {
    return (
      <div className="center-screen">
        <div className="center-card">
          <p className="error">{loadError}</p>
          <Link className="btn" href="/app">
            ← Back to pages
          </Link>
        </div>
      </div>
    );
  }

  const saveLabel = {
    saved: isPage ? "All changes saved" : "Saved",
    saving: "Saving…",
    dirty: isPage ? "Unsaved changes" : "Not saved yet",
    error: "Save failed, retrying on next change",
  }[save];
  const ed = ready ? editorRef.current : null;
  const selectedDef = widgetOf(selected);
  const selSettings = selected && isWidget(selected) ? getSettings(selected) : null;
  const legacyPage = isPage && !!page && !theme.useKit;

  return (
    <div className={`ed ${preview ? "is-preview" : ""}`} ref={rootRef}>
      <header className="ed-top">
        <div className="ed-top-left">
          <Link
            className="icon-btn"
            href="/app"
            title="Back to pages"
            onClick={() => {
              if (save === "dirty" && isPage) saveNow();
            }}
          >
            ←
          </Link>
          {(page || libName) && (
            <input
              className="ed-name"
              key={isPage ? page?.id : mode.id}
              defaultValue={isPage ? page?.name : libName}
              onBlur={(e) => rename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              aria-label="Name"
            />
          )}
          {!isPage && <span className="pill pill-global">Global section</span>}
          <span className={`save-state ${save}`}>{saveLabel}</span>
        </div>

        <div className="ed-devices" role="group" aria-label="Device">
          {DEVICES.map((d) => (
            <button key={d} className={device === d ? "active" : ""} onClick={() => switchDevice(d)} title={d}>
              {d === "desktop" ? "🖥" : d === "tablet" ? "▭" : "📱"}
              <span>{d}</span>
            </button>
          ))}
        </div>

        <div className="ed-top-right">
          <button className="icon-btn" title="Search & actions (Ctrl+K)" onClick={() => setModal("palette")}>
            ⌕
          </button>
          <button className="icon-btn" title="Undo (Ctrl+Z)" onClick={() => editorRef.current?.UndoManager.undo()}>
            ↶
          </button>
          <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" onClick={() => editorRef.current?.UndoManager.redo()}>
            ↷
          </button>
          <button className="icon-btn" title="Keyboard shortcuts (?)" onClick={() => setModal("shortcuts")}>
            ⌨
          </button>
          <button className={`btn btn-sm ${preview ? "btn-primary" : ""}`} onClick={togglePreview}>
            {preview ? "Exit preview" : "Preview"}
          </button>
          <button className="btn btn-sm" onClick={() => setModal("kit")}>
            Brand kit
          </button>
          {isPage ? (
            <>
              <button className="btn btn-sm" onClick={() => setModal("settings")}>
                Settings
              </button>
              <button className="btn btn-sm" onClick={() => setModal("history")}>
                History
              </button>
              <button className="btn btn-sm" onClick={() => setModal("embed")}>
                Embed
              </button>
              <button className="btn btn-sm btn-primary" onClick={publish} disabled={publishing}>
                {publishing ? "Publishing…" : "Publish"}
              </button>
            </>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => saveNow().then(() => flash("Saved. Pages using this section now show the update."))}
              disabled={save === "saving"}
            >
              Save &amp; update pages
            </button>
          )}
        </div>
      </header>

      {!connected && (
        <div className="notice warn ed-notice">
          This sub-account isn&apos;t connected through the app install (OAuth). Pages still work, but form leads are only stored in the app, not in your CRM,
          and media/workflows aren&apos;t available. Reinstall the app to connect.
        </div>
      )}
      {!isPage && (
        <div className="notice ed-notice">
          You&apos;re editing a global section. Click <b>Save &amp; update pages</b> to push your changes to every page that uses it.
        </div>
      )}

      <div className="ed-main">
        <aside className="ed-left">
          <div className="tabs">
            <button className={leftTab === "blocks" ? "active" : ""} onClick={() => setLeftTab("blocks")}>
              Widgets
            </button>
            <button className={leftTab === "layers" ? "active" : ""} onClick={() => setLeftTab("layers")}>
              Layers
            </button>
            <button className={leftTab === "library" ? "active" : ""} onClick={() => setLeftTab("library")}>
              Library
            </button>
          </div>
          <div className="panel-scroll" hidden={leftTab !== "blocks"}>
            <div className="block-search">
              <input className="wp-input" type="search" placeholder="Search widgets…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search widgets" />
            </div>
            <div className="recent-wrap" hidden={!!search}>
              <div className="recent-title">Recently used</div>
              <div id="gpb-recent" />
            </div>
            <div id="gpb-blocks" />
          </div>
          <div id="gpb-layers" className="panel-scroll" hidden={leftTab !== "layers"} />
          <div className="panel-scroll" hidden={leftTab !== "library"}>
            <LibraryPanel
              items={library}
              canShare={canShare}
              loading={libraryLoading}
              onInsert={(it) => insertLibraryItem(it, it.kind === "page" ? null : topLevelOf(editorRef.current?.getSelected()))}
              onEdit={(it) => openGlobal(it.id)}
              onRename={async (it, name) => {
                await api(`/api/library/${it.id}`, { method: "PUT", body: { name } });
                loadLibrary();
              }}
              onDelete={async (it) => {
                const warn = it.isGlobal ? " Pages that use this global section will no longer show it." : "";
                if (!confirm(`Delete "${it.name}" from the library?${warn}`)) return;
                await api(`/api/library/${it.id}`, { method: "DELETE" });
                loadLibrary();
              }}
              onSavePage={() => setSaveLib({ kind: "page" })}
            />
          </div>
        </aside>

        <main className="ed-canvas">
          <div id="gjs" />
          {ed && !preview && <AddSectionButton editor={ed} onOpen={(after) => setPicker({ after })} />}
          {ed && inline && <InlineToolbar editor={ed} el={inline.el} colors={kit.colors} rich={!widgetOf(inline.component)?.inline?.plain} />}
        </main>

        <aside className="ed-right">
          {selected && selected.get("type") === GLOBAL_TYPE && (
            <div className="wp">
              <div className="wp-title">
                <strong>{selected.getName()}</strong>
              </div>
              <div className="panel-scroll global-panel">
                <p>
                  This is a <b>global section</b>. It looks the same on every page that uses it, and changes go live everywhere without republishing.
                </p>
                <button className="btn btn-primary" onClick={() => openGlobal(String(selected.get("pfGlobalId")))}>
                  Edit global section
                </button>
                <button className="btn" onClick={() => detachGlobal(selected)}>
                  Detach: make an editable copy for this page only
                </button>
              </div>
            </div>
          )}
          {selected && selectedDef && ed && (
            <WidgetPanel
              key={uidOf(selected)}
              editor={ed}
              component={selected}
              ctx={ctx}
              footer={isPage && selSettings?._abTest ? <AbStats pageId={mode.id} test={String(selSettings._abTest)} /> : null}
            />
          )}
          <div className="classic-panel" hidden={!!selectedDef || selected?.get("type") === GLOBAL_TYPE}>
            {!selected && <p className="panel-hint">Select an element on the page to edit it, or drag a widget from the left.</p>}
            <div className="tabs" hidden={!selected}>
              <button className={rightTab === "style" ? "active" : ""} onClick={() => setRightTab("style")}>
                Style
              </button>
              <button className={rightTab === "settings" ? "active" : ""} onClick={() => setRightTab("settings")}>
                Settings
              </button>
            </div>
            <div className="panel-scroll" hidden={!selected || rightTab !== "style"}>
              <p className="panel-hint">This is a classic element. Choose a device at the top, then style it. Styles apply per device.</p>
              <div id="gpb-styles" />
            </div>
            <div className="panel-scroll" hidden={!selected || rightTab !== "settings"}>
              <p className="panel-hint">Links, form → CRM settings, animations, hover effects and visibility.</p>
              <div id="gpb-traits" />
            </div>
          </div>
        </aside>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {ctxMenu && ed && (
        <ContextMenu
          editor={ed}
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onSaveToLibrary={(c) => setSaveLib({ kind: "section", component: c })}
          onShowLayers={() => setLeftTab("layers")}
          onEditGlobal={openGlobal}
          onDetachGlobal={detachGlobal}
          flash={flash}
        />
      )}

      {picker && (
        <SectionPicker
          library={library}
          onClose={() => setPicker(null)}
          onPick={(content, o) => {
            const ed2 = editorRef.current;
            if (!ed2) return;
            if (o?.globalId) insertSection(ed2, { type: GLOBAL_TYPE, pfGlobalId: o.globalId }, picker.after);
            else if (o?.libraryId) {
              const it = library.find((i) => i.id === o.libraryId);
              if (it) insertLibraryItem(it, picker.after);
            } else insertSection(ed2, content, picker.after);
            setPicker(null);
          }}
        />
      )}

      {saveLib && (
        <SaveToLibraryModal
          kind={saveLib.kind}
          defaultName={saveLib.kind === "page" ? (page?.name ?? "Page template") : (widgetOf(saveLib.component)?.label ?? "Section")}
          canShare={canShare}
          onSave={saveToLibrary}
          onClose={() => setSaveLib(null)}
        />
      )}

      {modal === "palette" && <CommandPalette commands={commands} onClose={() => setModal(null)} />}

      {modal === "shortcuts" && (
        <Modal title="Keyboard shortcuts" onClose={() => setModal(null)} width={520}>
          <table className="table shortcuts">
            <tbody>
              {SHORTCUTS.map(([k, d]) => (
                <tr key={k}>
                  <td>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">On a Mac, use ⌘ instead of Ctrl.</p>
        </Modal>
      )}

      {modal === "kit" && (
        <BrandKitModal
          info={kitInfo}
          ctx={ctx}
          pageUsesKit={isPage ? !legacyPage : null}
          onPageUsesKit={(v) => {
            updateTheme({ useKit: v });
            flash(v ? "This page now follows the brand kit" : "This page uses its own theme");
          }}
          onSave={async (k: BrandKit, scope) => {
            const r = await api<{ kit: BrandKit }>("/api/brand-kit", { method: "PUT", body: { kit: k, scope } });
            if (scope === "agency") setKitInfo((i) => ({ ...i, agencyKit: r.kit, ...(i.source !== "location" ? { kit: r.kit, source: "agency" as const } : {}) }));
            else setKitInfo((i) => ({ ...i, kit: r.kit, source: "location" }));
          }}
          onReset={async () => {
            const r = await api<{ kit: BrandKit; source: KitInfo["source"] }>("/api/brand-kit", { method: "DELETE" });
            setKitInfo((i) => ({ ...i, kit: r.kit, source: r.source }));
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "theme" && legacyPage && (
        <Modal title="This page's own theme" onClose={() => setModal(null)} width={480}>
          <p className="muted">This page was created before brand kits. These colors and fonts apply to this page only.</p>
          <div className="form-grid">
            {(
              [
                ["primary", "Primary color"],
                ["secondary", "Accent color"],
                ["text", "Text color"],
                ["background", "Background"],
              ] as [keyof Theme, string][]
            ).map(([k, label]) => (
              <label key={k} className="field">
                <span>{label}</span>
                <div className="color-input">
                  <input type="color" value={theme[k] as string} onChange={(e) => updateTheme({ [k]: e.target.value })} />
                  <input className="input" value={theme[k] as string} onChange={(e) => updateTheme({ [k]: e.target.value })} />
                </div>
              </label>
            ))}
            {(["headingFont", "bodyFont"] as const).map((k) => (
              <label key={k} className="field">
                <span>{k === "headingFont" ? "Heading font" : "Body font"}</span>
                <select className="input" value={theme[k]} onChange={(e) => updateTheme({ [k]: e.target.value })}>
                  {FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="field">
              <span>Corner radius: {theme.radius}px</span>
              <input type="range" min={0} max={28} value={theme.radius} onChange={(e) => updateTheme({ radius: Number(e.target.value) })} />
            </label>
          </div>
        </Modal>
      )}

      {modal === "settings" && page && (
        <PageSettingsModal
          page={page}
          publishedAt={publishedAt}
          pickImage={pickImage}
          onSaved={(settings: PageSettings) => {
            setPage({ ...page, settings });
            flash("Settings saved");
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "history" && isPage && (
        <Modal title="Revision history" onClose={() => setModal(null)} width={520}>
          <RevisionHistory
            pageId={mode.id}
            beforeRestore={async () => {
              if (save === "dirty" || save === "saving") await saveNow();
            }}
          />
        </Modal>
      )}

      {modal === "embed" && isPage && (
        <Modal title="Add this page to HighLevel" onClose={() => setModal(null)} width={640}>
          <EmbedInstructions pageId={mode.id} published={!!publishedAt} />
        </Modal>
      )}

      {legacyPage && modal === null && <LegacyThemeHint onOpen={() => setModal("theme")} id={user.locationId} />}
    </div>
  );
}

/** Small reminder for pages that still use their own theme (created before brand kits). */
function LegacyThemeHint({ onOpen, id }: { onOpen: () => void; id: string }) {
  const key = `pf-legacy-hint-${id}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return !!sessionStorage.getItem(key);
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <div className="legacy-hint">
      This page uses its own colors and fonts.{" "}
      <button type="button" className="wp-link-btn" onClick={onOpen}>
        Edit page theme
      </button>{" "}
      or switch it to the brand kit under <b>Brand kit</b>.
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(key, "1");
          } catch {}
        }}
      >
        ×
      </button>
    </div>
  );
}

type Revision = { id: number; at: number; kind: "publish" | "autosave" | "restore"; version: number | null };

const REVISION_LABEL: Record<Revision["kind"], (r: Revision) => string> = {
  publish: (r) => `Published (v${r.version})`,
  autosave: () => "Draft snapshot",
  restore: () => "Before a restore",
};

function RevisionHistory({ pageId, beforeRestore }: { pageId: string; beforeRestore: () => Promise<void> }) {
  const { api } = useSession();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    api<{ revisions: Revision[] }>(`/api/pages/${pageId}/revisions`)
      .then((r) => setRevisions(r.revisions))
      .catch((e) => setError((e as Error).message));
  }, [api, pageId]);

  const restore = async (r: Revision) => {
    if (!confirm(`Restore "${REVISION_LABEL[r.kind](r)}" from ${new Date(r.at).toLocaleString()}? Your current draft is kept in history.`)) return;
    setBusy(r.id);
    try {
      await beforeRestore();
      await api(`/api/pages/${pageId}/revisions`, { method: "POST", body: { revisionId: r.id } });
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!revisions) return <p className="muted">Loading…</p>;
  if (!revisions.length) return <p className="muted">No revisions yet. One is saved every time you publish, and a draft snapshot every 30 minutes while you edit.</p>;
  return (
    <>
      <p className="muted">Restoring replaces the draft in the editor. The live page doesn&apos;t change until you publish.</p>
      <ul className="rev-list">
        {revisions.map((r) => (
          <li key={r.id}>
            <div>
              <div className="rev-kind">{REVISION_LABEL[r.kind](r)}</div>
              <div className="muted">{new Date(r.at).toLocaleString()}</div>
            </div>
            <button className="btn btn-sm" disabled={busy !== null} onClick={() => restore(r)}>
              {busy === r.id ? "Restoring…" : "Restore"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
