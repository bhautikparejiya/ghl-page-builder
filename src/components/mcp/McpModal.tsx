"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "../session";
import { CopyBox, Modal, timeAgo } from "../ui";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdBy?: string;
  createdAt: number;
  lastUsedAt: number | null;
}

interface Connection {
  id: string;
  name: string;
  approvedBy?: string;
  createdAt: number;
  lastUsedAt: number | null;
}

type Client = "claude" | "chatgpt" | "claude-code" | "cursor" | "vscode" | "other";

const CLIENTS: { id: Client; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "vscode", label: "VS Code" },
  { id: "other", label: "Other" },
];

const EXAMPLES = [
  "Create a landing page for a dental clinic's free whitening consultation, with a hero, three benefits, testimonials, FAQ and a lead form.",
  "Read my “Spring sale” page and rewrite the hero to be more urgent. Don't publish yet.",
  "Make a site header with links to Services, Pricing and Contact and a Book now button, and show it on all pages.",
  "Save a pricing section with three plans as a global section called “Pricing 2026”.",
];

/** Connect AI tools to the PageForge MCP server: sign-in approval, connected apps and API keys. */
export default function McpModal({ onClose }: { onClose: () => void }) {
  const { api } = useSession();
  const [client, setClient] = useState<Client>("claude");
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<{ userCode: string; clientName: string; redirectHost: string } | null>(null);
  const [approved, setApproved] = useState("");
  const [keyName, setKeyName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [c, k] = await Promise.all([api<{ connections: Connection[] }>("/api/oauth2/connections"), api<{ keys: KeyRow[] }>("/api/api-keys")]);
    setConnections(c.connections);
    setKeys(k.keys);
  }, [api]);

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lookup = () =>
    run(async () => {
      setApproved("");
      setPending(await api("/api/oauth2/approve", { method: "POST", body: { action: "lookup", code } }));
    });

  const decide = (approve: boolean) =>
    run(async () => {
      if (!pending) return;
      await api("/api/oauth2/approve", { method: "POST", body: { action: approve ? "approve" : "deny", code: pending.userCode } });
      setApproved(approve ? `${pending.clientName} is connected. Switch back to it: the sign-in page continues by itself.` : "Declined.");
      setPending(null);
      setCode("");
      // The app exchanges its code a moment later; refresh the list then.
      if (approve) setTimeout(() => load().catch(() => undefined), 4000);
    });

  const disconnect = (c: Connection) =>
    run(async () => {
      if (!confirm(`Disconnect ${c.name}? It loses access immediately.`)) return;
      await api(`/api/oauth2/connections/${c.id}`, { method: "DELETE" });
      await load();
    });

  const createKey = () =>
    run(async () => {
      const r = await api<{ token: string }>("/api/api-keys", { method: "POST", body: { name: keyName.trim() || "API key" } });
      setToken(r.token);
      setKeyName("");
      await load();
    });

  const revokeKey = (k: KeyRow) =>
    run(async () => {
      if (!confirm(`Revoke “${k.name}”? Tools using this key lose access immediately.`)) return;
      await api(`/api/api-keys/${k.id}`, { method: "DELETE" });
      await load();
    });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocal = /\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);
  const endpoint = `${origin}/api/mcp`;
  const key = token ?? "YOUR_API_KEY";

  return (
    <Modal title="AI & MCP" onClose={onClose} width={780}>
      <p className="muted">
        Connect Claude, ChatGPT, Cursor or any AI tool that supports MCP (Model Context Protocol). The AI can then create and edit pages, sections and site
        headers/footers in this sub-account with PageForge widgets, so everything it makes stays fully editable here.
      </p>

      <section className="mcp-block">
        <h4 className="kit-h">1. Add PageForge to your AI app</h4>
        {isLocal && <div className="notice warn">You&apos;re on a local address. Cloud AI apps (Claude, ChatGPT) can reach PageForge only once it&apos;s deployed.</div>}
        <p className="muted">Use this server URL:</p>
        <CopyBox value={endpoint} />
        <div className="tabs mcp-tabs">
          {CLIENTS.map((c) => (
            <button key={c.id} className={client === c.id ? "active" : ""} onClick={() => setClient(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="mcp-steps">
          {client === "claude" && (
            <p>
              In Claude (web or desktop app), open <b>Settings → Connectors → Add custom connector</b>, name it <b>PageForge</b>, paste the URL and click{" "}
              <b>Connect</b>.
            </p>
          )}
          {client === "chatgpt" && (
            <p>
              In ChatGPT, turn on <b>developer mode</b> in the connector settings, create a connector with the URL and choose <b>OAuth</b> authentication.
            </p>
          )}
          {client === "claude-code" && (
            <>
              <p>Run this in a terminal, then type /mcp in Claude Code and choose PageForge → Authenticate:</p>
              <CopyBox value={`claude mcp add --transport http pageforge ${endpoint}`} />
            </>
          )}
          {client === "cursor" && (
            <>
              <p>
                Add this to <code>~/.cursor/mcp.json</code>, then click <b>Connect</b> next to PageForge in Cursor&apos;s MCP settings:
              </p>
              <CopyBox value={JSON.stringify({ mcpServers: { pageforge: { url: endpoint } } }, null, 2)} multiline />
            </>
          )}
          {client === "vscode" && (
            <>
              <p>
                Add this to <code>.vscode/mcp.json</code> and start the server. VS Code asks you to sign in:
              </p>
              <CopyBox value={JSON.stringify({ servers: { pageforge: { type: "http", url: endpoint } } }, null, 2)} multiline />
            </>
          )}
          {client === "other" && (
            <p>
              Any MCP client that supports the <b>Streamable HTTP</b> transport with OAuth works with the URL above. For tools without OAuth, use an API key
              (Advanced, below).
            </p>
          )}
          <p className="muted">A PageForge sign-in page opens and shows a code. Enter that code in step 2.</p>
        </div>
      </section>

      <section className="mcp-block">
        <h4 className="kit-h">2. Approve an AI app</h4>
        {pending ? (
          <div className="mcp-confirm">
            <div>
              Allow <b>{pending.clientName}</b> (returning to {pending.redirectHost}) to create, edit and publish pages and templates in this sub-account?
            </div>
            <div className="mcp-confirm-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide(true)}>
                Allow
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => decide(false)}>
                Decline
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mcp-approve"
            onSubmit={(e) => {
              e.preventDefault();
              lookup();
            }}
          >
            <input className="input" placeholder="ABCD-2345" value={code} maxLength={9} onChange={(e) => setCode(e.target.value)} aria-label="Code from the sign-in page" />
            <button type="submit" className="btn btn-primary" disabled={busy || code.replace(/[^a-z0-9]/gi, "").length !== 8}>
              Continue
            </button>
          </form>
        )}
        {approved && <div className="notice ok-notice">{approved}</div>}

        <div className="mcp-sub">Connected apps</div>
        {connections && connections.length === 0 && <p className="muted mcp-hint">No AI apps connected yet.</p>}
        {connections && connections.length > 0 && (
          <ul className="mcp-keys">
            {connections.map((c) => (
              <li key={c.id}>
                <div>
                  <b>{c.name}</b>
                  <span className="muted">
                    {" "}
                    · connected {timeAgo(c.createdAt)}
                    {c.approvedBy ? ` by ${c.approvedBy}` : ""} · {c.lastUsedAt ? `last used ${timeAgo(c.lastUsedAt)}` : "not used yet"}
                  </span>
                </div>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => disconnect(c)}>
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mcp-block">
        <h4 className="kit-h">3. Ask for a page</h4>
        <ul className="mcp-examples">
          {EXAMPLES.map((e) => (
            <li key={e}>“{e}”</li>
          ))}
        </ul>
        <p className="muted">
          New pages are saved as drafts. Open them here to review, then publish. The AI publishes only when you ask it to, and every change it makes to an
          existing page is kept in Revision history.
        </p>
      </section>

      <details className="mcp-block mcp-advanced">
        <summary>Advanced: API keys for tools without OAuth sign-in</summary>
        {token ? (
          <div className="mcp-token">
            <div className="notice warn">Copy this key now. For your security it won&apos;t be shown again.</div>
            <CopyBox value={token} />
            <button type="button" className="btn btn-sm" onClick={() => setToken(null)}>
              Done, hide it
            </button>
          </div>
        ) : (
          <div className="mcp-create">
            <input className="input" placeholder="Key name, e.g. Zapier" value={keyName} maxLength={80} onChange={(e) => setKeyName(e.target.value)} />
            <button type="button" className="btn" disabled={busy} onClick={createKey}>
              Create key
            </button>
          </div>
        )}
        <p className="muted mcp-hint">
          Send it as <code>Authorization: Bearer {key}</code> to {endpoint}, or, if the tool accepts only a URL, use:
        </p>
        <CopyBox value={`${endpoint}/${key}`} />
        {keys && keys.length > 0 && (
          <ul className="mcp-keys">
            {keys.map((k) => (
              <li key={k.id}>
                <div>
                  <b>{k.name}</b> <code>{k.prefix}…</code>
                  <span className="muted">
                    {" "}
                    · created {timeAgo(k.createdAt)}
                    {k.createdBy ? ` by ${k.createdBy}` : ""} · {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : "never used"}
                  </span>
                </div>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => revokeKey(k)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted mcp-hint">Anyone with a key can edit and publish pages in this sub-account. Revoke keys you no longer use.</p>
      </details>

      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
