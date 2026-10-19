/**
 * OAuth 2.1 authorization server for the MCP endpoint (RFC 8414 metadata, RFC 7591 dynamic client
 * registration, PKCE S256, rotating refresh tokens, RFC 7009 revocation).
 *
 * PageForge users are only signed in inside HighLevel, so the authorize page can't see who they are.
 * Instead it shows a pairing code; the user approves it in PageForge → AI & MCP, and the authorize
 * page (which polls) then redirects back to the AI app with an authorization code.
 */
import crypto from "node:crypto";
import { config } from "./config";
import { num, query } from "./db";
import { newId } from "./pages";

export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const REQUEST_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
export const SCOPE = "pages";

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const b64url = (buf: Buffer) => buf.toString("base64url");

/* ── Discovery ── */

export const issuer = () => config.appUrl;
export const mcpResource = () => `${config.appUrl}/api/mcp`;

export function authServerMetadata() {
  const base = issuer();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth2/token`,
    registration_endpoint: `${base}/api/oauth2/register`,
    revocation_endpoint: `${base}/api/oauth2/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${base}/`,
  };
}

export function resourceMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [issuer()],
    bearer_methods_supported: ["header"],
    scopes_supported: [SCOPE],
    resource_name: "PageForge",
  };
}

/** Header for 401s from the MCP endpoint, pointing clients at the metadata above. */
export const wwwAuthenticate = (error?: "invalid_token") =>
  `Bearer resource_metadata="${config.appUrl}/.well-known/oauth-protected-resource/api/mcp"${error ? `, error="${error}"` : ""}`;

/* ── Clients (dynamic registration) ── */

export interface OAuthClient {
  clientId: string;
  name: string;
  redirectUris: string[];
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https anywhere, http only on loopback, or an app's own scheme (cursor://, vscode://…). */
function validRedirect(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return LOOPBACK.has(u.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["javascript:", "data:", "file:", "vbscript:", "blob:"].includes(u.protocol);
}

export async function registerClient(body: Record<string, unknown>): Promise<OAuthClient & { raw: Record<string, unknown> }> {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 10 || !uris.every(validRedirect)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris must be https URLs, http loopback URLs or app URLs.");
  }
  const auth = body.token_endpoint_auth_method;
  if (auth !== undefined && auth !== "none") throw new OAuthError("invalid_client_metadata", "Only public clients (token_endpoint_auth_method: none) are supported.");
  const name = String(body.client_name || "AI app").replace(/[<>]/g, "").slice(0, 80);
  const client: OAuthClient = { clientId: `pfc_${newId(24)}`, name, redirectUris: uris };
  const now = Date.now();
  await query("INSERT INTO oauth_clients (client_id, name, redirect_uris, created_at) VALUES ($1, $2, $3::jsonb, $4)", [
    client.clientId,
    name,
    JSON.stringify(uris),
    now,
  ]);
  return {
    ...client,
    raw: {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(now / 1000),
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
    },
  };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const rows = await query<{ client_id: string; name: string; redirect_uris: string[] }>("SELECT * FROM oauth_clients WHERE client_id = $1", [clientId]);
  return rows[0] ? { clientId: rows[0].client_id, name: rows[0].name, redirectUris: rows[0].redirect_uris } : null;
}

/** Exact match, except that loopback redirects may use any port (RFC 8252 §7.3). */
function redirectAllowed(client: OAuthClient, uri: string): boolean {
  if (client.redirectUris.includes(uri)) return true;
  try {
    const u = new URL(uri);
    if (u.protocol !== "http:" || !LOOPBACK.has(u.hostname)) return false;
    return client.redirectUris.some((r) => {
      const x = new URL(r);
      return x.protocol === "http:" && x.hostname === u.hostname && x.pathname === u.pathname && x.search === u.search;
    });
  } catch {
    return false;
  }
}

/* ── Authorization requests and pairing codes ── */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function userCode(): string {
  const bytes = crypto.randomBytes(8);
  const c = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
export const normalizeUserCode = (v: unknown) => {
  const c = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : "";
};

export interface StartParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}

/**
 * Validates an authorization request. Errors about the client or redirect URI are shown on the page
 * (never redirected, per RFC 6749 §4.1.2.1); other errors are sent back to the app's redirect URI.
 */
export async function startAuthorization(p: StartParams) {
  const client = p.client_id ? await getClient(p.client_id) : null;
  if (!client) throw new OAuthError("invalid_client", "This app isn't registered with PageForge. Try connecting again from the app.");
  if (!p.redirect_uri || !redirectAllowed(client, p.redirect_uri)) throw new OAuthError("invalid_request", "The app sent a redirect address PageForge doesn't recognise.");
  const back = (error: string, description: string) => ({ redirect: redirectWith(p.redirect_uri!, { error, error_description: description, state: p.state }) });
  if (p.response_type !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  if (!p.code_challenge || p.code_challenge_method !== "S256") return back("invalid_request", "PKCE with code_challenge_method=S256 is required.");

  await query("DELETE FROM oauth_requests WHERE expires_at < $1", [Date.now() - 60 * 60 * 1000]);
  const browserSecret = b64url(crypto.randomBytes(24));
  const now = Date.now();
  const req = { id: newId(20), userCode: userCode(), expiresAt: now + REQUEST_TTL_MS };
  await query(
    `INSERT INTO oauth_requests (id, browser_hash, client_id, redirect_uri, code_challenge, state, scope, user_code, status, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)`,
    [req.id, sha(browserSecret), client.clientId, p.redirect_uri, p.code_challenge.slice(0, 128), p.state?.slice(0, 500) ?? null, SCOPE, req.userCode, now, req.expiresAt],
  );
  return { requestId: req.id, browserSecret, userCode: req.userCode, expiresAt: req.expiresAt, clientName: client.name, redirectHost: hostOf(p.redirect_uri) };
}

const hostOf = (uri: string) => {
  try {
    const u = new URL(uri);
    return u.host || u.protocol.replace(/:$/, "");
  } catch {
    return uri;
  }
};

function redirectWith(uri: string, params: Record<string, string | undefined | null>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  u.searchParams.set("iss", issuer());
  return u.toString();
}

interface RequestRow {
  id: string;
  browser_hash: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state: string | null;
  user_code: string;
  status: "pending" | "approved" | "denied" | "redirected" | "used";
  location_id: string | null;
  company_id: string | null;
  user_name: string | null;
  expires_at: unknown;
}

/** Called by the authorize page while it waits. Returns where to send the browser once the user decided. */
export async function pollAuthorization(id: string, browserSecret: string): Promise<{ status: "pending" | "expired" } | { status: "done"; redirect: string }> {
  const rows = await query<RequestRow>("SELECT * FROM oauth_requests WHERE id = $1 AND browser_hash = $2", [id, sha(browserSecret)]);
  const r = rows[0];
  if (!r) throw new OAuthError("invalid_request", "Unknown request", 404);
  const expired = num(r.expires_at) < Date.now();
  if (r.status === "pending") {
    if (!expired) return { status: "pending" };
    return { status: "done", redirect: redirectWith(r.redirect_uri, { error: "access_denied", error_description: "The code expired before it was approved.", state: r.state }) };
  }
  if (r.status === "denied") return { status: "done", redirect: redirectWith(r.redirect_uri, { error: "access_denied", error_description: "The connection was declined in PageForge.", state: r.state }) };
  if (r.status !== "approved") return { status: "expired" };
  // Issue the authorization code exactly once.
  const code = b64url(crypto.randomBytes(32));
  const updated = await query<{ id: string }>(
    "UPDATE oauth_requests SET status = 'redirected', code_hash = $2, expires_at = $3 WHERE id = $1 AND status = 'approved' RETURNING id",
    [r.id, sha(code), Date.now() + CODE_TTL_MS],
  );
  if (!updated.length) return { status: "expired" };
  return { status: "done", redirect: redirectWith(r.redirect_uri, { code, state: r.state }) };
}

/** Cancel from the authorize page. */
export async function cancelAuthorization(id: string, browserSecret: string) {
  await query("UPDATE oauth_requests SET status = 'denied' WHERE id = $1 AND browser_hash = $2 AND status = 'pending'", [id, sha(browserSecret)]);
}

/** What the user is about to approve, looked up by pairing code inside PageForge. */
export async function findPendingByCode(code: string) {
  const c = normalizeUserCode(code);
  if (!c) throw new OAuthError("invalid_request", "Enter the 8-character code shown by the AI app.");
  const rows = await query<RequestRow & { name: string }>(
    `SELECT r.*, c.name FROM oauth_requests r JOIN oauth_clients c ON c.client_id = r.client_id
      WHERE r.user_code = $1 AND r.status = 'pending' AND r.expires_at > $2`,
    [c, Date.now()],
  );
  if (!rows[0]) throw new OAuthError("invalid_request", "That code is wrong or has expired. Start the connection again in your AI app.", 404);
  return { userCode: c, clientName: rows[0].name, redirectHost: hostOf(rows[0].redirect_uri) };
}

export async function decideByCode(code: string, approve: boolean, who: { locationId: string; companyId?: string; userName?: string }) {
  const c = normalizeUserCode(code);
  const rows = await query<{ id: string }>(
    `UPDATE oauth_requests SET status = $2, location_id = $3, company_id = $4, user_name = $5
      WHERE user_code = $1 AND status = 'pending' AND expires_at > $6 RETURNING id`,
    [c, approve ? "approved" : "denied", who.locationId, who.companyId ?? null, who.userName ?? null, Date.now()],
  );
  if (!rows[0]) throw new OAuthError("invalid_request", "That code is wrong or has expired. Start the connection again in your AI app.", 404);
}

/* ── Tokens ── */

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function newTokens() {
  return { access: `pfa_${newId(40)}`, refresh: `pfr_${newId(48)}` };
}

const tokenResponse = (t: { access: string; refresh: string }): TokenResponse => ({
  access_token: t.access,
  token_type: "Bearer",
  expires_in: ACCESS_TTL_MS / 1000,
  refresh_token: t.refresh,
  scope: SCOPE,
});

const pkceOk = (verifier: string, challenge: string) =>
  /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) && b64url(crypto.createHash("sha256").update(verifier).digest()) === challenge;

export async function exchangeCode(p: { code?: string; redirect_uri?: string; client_id?: string; code_verifier?: string }): Promise<TokenResponse> {
  if (!p.code || !p.code_verifier) throw new OAuthError("invalid_request", "code and code_verifier are required.");
  // Consume the code atomically so it can only be used once.
  const rows = await query<RequestRow>(
    "UPDATE oauth_requests SET status = 'used' WHERE code_hash = $1 AND status = 'redirected' RETURNING *",
    [sha(p.code)],
  );
  const r = rows[0];
  if (!r || num(r.expires_at) < Date.now()) throw new OAuthError("invalid_grant", "The authorization code is invalid or expired.");
  if (p.client_id && p.client_id !== r.client_id) throw new OAuthError("invalid_grant", "The code was issued to another client.");
  if (p.redirect_uri && p.redirect_uri !== r.redirect_uri) throw new OAuthError("invalid_grant", "redirect_uri doesn't match the authorization request.");
  if (!pkceOk(p.code_verifier, r.code_challenge)) throw new OAuthError("invalid_grant", "PKCE verification failed.");
  if (!r.location_id) throw new OAuthError("invalid_grant", "The request was not approved.");

  const t = newTokens();
  const now = Date.now();
  await query(
    `INSERT INTO oauth_tokens (id, client_id, location_id, company_id, user_name, access_hash, refresh_hash, access_expires_at, refresh_expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [newId(), r.client_id, r.location_id, r.company_id, r.user_name, sha(t.access), sha(t.refresh), now + ACCESS_TTL_MS, now + REFRESH_TTL_MS, now],
  );
  return tokenResponse(t);
}

