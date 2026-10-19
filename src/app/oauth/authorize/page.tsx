"use client";

import { useEffect, useRef, useState } from "react";
import { DigicksCredit } from "@/components/ui";

type Start = { requestId: string; browserSecret: string; userCode: string; expiresAt: number; clientName: string; redirectHost: string };

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "waiting"; req: Start }
  | { kind: "redirecting"; approved: boolean };

const PARAMS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope"] as const;

async function call(body: unknown) {
  const res = await fetch("/api/oauth2/authorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || "Something went wrong.");
  return data;
}

/**
 * OAuth sign-in for AI apps. PageForge sessions live inside HighLevel, so instead of a login form this page
 * shows a pairing code. The user approves it in PageForge → AI & MCP, and this page sends them back to the app.
 */
export default function Authorize() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(PARAMS.map((k) => [k, q.get(k) ?? undefined]));
    call({ action: "start", params })
      .then((r) => {
        if (r.redirect) window.location.replace(r.redirect);
        else setState({ kind: "waiting", req: r as Start });
      })
      .catch((e) => setState({ kind: "error", message: (e as Error).message }));
  }, []);

  // Poll for the decision made inside PageForge.
  useEffect(() => {
    if (state.kind !== "waiting") return;
    const { requestId, browserSecret } = state.req;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const r = await call({ action: "poll", id: requestId, secret: browserSecret });
        if (r.status === "done") {
          setState({ kind: "redirecting", approved: !String(r.redirect).includes("error=") });
          window.location.replace(r.redirect);
          return;
        }
        if (r.status === "expired") {
          setState({ kind: "error", message: "This sign-in link was already used. Start the connection again from your AI app." });
          return;
        }
      } catch {
        /* network blip: keep polling */
      }
      setTimeout(tick, 2000);
    };
    const t = setTimeout(tick, 2000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearTimeout(t);
      clearInterval(clock);
    };
  }, [state]);

  const cancel = async () => {
    if (state.kind !== "waiting") return;
    const r = await call({ action: "cancel", id: state.req.requestId, secret: state.req.browserSecret }).catch(() => null);
    setState({ kind: "redirecting", approved: false });
    if (r?.redirect) window.location.replace(r.redirect);
  };

  return (
    <div className="oauth-page">
      <div className="center-card oauth-card">
        <img className="logo-mark big" src="/logo.svg" alt="PageForge" />
        {state.kind === "loading" && <p className="muted">Preparing sign-in…</p>}
        {state.kind === "error" && (
          <>
            <h1>Can&apos;t connect</h1>
            <p className="error">{state.message}</p>
          </>
        )}
        {state.kind === "redirecting" && (
          <>
            <h1>{state.approved ? "Connected ✓" : "Connection declined"}</h1>
            <p className="muted">Taking you back to your AI app…</p>
          </>
        )}
        {state.kind === "waiting" && (
          <>
            <h1>Connect {state.req.clientName} to PageForge</h1>
            <p className="muted">
              To approve, open <b>PageForge</b> in your HighLevel sub-account, click <b>AI &amp; MCP</b>, and enter this code under{" "}
              <b>Approve an AI app</b>:
            </p>
            <div className="oauth-code" aria-label="Pairing code">
              {state.req.userCode}
            </div>
            <p className="oauth-wait">
              <span className="oauth-spinner" aria-hidden="true" /> Waiting for approval
              {state.req.expiresAt > now && ` · expires in ${Math.ceil((state.req.expiresAt - now) / 60000)} min`}
            </p>
            <p className="muted oauth-small">
              {state.req.clientName} will be able to create, edit and publish pages and templates in the sub-account you approve it from. After
              approval you&apos;ll return to <b>{state.req.redirectHost}</b>.
            </p>
            <button type="button" className="btn" onClick={cancel}>
              Cancel
            </button>
          </>
        )}
      </div>
      <DigicksCredit className="dk-credit--page" />
    </div>
  );
}
