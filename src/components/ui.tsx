"use client";

import { useEffect, useState } from "react";

export function Modal({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function CopyBox({ value, multiline }: { value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="copy-box">
      {multiline ? <pre>{value}</pre> : <code>{value}</code>}
      <button className="btn btn-sm" onClick={copy}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

export function EmbedInstructions({ pageId, published }: { pageId: string; published: boolean }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<div data-gpb-page="${pageId}"></div>\n<script src="${origin}/loader.js" async></script>`;
  const hosted = `${origin}/p/${pageId}`;
  return (
    <div className="embed">
      {!published && <div className="notice warn">This page isn&apos;t published yet. Click Publish first, then embed.</div>}
      <h4>Option A: Embed in a HighLevel funnel or website page (recommended)</h4>
      <ol>
        <li>In HighLevel, open your funnel/website step in the builder.</li>
        <li>
          Add a <b>full-width section</b> and set its padding to 0. Then add a <b>Custom JS/HTML</b> element (named
          &quot;Code&quot; in some versions) and paste this code:
        </li>
      </ol>
      <CopyBox value={snippet} multiline />
      <ol start={3}>
        <li>Save and publish the HighLevel page. From now on, clicking <b>Publish</b> here updates it automatically, so you never need to paste again.</li>
      </ol>
      <h4>Option B: Hosted link</h4>
      <p className="muted">A standalone version of the page. It&apos;s useful for previews, sharing, or pointing a domain at it with a redirect.</p>
      <CopyBox value={hosted} />
      {published && (
        <a className="btn btn-sm" href={hosted} target="_blank" rel="noreferrer">
          Open live page ↗
        </a>
      )}
    </div>
  );
}

export function timeAgo(ts: number | null | undefined) {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}
