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

  const create = async (templateId: string, name: string) => {
    setBusy(templateId);
    try {
      const { page } = await api<{ page: { id: string } }>("/api/pages", { method: "POST", body: { templateId, name } });
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
            <span className={`pill ${connected ? "ok" : "warn"}`} title={`Location: ${user.locationId}`}>
              {connected ? "● CRM connected" : "● CRM not connected"}
            </span>
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

      {showNew && (
        <Modal title="Create a new page" onClose={() => setShowNew(false)} width={900}>
          <div className="tpl-grid">
            {templates.map((t) => (
              <button key={t.id} className="tpl" disabled={!!busy} onClick={() => create(t.id, t.id === "blank" ? "Untitled page" : t.name)}>
                <div className="tpl-thumb" style={{ background: t.thumbnail }}>
                  {busy === t.id ? "Creating…" : t.name}
                </div>
                <div className="tpl-body">
                  <b>{t.name}</b>
                  <p className="muted">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

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
