"use client";

import grapesjs, { Editor as GEditor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import customCodePlugin from "grapesjs-custom-code";
import formsPlugin from "grapesjs-plugin-forms";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormConfig, PageDoc } from "@/lib/pages";
import { DEFAULT_THEME, FONTS, fontUrl, Theme, themeCss } from "@/lib/theme";
import { useSession } from "../session";
import { EmbedInstructions, Modal, timeAgo } from "../ui";
import gpbPlugin from "./gpbPlugin";

type SaveState = "saved" | "saving" | "dirty" | "error";
type Device = "desktop" | "tablet" | "mobile";

const stripBody = (html: string) => html.replace(/^\s*<body[^>]*>/i, "").replace(/<\/body>\s*$/i, "");
/** Form settings are kept server-side only; strip them from the public HTML. */
const stripFormConfig = (html: string) => html.replace(/\sdata-(tags|workflow|success|redirect)="[^"]*"/g, "");

function applyThemeToCanvas(editor: GEditor, theme: Theme) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.head) return;
  let style = doc.getElementById("gpb-theme") as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = "gpb-theme";
    doc.head.appendChild(style);
  }
  style.textContent = themeCss(theme, "body.gpb-root");
  let link = doc.getElementById("gpb-font") as HTMLLinkElement | null;
  if (!link) {
    link = doc.createElement("link");
    link.id = "gpb-font";
    link.rel = "stylesheet";
    doc.head.appendChild(link);
  }
  link.href = fontUrl(theme);
}

