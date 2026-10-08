"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { EmbedInstructions, Modal, timeAgo } from "@/components/ui";

interface PageRow {
  id: string;
  name: string;
  updatedAt: number;
  publishedAt: number | null;
  hasUnpublishedChanges: boolean;
}
interface TemplateRow {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
}
interface Submission {
  at: number;
  formId: string;
  fields: Record<string, string>;
  contactId?: string;
  error?: string;
}

export default function Dashboard() {
  const { api, user } = useSession();
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [embedFor, setEmbedFor] = useState<PageRow | null>(null);
  const [leadsFor, setLeadsFor] = useState<PageRow | null>(null);
  const [leads, setLeads] = useState<Submission[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [showCheck, setShowCheck] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ pages: PageRow[]; templates: TemplateRow[] }>("/api/pages");
      setPages(data.pages);
      setTemplates(data.templates);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    load();
    api<{ connected: boolean }>("/api/status")
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
  }, [api, load]);

  const create = async (templateId: string, name: string, libraryId?: string) => {
    setBusy(libraryId ?? templateId);
    try {
      const { page } = await api<{ page: { id: string } }>("/api/pages", { method: "POST", body: libraryId ? { libraryId, name } : { templateId, name } });
      router.push(`/app/editor/${page.id}`);
    } catch (e) {
      alert((e as Error).message);
      setBusy("");
    }
  };

  const duplicate = async (p: PageRow) => {
    await api("/api/pages", { method: "POST", body: { duplicateOf: p.id } });
    load();
  };

  const remove = async (p: PageRow) => {
    if (!confirm(`Delete "${p.name}"? Embedded copies of this page will stop showing. This cannot be undone.`)) return;
    await api(`/api/pages/${p.id}`, { method: "DELETE" });
    load();
  };

  const openLeads = async (p: PageRow) => {
    setLeadsFor(p);
    setLeads(null);
    const data = await api<{ submissions: Submission[] }>(`/api/pages/${p.id}/submissions`);
    setLeads(data.submissions);
  };

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="brand">
          <img className="logo-mark" src="/logo.svg" alt="PageForge" />
          <div>
            <h1>PageForge</h1>
            <p className="muted">Design advanced pages, then publish them into any HighLevel funnel or website.</p>
          </div>
        </div>
        <div className="dash-head-right">
          {connected !== null && (
            <button
              type="button"
              className={`pill pill-btn ${connected ? "ok" : "warn"}`}
              title={`Location: ${user.locationId}. Click to check the HighLevel connection.`}
              onClick={() => setShowCheck(true)}
            >
              {connected ? "● CRM connected" : "● CRM not connected"}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + New page
          </button>
        </div>
      </header>

      {error && <div className="notice warn">{error}</div>}

      {pages === null ? (
        <div className="muted pad">Loading pages…</div>
      ) : pages.length === 0 ? (
        <div className="empty">
          <h2>Build your first page</h2>
          <p className="muted">Start from a high-converting template or a blank canvas.</p>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            Choose a template
          </button>
        </div>
      ) : (
        <div className="page-grid">
          {pages.map((p) => (
            <div className="page-card" key={p.id}>
              <Link href={`/app/editor/${p.id}`} className="page-card-main">
                <h3>{p.name}</h3>
                <p className="muted">Edited {timeAgo(p.updatedAt)}</p>
                <span className={`pill ${!p.publishedAt ? "" : p.hasUnpublishedChanges ? "warn" : "ok"}`}>
                  {!p.publishedAt ? "Draft" : p.hasUnpublishedChanges ? "Published · unpublished changes" : "Published"}
                </span>
              </Link>
              <div className="page-card-actions">
                <Link className="btn btn-sm btn-primary" href={`/app/editor/${p.id}`}>
                  Edit
                </Link>
                <button className="btn btn-sm" onClick={() => setEmbedFor(p)}>
                  Embed
                </button>
                <button className="btn btn-sm" onClick={() => openLeads(p)}>
                  Leads
                </button>
                {p.publishedAt && (
                  <a className="btn btn-sm" href={`/p/${p.id}`} target="_blank" rel="noreferrer">
                    View ↗
                  </a>
                )}
                <button className="btn btn-sm" onClick={() => duplicate(p)}>
                  Duplicate
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <TemplatePicker templates={templates} busy={busy} onCreate={create} onClose={() => setShowNew(false)} />}

      {showCheck && <ConnectionCheck onClose={() => setShowCheck(false)} />}

      {embedFor && (
        <Modal title={`Embed "${embedFor.name}"`} onClose={() => setEmbedFor(null)} width={640}>
          <EmbedInstructions pageId={embedFor.id} published={!!embedFor.publishedAt} />
        </Modal>
      )}

      {leadsFor && (
        <Modal title={`Leads: ${leadsFor.name}`} onClose={() => setLeadsFor(null)} width={820}>
          {leads === null ? (
            <p className="muted">Loading…</p>
          ) : leads.length === 0 ? (
            <p className="muted">No submissions yet. Leads also appear as contacts in your HighLevel CRM.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => (
                    <tr key={i}>
                      <td>{new Date(l.at).toLocaleString()}</td>
                      <td>{l.fields.name || [l.fields.firstName, l.fields.lastName].filter(Boolean).join(" ")}</td>
                      <td>{l.fields.email}</td>
                      <td>{l.fields.phone}</td>
                      <td title={l.error || ""}>{l.contactId ? <span className="pill ok">Synced</span> : <span className="pill warn">Not synced</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

interface SavedTemplate {
  id: string;
  name: string;
  kind: "section" | "page";
  category: string;
  thumbnail?: string;
  ownerType: "location" | "company";
}

/** Template picker with live previews rendered in the sub-account's brand kit. */
function TemplatePicker({ templates, busy, onCreate, onClose }: {
  templates: TemplateRow[];
  busy: string;
  onCreate: (templateId: string, name: string, libraryId?: string) => void;
  onClose: () => void;
}) {
  const { api } = useSession();
  const [tab, setTab] = useState<"builtin" | "saved">("builtin");
  const [cat, setCat] = useState("All");
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<TemplateRow | null>(null);
  const [saved, setSaved] = useState<SavedTemplate[] | null>(null);

  useEffect(() => {
    templates.forEach((t) => {
      api<{ html: string; css: string; fontUrl: string }>(`/api/templates/preview?id=${encodeURIComponent(t.id)}`)
        .then((r) => setDocs((d) => ({ ...d, [t.id]: previewDoc(r) })))
        .catch(() => {});
    });
    api<{ items: SavedTemplate[] }>("/api/library")
      .then((r) => setSaved(r.items.filter((i) => i.kind === "page")))
      .catch(() => setSaved([]));
  }, [api, templates]);

  const cats = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];
  const shown = templates.filter((t) => cat === "All" || t.category === cat);

  return (
    <Modal title="Create a new page" onClose={onClose} width={980}>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={tab === "builtin" ? "active" : ""} onClick={() => setTab("builtin")}>
          Templates
        </button>
        <button className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}>
          My templates{saved ? ` (${saved.length})` : ""}
        </button>
      </div>
      {tab === "builtin" ? (
        <>
          <div className="tpl-filters">
            {cats.map((c) => (
              <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="tpl-grid">
            {shown.map((t) => (
              <div key={t.id} className="tpl">
                <button className="tpl-open" disabled={!!busy} onClick={() => setPreview(t)} title="Preview">
                  {docs[t.id] && t.id !== "blank" ? (
                    <div className="tpl-live">
                      <iframe srcDoc={docs[t.id]} title={t.name} tabIndex={-1} loading="lazy" />
                    </div>
                  ) : (
                    <div className="tpl-thumb" style={{ background: t.thumbnail }}>
                      {t.name}
                    </div>
                  )}
                </button>
                <div className="tpl-body">
                  <b>{t.name}</b>
                  <p className="muted">{t.description}</p>
                  <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => onCreate(t.id, t.id === "blank" ? "Untitled page" : t.name)}>
                    {busy === t.id ? "Creating…" : "Use this template"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : saved === null ? (
        <p className="muted">Loading…</p>
      ) : saved.length === 0 ? (
        <p className="muted">No saved page templates yet. In the editor, open the Library tab and choose “Save this page as a template”.</p>
      ) : (
        <div className="tpl-grid">
          {saved.map((t) => (
            <div key={t.id} className="tpl">
              {t.thumbnail ? <img className="tpl-thumb tpl-img" src={t.thumbnail} alt="" /> : <div className="tpl-thumb">{t.name}</div>}
              <div className="tpl-body">
                <b>{t.name}</b>
                <p className="muted">{[t.category, t.ownerType === "company" ? "Shared by your agency" : ""].filter(Boolean).join(" · ") || "Saved page"}</p>
                <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => onCreate("", t.name, t.id)}>
                  {busy === t.id ? "Creating…" : "Use this template"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)} width={1100}>
          {docs[preview.id] ? <iframe className="tpl-preview-frame" srcDoc={docs[preview.id]} title={preview.name} /> : <p className="muted">Loading preview…</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => onCreate(preview.id, preview.name)}>
              {busy === preview.id ? "Creating…" : "Use this template"}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

/** Standalone preview document; widgets render statically (no scripts). */
function previewDoc(r: { html: string; css: string; fontUrl: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${r.fontUrl}"><link rel="stylesheet" href="${origin}/runtime.css"><style>body{margin:0}${r.css}</style></head><body class="gpb-root">${r.html}</body></html>`;
}

interface CheckRow {
  id: string;
  label: string;
  usedFor: string;
  scope: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

/** Calls every HighLevel API PageForge uses and shows what works and what's missing. */
function ConnectionCheck({ onClose }: { onClose: () => void }) {
  const { api } = useSession();
  const [res, setRes] = useState<{ installed: boolean; checks: CheckRow[]; message?: string } | null>(null);
  const [error, setError] = useState("");
  const run = useCallback(() => {
    setRes(null);
    setError("");
    api<{ installed: boolean; checks: CheckRow[]; message?: string }>("/api/highlevel/check")
      .then(setRes)
      .catch((e) => setError((e as Error).message));
  }, [api]);
  useEffect(run, [run]);
  const failing = res?.checks.filter((c) => !c.ok) ?? [];
  return (
    <Modal title="HighLevel connection" onClose={onClose} width={720}>
      {error && <p className="error">{error}</p>}
      {!res && !error && <p className="muted">Checking each HighLevel API PageForge uses…</p>}
      {res && !res.installed && <div className="notice warn">{res.message}</div>}
      {res?.installed && (
        <>
          <p className="muted">
            {failing.length === 0
              ? "Everything PageForge uses is working for this sub-account."
              : `${failing.length} of ${res.checks.length} checks need attention. Features that depend on them are hidden or empty until fixed.`}
          </p>
          <div className="table-wrap">
            <table className="table check-table">
              <thead>
                <tr>
                  <th>API</th>
                  <th>Used for</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {res.checks.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.label}</b>
                      <div className="muted check-scope">{c.scope}</div>
                    </td>
                    <td>{c.usedFor}</td>
                    <td>
                      <span className={`pill ${c.ok ? "ok" : "warn"}`}>{c.ok ? "✓ " : "✗ "}{c.detail}</span>
                      {c.fix && <p className="check-fix">{c.fix}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="check-foot">
        <button className="btn btn-sm" onClick={run}>
          Run again
        </button>
      </div>
    </Modal>
  );
}
