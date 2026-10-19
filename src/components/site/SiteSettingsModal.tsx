"use client";

import { useCallback, useEffect, useState } from "react";
import type { SitePartRule, SiteSettings } from "@/lib/site";
import { useSession } from "../session";
import { Modal } from "../ui";

type Kind = "header" | "footer";

interface PartItem {
  id: string;
  name: string;
  kind: Kind;
  thumbnail?: string;
  ownerType: "location" | "company";
}

interface Starter {
  id: string;
  label: string;
  description: string;
}

type Mode = "off" | SitePartRule["mode"];

const MODE_LABEL: Record<Mode, string> = {
  off: "Not used",
  all: "All pages",
  include: "Only selected pages",
  exclude: "All pages except selected",
};

/**
 * Site-wide settings: header/footer templates with display rules, and custom CSS/JS for every page.
 * `onEditPart` opens a header/footer in the editor; `onSaved` lets the editor refresh its preview.
 */
export default function SiteSettingsModal({ onClose, onEditPart, onSaved }: {
  onClose: () => void;
  onEditPart: (id: string) => void;
  onSaved?: (site: SiteSettings) => void;
}) {
  const { api } = useSession();
  const [tab, setTab] = useState<"parts" | "code">("parts");
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [parts, setParts] = useState<PartItem[]>([]);
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [starters, setStarters] = useState<Record<Kind, Starter[]>>({ header: [], footer: [] });
  const [creating, setCreating] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [r, st] = await Promise.all([
      api<{ site: SiteSettings; parts: PartItem[]; pages: { id: string; name: string }[] }>("/api/site"),
      api<Record<Kind, Starter[]>>("/api/site/parts"),
    ]);
    setSite(r.site);
    setParts(r.parts);
    setPages(r.pages);
    setStarters(st);
  }, [api]);

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  if (!site) {
    return (
      <Modal title="Site settings" onClose={onClose} width={760}>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}
      </Modal>
    );
  }

  const listKey = (k: Kind): "headers" | "footers" => (k === "header" ? "headers" : "footers");
  const ruleOf = (k: Kind, id: string) => site[listKey(k)].find((r) => r.itemId === id);
  const setRule = (k: Kind, id: string, rule: Omit<SitePartRule, "itemId"> | null) => {
    const others = site[listKey(k)].filter((r) => r.itemId !== id);
    setSite({ ...site, [listKey(k)]: rule ? [...others, { itemId: id, ...rule }] : others });
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ site: SiteSettings }>("/api/site", { method: "PUT", body: site });
      setSite(r.site);
      setSaved(true);
      onSaved?.(r.site);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async (kind: Kind, template: string) => {
    setBusy(true);
    try {
      const { item } = await api<{ item: PartItem }>("/api/site/parts", { method: "POST", body: { kind, template } });
      // A brand-new part is used everywhere unless another rule already covers all pages.
      const hasAll = site[listKey(kind)].some((r) => r.mode === "all");
      const next = hasAll ? site : { ...site, [listKey(kind)]: [...site[listKey(kind)], { itemId: item.id, mode: "all" as const, pages: [] }] };
      await api("/api/site", { method: "PUT", body: next });
      onSaved?.(next);
      onEditPart(item.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const partList = (kind: Kind) => {
    const items = parts.filter((p) => p.kind === kind);
    return (
      <section className="site-parts">
        <div className="site-parts-head">
          <h4 className="kit-h">{kind === "header" ? "Headers" : "Footers"}</h4>
          <button type="button" className="btn btn-sm" onClick={() => setCreating(creating === kind ? null : kind)}>
            + New {kind}
          </button>
        </div>
        {creating === kind && (
          <div className="site-starters">
            {starters[kind].map((t) => (
              <button key={t.id} type="button" className="site-starter" disabled={busy} onClick={() => create(kind, t.id)}>
                <b>{t.label}</b>
                <span className="muted">{t.description}</span>
              </button>
            ))}
          </div>
        )}
        {items.length === 0 && creating !== kind && (
          <p className="muted">No {kind} yet. Create one and it appears on every page (you can limit it to specific pages).</p>
        )}
        {items.map((it) => {
          const rule = ruleOf(kind, it.id);
          const mode: Mode = rule?.mode ?? "off";
          return (
            <div key={it.id} className={`site-part${mode === "off" ? " is-off" : ""}`}>
              <div className="site-part-thumb">{it.thumbnail ? <img src={it.thumbnail} alt="" /> : <span>{kind}</span>}</div>
              <div className="site-part-main">
                <div className="site-part-row">
                  <b>{it.name}</b>
                  <button type="button" className="btn btn-sm" onClick={() => onEditPart(it.id)}>
                    Edit design
                  </button>
                </div>
                <label className="site-part-row">
                  <span className="muted">Display on</span>
                  <select
                    className="input"
                    value={mode}
                    onChange={(e) => {
                      const m = e.target.value as Mode;
                      setRule(kind, it.id, m === "off" ? null : { mode: m, pages: rule?.pages ?? [] });
                    }}
                  >
                    {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                      <option key={m} value={m}>
                        {MODE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
                {(mode === "include" || mode === "exclude") && (
                  <div className="site-pages">
                    {pages.length === 0 && <span className="muted">No pages yet.</span>}
                    {pages.map((p) => {
                      const on = rule?.pages.includes(p.id) ?? false;
                      return (
                        <label key={p.id} className={`site-page-chip${on ? " on" : ""}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              setRule(kind, it.id, {
                                mode,
                                pages: e.target.checked ? [...(rule?.pages ?? []), p.id] : (rule?.pages ?? []).filter((x) => x !== p.id),
                              })
                            }
                          />
                          {p.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    );
  };

  return (
    <Modal title="Site settings" onClose={onClose} width={760}>
      <div className="tabs site-tabs">
        <button className={tab === "parts" ? "active" : ""} onClick={() => setTab("parts")}>
          Header &amp; footer
        </button>
        <button className={tab === "code" ? "active" : ""} onClick={() => setTab("code")}>
          Custom code
        </button>
      </div>

      {tab === "parts" ? (
        <>
          <p className="muted">
            Headers and footers appear around every page they apply to, on hosted pages and custom domains. Edit one and every page updates, without
            republishing. A rule for specific pages wins over an “All pages” rule.
          </p>
          {partList("header")}
          {partList("footer")}
          <label className="check">
            <input type="checkbox" checked={site.inEmbeds} onChange={(e) => (setSite({ ...site, inEmbeds: e.target.checked }), setSaved(false))} />
            <span>Also show them on pages embedded in HighLevel funnels and websites (off by default, since funnels usually have their own).</span>
          </label>
          <p className="muted">Each page can hide the site header or footer in its own Page settings.</p>
        </>
      ) : (
        <div className="form-grid">
          <p className="muted">Added to every page in this sub-account. Each page can add its own code in Page settings. Code runs on live pages only, not in the editor.</p>
          <label className="field">
            <span>Global CSS</span>
            <textarea
              className="input code-area"
              rows={8}
              spellCheck={false}
              placeholder={".gpb-root h2 { letter-spacing: -0.02em; }"}
              value={site.css}
              onChange={(e) => (setSite({ ...site, css: e.target.value }), setSaved(false))}
            />
          </label>
          <label className="field">
            <span>Head code (analytics, pixels, meta tags)</span>
            <textarea
              className="input code-area"
              rows={6}
              spellCheck={false}
              placeholder="<!-- Google Analytics, Meta Pixel… -->"
              value={site.headCode}
              onChange={(e) => (setSite({ ...site, headCode: e.target.value }), setSaved(false))}
            />
          </label>
          <label className="field">
            <span>Body code (before &lt;/body&gt;: chat widgets, scripts)</span>
            <textarea
              className="input code-area"
              rows={6}
              spellCheck={false}
              placeholder="<script>…</script>"
              value={site.bodyCode}
              onChange={(e) => (setSite({ ...site, bodyCode: e.target.value }), setSaved(false))}
            />
          </label>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="kit-foot">
        <span className="muted">{saved ? "Saved ✓ Live pages update within about 30 seconds." : ""}</span>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save site settings"}
        </button>
      </div>
    </Modal>
  );
}
