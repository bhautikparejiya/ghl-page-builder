import crypto from "node:crypto";
import { config } from "./config";

export interface Session {
  locationId: string;
  companyId?: string;
  userId?: string;
  userName?: string;
  email?: string;
  role?: string;
  exp: number; // unix seconds
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(data: string) {
  return crypto.createHmac("sha256", config.sessionSecret).update(data).digest("base64url");
}

/**
 * Stateless signed token (JWT-like). Sent as a Bearer header rather than a cookie,
 * because third-party cookies inside the HighLevel iframe are blocked by many browsers.
 */
export function createSessionToken(s: Omit<Session, "exp">, ttlSeconds = 60 * 60 * 12): string {
  const payload: Session = { ...s, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | null | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (!s.locationId || s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}