/** Rotates both tokens. The old refresh token stops working. */
export async function refreshTokens(p: { refresh_token?: string; client_id?: string }): Promise<TokenResponse> {
  if (!p.refresh_token) throw new OAuthError("invalid_request", "refresh_token is required.");
  const t = newTokens();
  const now = Date.now();
  const rows = await query<{ client_id: string }>(
    `UPDATE oauth_tokens SET access_hash = $2, refresh_hash = $3, access_expires_at = $4, refresh_expires_at = $5
      WHERE refresh_hash = $1 AND refresh_expires_at > $6 ${p.client_id ? "AND client_id = $7" : ""} RETURNING client_id`,
    [sha(p.refresh_token), sha(t.access), sha(t.refresh), now + ACCESS_TTL_MS, now + REFRESH_TTL_MS, now, ...(p.client_id ? [p.client_id] : [])],
  );
  if (!rows[0]) throw new OAuthError("invalid_grant", "The refresh token is invalid or expired.");
  return tokenResponse(t);
}

export async function revokeToken(token: string) {
  const h = sha(token);
  await query("DELETE FROM oauth_tokens WHERE access_hash = $1 OR refresh_hash = $1", [h]);
}

/** Who an access token acts for, or null when it is unknown or expired. */
export async function verifyAccessToken(token: string): Promise<{ id: string; locationId: string; companyId?: string; name: string } | null> {
  if (!/^pfa_[A-Za-z0-9]{40}$/.test(token)) return null;
  const rows = await query<{ id: string; location_id: string; company_id: string | null; name: string | null; access_expires_at: unknown; last_used_at: unknown }>(
    `SELECT t.id, t.location_id, t.company_id, t.access_expires_at, t.last_used_at, c.name
       FROM oauth_tokens t LEFT JOIN oauth_clients c ON c.client_id = t.client_id WHERE t.access_hash = $1`,
    [sha(token)],
  );
  const r = rows[0];
  if (!r || num(r.access_expires_at) < Date.now()) return null;
  const last = r.last_used_at == null ? 0 : num(r.last_used_at);
  if (Date.now() - last > 60_000) await query("UPDATE oauth_tokens SET last_used_at = $2 WHERE id = $1", [r.id, Date.now()]).catch(() => undefined);
  return { id: r.id, locationId: r.location_id, companyId: r.company_id ?? undefined, name: r.name ?? "AI app" };
}

/* ── Connected apps (shown in AI & MCP) ── */

export async function listConnections(locationId: string) {
  const rows = await query<{ id: string; name: string | null; user_name: string | null; created_at: unknown; last_used_at: unknown }>(
    `SELECT t.id, c.name, t.user_name, t.created_at, t.last_used_at
       FROM oauth_tokens t LEFT JOIN oauth_clients c ON c.client_id = t.client_id
      WHERE t.location_id = $1 AND t.refresh_expires_at > $2 ORDER BY t.created_at DESC`,
    [locationId, Date.now()],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? "AI app",
    approvedBy: r.user_name ?? undefined,
    createdAt: num(r.created_at),
    lastUsedAt: r.last_used_at == null ? null : num(r.last_used_at),
  }));
}

export async function disconnect(locationId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM oauth_tokens WHERE id = $1 AND location_id = $2 RETURNING id", [id, locationId]);
  return rows.length > 0;
}
