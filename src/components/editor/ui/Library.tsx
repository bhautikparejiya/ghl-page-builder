"use client";

import { useState } from "react";
import { Modal } from "../../ui";
import type { LibraryListItem } from "./AddSection";

/** Left-panel list of saved sections and page templates. */
export function LibraryPanel({ items, canShare, onInsert, onEdit, onRename, onDelete, onSavePage, loading }: {
  items: LibraryListItem[];
  canShare: boolean;
  loading: boolean;
  onInsert: (item: LibraryListItem) => void;
  onEdit: (item: LibraryListItem) => void;
  onRename: (item: LibraryListItem, name: string) => void;
  onDelete: (item: LibraryListItem) => void;
  onSavePage: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = items.filter((i) => `${i.name} ${i.category}`.toLowerCase().includes(q.toLowerCase()));
  const groups: [string, LibraryListItem[]][] = [
    ["Global sections", filtered.filter((i) => i.isGlobal)],
    ["Saved sections", filtered.filter((i) => i.kind === "section" && !i.isGlobal)],
    ["Page templates", filtered.filter((i) => i.kind === "page")],
  ];
  return (
    <div className="lib">
      <div className="lib-top">
        <input className="wp-input" placeholder="Search library…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-sm" onClick={onSavePage}>
          Save this page as a template
        </button>
        <p className="panel-hint lib-hint">
          Right-click any section on the page and choose <b>Save section to library</b>. Global sections update everywhere they&apos;re used.
          {canShare && " As an agency user you can share items with all sub-accounts."}
        </p>
      </div>
      {loading && <p className="muted lib-empty">Loading…</p>}
      {!loading &&
        groups.map(([label, list]) =>
          list.length ? (
            <section key={label} className="lib-group">
              <h4>{label}</h4>
              {list.map((it) => (
                <div key={it.id} className="lib-item">
                  <div className="lib-thumb">{it.thumbnail ? <img src={it.thumbnail} alt="" /> : <span>No preview</span>}</div>
                  <div className="lib-meta">
                    <b title={it.name}>{it.name}</b>
                    <span className="muted">
                      {it.category || (it.kind === "page" ? "Page" : "Section")}
                      {it.ownerType === "company" ? " · Agency" : ""}
                    </span>
                  </div>
                  <div className="lib-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => onInsert(it)}>
                      {it.kind === "page" ? "Add sections" : "Insert"}
                    </button>
                    {it.isGlobal && (
                      <button className="btn btn-sm" onClick={() => onEdit(it)}>
                        Edit
                      </button>
                    )}
                    <button
                      className="icon-btn"
                      title="Rename"
                      onClick={() => {
                        const name = prompt("New name", it.name);
                        if (name?.trim()) onRename(it, name.trim());
                      }}
                    >
                      ✎
                    </button>
                    <button className="icon-btn" title="Delete" onClick={() => onDelete(it)}>
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ) : null,
        )}
      {!loading && items.length === 0 && <p className="muted lib-empty">Your library is empty.</p>}
    </div>
  );
}

export interface SaveOptions {
  name: string;
  category: string;
  isGlobal: boolean;
  shareWithAgency: boolean;
}

export function SaveToLibraryModal({ kind, defaultName, canShare, onSave, onClose }: {
  kind: "section" | "page";
  defaultName: string;
  canShare: boolean;
  onSave: (o: SaveOptions) => Promise<void>;
  onClose: () => void;
}) {
  const [o, setO] = useState<SaveOptions>({ name: defaultName, category: "", isGlobal: false, shareWithAgency: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title={kind === "page" ? "Save page as a template" : "Save section to library"} onClose={onClose} width={480}>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave(o);
            onClose();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" required value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Category (optional)</span>
          <input className="input" placeholder="e.g. Heroes, Footers, Offers" value={o.category} onChange={(e) => setO({ ...o, category: e.target.value })} />
        </label>
        {kind === "section" && (
          <label className="check">
            <input type="checkbox" checked={o.isGlobal} onChange={(e) => setO({ ...o, isGlobal: e.target.checked })} />
            <span>
              <b>Global section</b>: edits to it update every page that uses it, without republishing. This section on the page becomes linked to it.
            </span>
          </label>
        )}
        {canShare && (
          <label className="check">
            <input type="checkbox" checked={o.shareWithAgency} onChange={(e) => setO({ ...o, shareWithAgency: e.target.checked })} />
            <span>
              <b>Share with all sub-accounts</b> in your agency.
            </span>
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}
