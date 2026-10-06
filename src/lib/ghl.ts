import { config, GHL_API, GHL_API_VERSION } from "./config";
import { num, query } from "./db";

/** Stored OAuth installation (one per sub-account, plus one per agency for bulk installs). */
export interface Install {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
  userType: "Location" | "Company";
  locationId?: string;
  companyId?: string;
  scope?: string;
  installedAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  userType: "Location" | "Company";
  locationId?: string;
  companyId?: string;
}

const locKey = (locationId: string) => `loc:${locationId}`;
const coKey = (companyId: string) => `co:${companyId}`;

interface InstallRow {
  user_type: "Location" | "Company";
  location_id: string | null;
  company_id: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: unknown;
  scope: string | null;
  installed_at: unknown;
}

function fromRow(r: InstallRow): Install {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: num(r.expires_at),
    userType: r.user_type,
    locationId: r.location_id ?? undefined,
    companyId: r.company_id ?? undefined,
    scope: r.scope ?? undefined,
    installedAt: num(r.installed_at),
  };
}

async function readInstall(key: string): Promise<Install | null> {
  const rows = await query<InstallRow>("SELECT * FROM installs WHERE key = $1", [key]);
  return rows[0] ? fromRow(rows[0]) : null;
}

function toInstall(t: TokenResponse): Install {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in - 300) * 1000,
    userType: t.userType,
    locationId: t.locationId,
    companyId: t.companyId,
    scope: t.scope,
    installedAt: Date.now(),
  };
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${GHL_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OAuth token error ${res.status}: ${JSON.stringify(data)}`);
  return data as TokenResponse;
}

/** Exchanges the authorization code received on install and stores the tokens. */
export async function exchangeCode(code: string): Promise<Install> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri });
  const install = toInstall(t);
  await saveInstall(install);
  return install;
}

export async function saveInstall(install: Install) {
  const key =
    install.userType === "Location" && install.locationId
      ? locKey(install.locationId)
      : install.userType === "Company" && install.companyId
        ? coKey(install.companyId)
        : null;
  if (!key) return;
  await query(
    `INSERT INTO installs (key, user_type, location_id, company_id, access_token, refresh_token, expires_at, scope, installed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (key) DO UPDATE SET
       access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at, scope = EXCLUDED.scope, user_type = EXCLUDED.user_type`,
    [
      key,
      install.userType,
      install.locationId ?? null,
      install.companyId ?? null,
      install.accessToken,
      install.refreshToken,
      install.expiresAt,
      install.scope ?? null,
      install.installedAt,
    ],
  );
}

export async function removeInstall(locationId?: string, companyId?: string) {
  if (locationId) await query("DELETE FROM installs WHERE key = $1", [locKey(locationId)]);
  else if (companyId) await query("DELETE FROM installs WHERE key = $1", [coKey(companyId)]);
}

export async function getInstall(locationId: string): Promise<Install | null> {
  return readInstall(locKey(locationId));
}

async function refresh(install: Install): Promise<Install> {
  const t = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: install.refreshToken,
    user_type: install.userType,
  });
  const next = { ...toInstall(t), installedAt: install.installedAt };
  await saveInstall(next);
  return next;
}

/** For agency (bulk) installs: mint a sub-account token from the agency token. */
async function locationTokenFromCompany(companyId: string, locationId: string): Promise<Install | null> {
  let company = await readInstall(coKey(companyId));
  if (!company) return null;
  if (company.expiresAt < Date.now()) company = await refresh(company);
  const res = await fetch(`${GHL_API}/oauth/locationToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${company.accessToken}`,
      Version: GHL_API_VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ companyId, locationId }),
  });
  if (!res.ok) return null;
  const install = toInstall((await res.json()) as TokenResponse);
  await saveInstall(install);
  return install;
}

/** Returns a valid access token for a sub-account, refreshing / minting as needed. */
export async function getLocationToken(locationId: string, companyId?: string): Promise<string | null> {
  let install = await getInstall(locationId);
  if (!install && companyId) install = await locationTokenFromCompany(companyId, locationId);
  if (!install) return null;
  if (install.expiresAt < Date.now()) install = await refresh(install);
  return install.accessToken;
}

export class GhlNotInstalledError extends Error {
  constructor() {
    super("The app is not installed for this sub-account (no OAuth token found).");
  }
}

/** Authenticated call to the HighLevel API on behalf of a sub-account. */
export async function ghlFetch<T = unknown>(
  locationId: string,
  pathname: string,
  init: RequestInit = {},
  companyId?: string,
): Promise<T> {
  const token = await getLocationToken(locationId, companyId);
  if (!token) throw new GhlNotInstalledError();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Version", GHL_API_VERSION);
  headers.set("Accept", "application/json");
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${GHL_API}${pathname}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`HighLevel API ${res.status} ${pathname}: ${text.slice(0, 300)}`);
  return data as T;
}
