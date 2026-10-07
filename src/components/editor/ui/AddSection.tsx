"use client";

import type { Component, Editor } from "grapesjs";
import { useEffect, useState } from "react";
import { SECTIONS, toEditorHtml } from "@/lib/blueprints";
import { componentType } from "@/lib/widgets";
import { iconSvg } from "@/lib/widgets/render";
import { topLevelOf } from "../actions";
import { SETTINGS_PROP } from "../widgetComponents";

export interface LibraryListItem {
  id: string;
  name: string;
  kind: "section" | "page";
  category: string;
  isGlobal: boolean;
  ownerType: "location" | "company";
  thumbnail?: string;
}

/** Empty section structures: columns as percentages ([] = single column). */
const STRUCTURES: { label: string; cols: (number | null)[] }[] = [
  { label: "1 column", cols: [] },
  { label: "2 columns", cols: [null, null] },
  { label: "3 columns", cols: [null, null, null] },
  { label: "4 columns", cols: [null, null, null, null] },
  { label: "1/3 + 2/3", cols: [32, null] },
  { label: "2/3 + 1/3", cols: [null, 32] },
];

const structureContent = (cols: (number | null)[]) => ({
  type: componentType("section"),
  components: cols.length
    ? [
        {
          type: componentType("container"),
          [SETTINGS_PROP]: { direction: { desktop: "row", mobile: "column" }, gap: { desktop: 32, mobile: 20 } },
          components: cols.map((w) => ({
            type: componentType("container"),
            [SETTINGS_PROP]: w ? { width: { desktop: { value: w, unit: "%" }, mobile: { value: 100, unit: "%" } } } : {},
          })),
        },
      ]
    : [],
});

const structurePreview = (cols: (number | null)[]) => {
  const parts = cols.length ? cols : [null];
  const total = parts.reduce<number>((n, w) => n + (w ?? (100 - parts.reduce<number>((a, x) => a + (x ?? 0), 0)) / parts.filter((x) => !x).length), 0);
  return (
    <span className="struct-preview">
      {parts.map((w, i) => {
        const share = w ?? (100 - parts.reduce<number>((a, x) => a + (x ?? 0), 0)) / parts.filter((x) => !x).length;
        return <span key={i} style={{ flexGrow: share / total }} />;
      })}
    </span>
  );
};

/** "+" button under the hovered section, and an empty-page call to action. Opens the section picker. */
export function AddSectionButton({ editor, onOpen }: { editor: Editor; onOpen: (after: Component | null) => void }) {
  const [target, setTarget] = useState<Component | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const place = (c: Component | null) => {
      const el = c?.getEl();
      if (!c || !el) return setPos(null);
      const p = editor.Canvas.getElementPos(el);
      setPos(p ? { top: p.top + p.height, left: p.left + p.width / 2 } : null);
    };
    const onHover = (c?: Component) => {
      const top = topLevelOf(c);
      if (top) {
        setTarget(top);
        place(top);
      }
    };
    const check = () => setEmpty((editor.getWrapper()?.components().length ?? 0) === 0);
    const reposition = () => setTarget((t) => (place(t), t));
    editor.on("component:hover", onHover);
    editor.on("component:add component:remove load", check);
    editor.on("component:update update", reposition);
    const win = editor.Canvas.getWindow();
    win?.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition);
    check();
    return () => {
      editor.off("component:hover", onHover);
      editor.off("component:add component:remove load", check);
      editor.off("component:update update", reposition);
      win?.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    };
  }, [editor]);

  return (
    <>
      {pos && target && !empty && (
        <button type="button" className="add-section-btn" style={{ top: pos.top, left: pos.left }} title="Add a section below" onClick={() => onOpen(target)}>
          +
        </button>
      )}
      {empty && (
        <div className="add-section-empty">
          <p>This page is empty.</p>
          <button type="button" className="btn btn-primary" onClick={() => onOpen(null)}>
            + Add your first section
          </button>
        </div>
      )}
    </>
  );
}

/** Picker: empty structures, prebuilt sections, and sections saved in the library. */
export function SectionPicker({ library, onPick, onClose }: {
  library: LibraryListItem[];
  onPick: (content: unknown, opts?: { globalId?: string; libraryId?: string }) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"structure" | "sections" | "saved">("structure");
  const saved = library.filter((i) => i.kind === "section");
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal picker" style={{ maxWidth: 760 }} role="dialog" aria-label="Add a section">
        <div className="modal-head">
          <h3>Add a section</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="tabs">
          <button className={tab === "structure" ? "active" : ""} onClick={() => setTab("structure")}>
            Empty layout
          </button>
          <button className={tab === "sections" ? "active" : ""} onClick={() => setTab("sections")}>
            Ready-made sections
          </button>
          <button className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}>
            My library ({saved.length})
          </button>
        </div>
        <div className="modal-body">
          {tab === "structure" && (
            <div className="picker-grid picker-grid--small">
              {STRUCTURES.map((s) => (
                <button key={s.label} type="button" className="picker-tile" onClick={() => onPick(structureContent(s.cols))}>
                  {structurePreview(s.cols)}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
          {tab === "sections" && (
            <div className="picker-grid">
              {Object.entries(SECTIONS).map(([id, sec]) => (
                <button key={id} type="button" className="picker-tile" onClick={() => onPick(toEditorHtml(sec.nodes))}>
                  <span className="picker-icon" dangerouslySetInnerHTML={{ __html: iconSvg(sec.icon) }} />
                  <span>{sec.label}</span>
                </button>
              ))}
            </div>
          )}
          {tab === "saved" &&
            (saved.length === 0 ? (
              <p className="muted">Nothing saved yet. Right-click a section on the page and choose “Save section to library”.</p>
            ) : (
              <div className="picker-grid">
                {saved.map((it) => (
                  <button key={it.id} type="button" className="picker-tile picker-tile--thumb" onClick={() => onPick(null, it.isGlobal ? { globalId: it.id } : { libraryId: it.id })}>
                    {it.thumbnail ? <img src={it.thumbnail} alt="" /> : <span className="picker-noimg">No preview</span>}
                    <span>
                      {it.name}
                      {it.isGlobal && <em className="pill pill-global">Global</em>}
                      {it.ownerType === "company" && <em className="pill">Agency</em>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
