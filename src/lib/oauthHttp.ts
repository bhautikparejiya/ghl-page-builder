import { NextResponse } from "next/server";
import { OAuthError } from "./oauth";

/** OAuth endpoints are called by AI apps from anywhere, including browser-based MCP clients. */
export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version",
  "Cache-Control": "no-store",
};

export const oauthJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: OAUTH_CORS });

export const preflight = async () => new Response(null, { status: 204, headers: OAUTH_CORS });

/** Form-encoded (standard) or JSON request body as a flat string map. */
export async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
  }
  return Object.fromEntries(new URLSearchParams(await req.text()));
}

/** Wraps an OAuth endpoint so errors use the RFC 6749 shape { error, error_description }. */
export function oauthHandle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof OAuthError) return oauthJson({ error: e.code, error_description: e.message }, e.status);
      console.error("[oauth]", e);
      return oauthJson({ error: "server_error", error_description: "Something went wrong." }, 500);
    }
  };
}
