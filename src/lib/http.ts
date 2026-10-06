import { NextResponse } from "next/server";
import { GhlNotInstalledError } from "./ghl";
import { getPage, PageDoc } from "./pages";
import { Session, verifySessionToken } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function requireSession(req: Request): Session {
  const auth = req.headers.get("authorization") ?? "";
  const session = verifySessionToken(auth.replace(/^Bearer\s+/i, ""));
  if (!session) throw new HttpError(401, "Session expired. Please reopen the app from HighLevel.");
  return session;
}

export async function requireOwnedPage(session: Session, id: string): Promise<PageDoc> {
  const page = await getPage(id);
  if (!page || page.locationId !== session.locationId) throw new HttpError(404, "Page not found");
  return page;
}

/** Wraps a route handler with uniform JSON error handling. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof GhlNotInstalledError) return NextResponse.json({ error: err.message }, { status: 409 });
      console.error(err);
      return NextResponse.json({ error: (err as Error).message || "Server error" }, { status: 500 });
    }
  };
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
