"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface SessionUser {
  locationId: string;
  companyId?: string;
  userName?: string;
  email?: string;
  userType?: "agency" | "location";
}

type ApiFn = <T = any>(path: string, init?: Omit<RequestInit, "body"> & { body?: unknown }) => Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface SessionCtx {
  user: SessionUser;
  api: ApiFn;
}

const Ctx = createContext<SessionCtx | null>(null);
const CACHE_KEY = "gpb-session";

const storage = {
  get() {
    try {
      return sessionStorage.getItem(CACHE_KEY);
    } catch {
      return null;
    }
  },
  set(v: string) {
    try {
      sessionStorage.setItem(CACHE_KEY, v);
    } catch {}
  },
  clear() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch {}
  },
};

function tokenExp(token: string): number {
  try {
    const body = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(body)).exp ?? 0;
  } catch {
    return 0;
  }
}

type State =
  | { status: "loading" }
  | { status: "ready"; token: string; user: SessionUser }
  | { status: "dev" }
  | { status: "error"; error: string };

/**
 * Authenticates the Custom Page:
 * 1. Inside HighLevel → asks the parent window for encrypted user context (REQUEST_USER_DATA),
 *    which the server decrypts with the app's Shared Secret and turns into a signed session.
 * 2. Outside HighLevel with ALLOW_DEV_LOGIN=true → shows a dev login with a location id.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const accept = useCallback((token: string, user: SessionUser) => {
    storage.set(JSON.stringify({ token, user }));
    setState({ status: "ready", token, user });
  }, []);

  useEffect(() => {
    const cached = storage.get();
    if (cached) {
      try {
        const { token, user } = JSON.parse(cached);
        if (tokenExp(token) > Date.now() / 1000 + 60) {
          setState({ status: "ready", token, user });
          return;
        }
      } catch {}
    }

    let settled = false;
    const fallback = async () => {
      if (settled) return;
      settled = true;
      const { enabled } = await fetch("/api/auth/dev")
        .then((r) => r.json())
        .catch(() => ({ enabled: false }));
      setState(
        enabled
          ? { status: "dev" }
          : { status: "error", error: "Please open PageForge from the left menu of your HighLevel sub-account." },
      );
    };

    const onMessage = async (e: MessageEvent) => {
      if (e.data?.message !== "REQUEST_USER_DATA_RESPONSE" || settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      const res = await fetch("/api/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: e.data.payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) accept(data.token, data.user);
      else setState({ status: "error", error: data.error || "Authentication failed" });
    };

    if (window.self !== window.top) {
      window.addEventListener("message", onMessage);
      window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
      const t = setTimeout(fallback, 6000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("message", onMessage);
      };
    }
    fallback();
  }, [accept]);

  const token = state.status === "ready" ? state.token : "";
  const api = useCallback<ApiFn>(
    async (path, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      let body: BodyInit | undefined;
      if (init.body instanceof FormData) body = init.body;
      else if (init.body !== undefined) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(init.body);
      }
      const res = await fetch(path, { ...init, headers, body });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        storage.clear();
        setState({ status: "error", error: data.error || "Session expired. Please reload the app." });
      }
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    },
    [token],
  );

  if (state.status === "loading") return <FullScreen>Connecting to HighLevel…</FullScreen>;
  if (state.status === "error") return <FullScreen>{state.error}</FullScreen>;
  if (state.status === "dev") return <DevLogin onLogin={accept} />;
  return <Ctx.Provider value={{ user: state.user, api }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="center-screen">
      <div className="center-card">
        <img className="logo-mark" src="/logo.svg" alt="PageForge" />
        <p>{children}</p>
      </div>
    </div>
  );
}

function DevLogin({ onLogin }: { onLogin: (token: string, user: SessionUser) => void }) {
  const [locationId, setLocationId] = useState("dev-location");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId }),
    });
    const data = await res.json();
    if (res.ok) onLogin(data.token, data.user);
    else setError(data.error);
  };
  return (
    <div className="center-screen">
      <form className="center-card" onSubmit={submit}>
        <img className="logo-mark" src="/logo.svg" alt="PageForge" />
        <h2>Developer login</h2>
        <p className="muted">
          You are outside HighLevel and <code>ALLOW_DEV_LOGIN=true</code>. Enter a sub-account (location) id. Use a real
          location id where the app is installed to test CRM features.
        </p>
        <input className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Continue
        </button>
      </form>
    </div>
  );
}