export default function PageEditor({ pageId }: { pageId: string }) {
  const { api } = useSession();
  const editorRef = useRef<GEditor | null>(null);
  const workflowsRef = useRef<{ id: string; name: string }[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyAt = useRef(0);

  const [page, setPage] = useState<PageDoc | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [device, setDevice] = useState<Device>("desktop");
  const [leftTab, setLeftTab] = useState<"blocks" | "layers">("blocks");
  const [rightTab, setRightTab] = useState<"style" | "settings">("style");
  const [modal, setModal] = useState<null | "theme" | "settings" | "embed">(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedAt, setPublishedAt] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [connected, setConnected] = useState(true);
  const [toast, setToast] = useState("");

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const buildDraft = useCallback(() => {
    const ed = editorRef.current!;
    return { projectData: ed.getProjectData(), html: stripBody(ed.getHtml()), css: ed.getCss() ?? "" };
  }, []);

  const saveNow = useCallback(async () => {
    if (!editorRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSave("saving");
    try {
      await api(`/api/pages/${pageId}`, { method: "PUT", body: { draft: buildDraft() } });
      setSave("saved");
    } catch {
      setSave("error");
    }
  }, [api, pageId, buildDraft]);

  const scheduleSave = useCallback(() => {
    if (Date.now() - readyAt.current < 1500) return; // ignore init-time updates
    setSave("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 1500);
  }, [saveNow]);

  /* ── Boot GrapesJS ── */
  useEffect(() => {
    let cancelled = false;
    let editor: GEditor | null = null;

    (async () => {
      let data: { page: PageDoc };
      try {
        data = await api<{ page: PageDoc }>(`/api/pages/${pageId}`);
      } catch (e) {
        setLoadError((e as Error).message);
        return;
      }
      const [wf, media] = await Promise.all([
        api<{ workflows: { id: string; name: string }[] }>("/api/workflows").catch(() => {
          setConnected(false);
          return { workflows: [] };
        }),
        api<{ files: { src: string; name?: string }[] }>("/api/media").catch(() => ({ files: [] })),
      ]);
      if (cancelled) return;

      const pg = data.page;
      workflowsRef.current = wf.workflows;
      setPage(pg);
      setTheme(pg.theme);
      setPublishedAt(pg.published?.publishedAt ?? null);

      const hasProject = !!pg.draft.projectData;
      editor = grapesjs.init({
        container: "#gjs",
        height: "100%",
        width: "auto",
        storageManager: false,
        ...(hasProject
          ? { projectData: pg.draft.projectData as object }
          : { components: pg.draft.html || "", style: pg.draft.css || "" }),
        panels: { defaults: [] },
        blockManager: { appendTo: "#gpb-blocks" },
        layerManager: { appendTo: "#gpb-layers" },
        styleManager: { appendTo: "#gpb-styles" },
        selectorManager: { componentFirst: true },
        traitManager: { appendTo: "#gpb-traits" },
        deviceManager: {
          devices: [
            { id: "desktop", name: "Desktop", width: "" },
            { id: "tablet", name: "Tablet", width: "820px", widthMedia: "1023px" },
            { id: "mobile", name: "Mobile", width: "390px", widthMedia: "767px" },
          ],
        },
        canvas: {
          styles: [fontUrl(pg.theme), "/runtime.css"],
          scripts: ["/runtime.js?editor=1"],
        },
        assetManager: {
          assets: media.files,
          upload: "/api/media",
          uploadName: "file",
          uploadFile: async (ev: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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
          (ed: GEditor) => gpbPlugin(ed, { getWorkflows: () => workflowsRef.current }),
          (ed: GEditor) => customCodePlugin(ed, { blockCustomCode: { label: "Custom HTML", category: "Basic" } }),
        ],
      });
      editorRef.current = editor;
      if (process.env.NODE_ENV !== "production") (window as unknown as { gpbEditor: GEditor }).gpbEditor = editor;

      editor.on("load", () => {
        applyThemeToCanvas(editor!, pg.theme);
        editor!.runCommand("core:component-outline");
        editor!.BlockManager.getCategories().forEach((c: any, i: number) => c.set("open", i < 3)); // eslint-disable-line @typescript-eslint/no-explicit-any
        readyAt.current = Date.now();
      });
      editor.on("update", scheduleSave);
      editor.on("stop:preview", () => setPreview(false));
    })();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      editor?.destroy();
      editorRef.current = null;
    };
  }, [api, pageId, scheduleSave]);

  /* ── Warn before leaving with unsaved changes ── */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (save === "dirty" || save === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [save]);

  const switchDevice = (d: Device) => {
    setDevice(d);
    editorRef.current?.setDevice(d);
  };

  const togglePreview = () => {
    const ed = editorRef.current;
    if (!ed) return;
    if (preview) ed.stopCommand("preview");
    else ed.runCommand("preview");
    setPreview(!preview);
    setTimeout(() => ed.refresh(), 50);
  };

  const updateTheme = async (patch: Partial<Theme>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    if (editorRef.current) applyThemeToCanvas(editorRef.current, next);
    try {
      await api(`/api/pages/${pageId}`, { method: "PUT", body: { theme: next } });
    } catch {
      setSave("error");
    }
  };

  const publish = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    setPublishing(true);
    try {
      const forms: Record<string, FormConfig> = {};
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
      const draft = buildDraft();
      const res = await api<{ publishedAt: number }>(`/api/pages/${pageId}/publish`, {
        method: "POST",
        body: { draft: { ...draft, html: stripFormConfig(draft.html) }, theme, forms },
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

  const renamePage = async (name: string) => {
    if (!page || !name.trim() || name === page.name) return;
    setPage({ ...page, name });
    await api(`/api/pages/${pageId}`, { method: "PUT", body: { name } }).catch(() => setSave("error"));
  };

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

  const saveLabel = { saved: "All changes saved", saving: "Saving…", dirty: "Unsaved changes", error: "Save failed, retrying on next change" }[save];

  return (
    <div className={`ed ${preview ? "is-preview" : ""}`}>
      <header className="ed-top">
        <div className="ed-top-left">
          <Link className="icon-btn" href="/app" title="Back to pages" onClick={() => save === "dirty" && saveNow()}>
            ←
          </Link>
          {page && (
            <input
              className="ed-name"
              defaultValue={page.name}
              onBlur={(e) => renamePage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          )}
          <span className={`save-state ${save}`}>{saveLabel}</span>
        </div>

        <div className="ed-devices" role="group" aria-label="Device">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button key={d} className={device === d ? "active" : ""} onClick={() => switchDevice(d)} title={d}>
              {d === "desktop" ? "🖥" : d === "tablet" ? "▭" : "📱"}
              <span>{d}</span>
            </button>
          ))}
        </div>

        <div className="ed-top-right">
          <button className="icon-btn" title="Undo (Ctrl+Z)" onClick={() => editorRef.current?.UndoManager.undo()}>
            ↶
          </button>
          <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" onClick={() => editorRef.current?.UndoManager.redo()}>
            ↷
          </button>
          <button className="icon-btn" title="View code" onClick={() => editorRef.current?.runCommand("export-template")}>
            {"</>"}
          </button>
          <button className={`btn btn-sm ${preview ? "btn-primary" : ""}`} onClick={togglePreview}>
            {preview ? "Exit preview" : "Preview"}
          </button>
          <button className="btn btn-sm" onClick={() => setModal("theme")}>
            Theme
          </button>
          <button className="btn btn-sm" onClick={() => setModal("settings")}>
            Settings
          </button>
          <button className="btn btn-sm" onClick={() => setModal("embed")}>
            Embed
          </button>
          <button className="btn btn-sm btn-primary" onClick={publish} disabled={publishing}>
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>

      {!connected && (
        <div className="notice warn ed-notice">
          This sub-account isn&apos;t connected through the app install (OAuth). Pages still work, but form leads are
          only stored in the app, not in your CRM, and media/workflows aren&apos;t available. Reinstall the app to connect.
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
          </div>
          <div id="gpb-blocks" className="panel-scroll" hidden={leftTab !== "blocks"} />
          <div id="gpb-layers" className="panel-scroll" hidden={leftTab !== "layers"} />
        </aside>

        <main className="ed-canvas">
          <div id="gjs" />
        </main>

        <aside className="ed-right">
          <div className="tabs">
            <button className={rightTab === "style" ? "active" : ""} onClick={() => setRightTab("style")}>
              Style
            </button>
            <button className={rightTab === "settings" ? "active" : ""} onClick={() => setRightTab("settings")}>
              Settings
            </button>
          </div>
          <div className="panel-scroll" hidden={rightTab !== "style"}>
            <p className="panel-hint">
              Select an element, choose a device at the top, then style it. Styles apply per device.
            </p>
            <div id="gpb-styles" />
          </div>
          <div className="panel-scroll" hidden={rightTab !== "settings"}>
            <p className="panel-hint">Widget options, links, form → CRM settings, animations, hover effects and visibility.</p>
            <div id="gpb-traits" />
          </div>
        </aside>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {modal === "theme" && (
        <Modal title="Global theme" onClose={() => setModal(null)} width={480}>
          <p className="muted">Colors and fonts used by every widget on this page.</p>
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
            <label className="field">
              <span>Heading font</span>
              <select className="input" value={theme.headingFont} onChange={(e) => updateTheme({ headingFont: e.target.value })}>
                {FONTS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Body font</span>
              <select className="input" value={theme.bodyFont} onChange={(e) => updateTheme({ bodyFont: e.target.value })}>
                {FONTS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Corner radius: {theme.radius}px</span>
              <input type="range" min={0} max={28} value={theme.radius} onChange={(e) => updateTheme({ radius: Number(e.target.value) })} />
            </label>
          </div>
        </Modal>
      )}

      {modal === "settings" && page && (
        <Modal title="Page settings" onClose={() => setModal(null)}>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const settings = { title: String(fd.get("title")), description: String(fd.get("description")) };
              await api(`/api/pages/${pageId}`, { method: "PUT", body: { settings } });
              setPage({ ...page, settings });
              setModal(null);
              flash("Settings saved");
            }}
          >
            <label className="field">
              <span>SEO title (hosted link)</span>
              <input className="input" name="title" defaultValue={page.settings.title} />
            </label>
            <label className="field">
              <span>Meta description</span>
              <textarea className="input" name="description" rows={3} defaultValue={page.settings.description} />
            </label>
            <p className="muted">
              Page id: <code>{page.id}</code> · Last published: {timeAgo(publishedAt)}
            </p>
            <button className="btn btn-primary" type="submit">
              Save settings
            </button>
          </form>
        </Modal>
      )}

      {modal === "embed" && (
        <Modal title="Add this page to HighLevel" onClose={() => setModal(null)} width={640}>
          <EmbedInstructions pageId={pageId} published={!!publishedAt} />
        </Modal>
      )}
    </div>
  );
}
