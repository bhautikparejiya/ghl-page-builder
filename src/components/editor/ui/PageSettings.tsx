"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageDoc, PageSettings } from "@/lib/pages";
import { useSession } from "../../session";
import { Modal, timeAgo } from "../../ui";

interface Domain {
  host: string;
  path: string;
}

export default function PageSettingsModal({ page, publishedAt, pickImage, onSaved, onClose }: {
  page: PageDoc;
  publishedAt: number | null;
  pickImage: () => Promise<string | null>;
  onSaved: (settings: PageSettings) => void;
  onClose: () => void;
}) {
  const { api } = useSession();
  const [s, setS] = useState<PageSettings>(page.settings);
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Page settings" onClose={onClose} width={620}>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/api/pages/${page.id}`, { method: "PUT", body: { settings: s } });
            onSaved(s);
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        <h4 className="kit-h">Search & sharing (hosted link and custom domains)</h4>
        <label className="field">
          <span>SEO title</span>
          <input className="input" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
        </label>
        <label className="field">
          <span>Meta description</span>
          <textarea className="input" rows={3} value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} />
        </label>
        <div className="field">
          <span>Social share image</span>
          <div className="kit-logo">
            {s.ogImage ? <img src={s.ogImage} alt="" /> : <span className="muted">None</span>}
            <button type="button" className="btn btn-sm" onClick={async () => setS({ ...s, ogImage: (await pickImage()) ?? s.ogImage })}>
              Choose…
            </button>
            {s.ogImage && (
              <button type="button" className="btn btn-sm" onClick={() => setS({ ...s, ogImage: "" })}>
                Remove
              </button>
            )}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={!!s.noindex} onChange={(e) => setS({ ...s, noindex: e.target.checked })} />
          <span>Hide from search engines (noindex)</span>
        </label>

        <h4 className="kit-h">Embedding in HighLevel</h4>
        <label className="field">
          <span>Embed mode</span>
          <select className="input" value={s.embedMode ?? "shadow"} onChange={(e) => setS({ ...s, embedMode: e.target.value as PageSettings["embedMode"] })}>
            <option value="shadow">Isolated (recommended): styles never clash with the funnel</option>
            <option value="inline">Inline: content is part of the funnel page (better for SEO tools; funnel styles may affect it)</option>
          </select>
        </label>

        <p className="muted">
          Page id: <code>{page.id}</code> · Last published: {timeAgo(publishedAt)}
        </p>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
      <Domains pageId={page.id} published={!!publishedAt} />
    </Modal>
  );
}

function Domains({ pageId, published }: { pageId: string; published: boolean }) {
  const { api } = useSession();
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [cname, setCname] = useState("");
  const [host, setHost] = useState("");
  const [path, setPath] = useState("/");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ domains: Domain[]; cnameTarget: string }>(`/api/pages/${pageId}/domains`);
    setDomains(r.domains);
    setCname(r.cnameTarget);
  }, [api, pageId]);
  useEffect(() => {
    load().catch((e) => setMsg((e as Error).message));
  }, [load]);

  return (
    <div className="domains">
      <h4 className="kit-h">Custom domain</h4>
      <p className="muted">
        Serve this page on your own domain, e.g. <code>offer.yourbusiness.com</code>. Point the domain at this app with a DNS <b>CNAME</b> record to{" "}
        <code>{cname || "…"}</code>, then add it here.
        {!published && " Publish the page first so there's something to show."}
      </p>
      {domains?.map((d) => (
        <div key={d.host + d.path} className="domain-row">
          <a href={`https://${d.host}${d.path}`} target="_blank" rel="noreferrer">
            {d.host}
            {d.path === "/" ? "" : d.path}
          </a>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={async () => {
              const r = await api<{ domains: Domain[] }>(`/api/pages/${pageId}/domains?host=${encodeURIComponent(d.host)}&path=${encodeURIComponent(d.path)}`, { method: "DELETE" });
              setDomains(r.domains);
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <form
        className="domain-add"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          try {
            const r = await api<{ domains: Domain[]; warning?: string }>(`/api/pages/${pageId}/domains`, { method: "POST", body: { host, path } });
            setDomains(r.domains);
            setHost("");
            setPath("/");
            setMsg(r.warning ?? "Domain added. It works as soon as DNS has updated (usually a few minutes).");
          } catch (err) {
            setMsg((err as Error).message);
          }
        }}
      >
        <input className="input" placeholder="offer.yourbusiness.com" value={host} onChange={(e) => setHost(e.target.value)} required />
        <input className="input domain-path" placeholder="/" value={path} onChange={(e) => setPath(e.target.value)} title="Path on that domain" />
        <button className="btn btn-sm" type="submit">
          Add
        </button>
      </form>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

/** A/B results for the selected section's test (shown in its Advanced tab). */
export function AbStats({ pageId, test }: { pageId: string; test: string }) {
  const { api } = useSession();
  const [rows, setRows] = useState<{ test: string; variant: string; views: number; conversions: number }[] | null>(null);
  const slug = test.trim().replace(/[^\w-]+/g, "-").slice(0, 40);
  const load = useCallback(() => {
    api<{ stats: { test: string; variant: string; views: number; conversions: number }[] }>(`/api/pages/${pageId}/ab`)
      .then((r) => setRows(r.stats.filter((x) => x.test === slug)))
      .catch(() => setRows([]));
  }, [api, pageId, slug]);
  useEffect(load, [load]);
  if (!slug) return null;
  const best = rows?.reduce((a, b) => (b.views && b.conversions / b.views > (a.views ? a.conversions / a.views : -1) ? b : a), rows[0]);
  return (
    <div className="ab-stats">
      <div className="ab-head">
        <b>A/B results: {slug}</b>
        <button type="button" className="wp-link-btn" onClick={load}>
          Refresh
        </button>
      </div>
      {!rows ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No visits yet. Results appear after the page is published and visited.</p>
      ) : (
        <table className="table ab-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Views</th>
              <th>Leads</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variant} className={r === best && rows.length > 1 && r.views > 0 ? "ab-best" : ""}>
                <td>{r.variant}</td>
                <td>{r.views}</td>
                <td>{r.conversions}</td>
                <td>{r.views ? `${((r.conversions / r.views) * 100).toFixed(1)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows && rows.length > 0 && (
        <button
          type="button"
          className="wp-link-btn"
          onClick={async () => {
            if (!confirm("Reset the counters for this test?")) return;
            await api(`/api/pages/${pageId}/ab?test=${encodeURIComponent(slug)}`, { method: "DELETE" });
            load();
          }}
        >
          Reset counters
        </button>
      )}
    </div>
  );
}
