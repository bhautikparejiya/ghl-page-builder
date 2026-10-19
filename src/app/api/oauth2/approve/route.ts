import { NextResponse } from "next/server";
import { handle, HttpError, requireSession } from "@/lib/http";
import { decideByCode, findPendingByCode, OAuthError } from "@/lib/oauth";

/** Inside PageForge: look up a pairing code, then approve or decline it for this sub-account. */
export const POST = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json().catch(() => ({}))) as { code?: string; action?: "lookup" | "approve" | "deny" };
  try {
    if (body.action === "lookup") return NextResponse.json(await findPendingByCode(String(body.code ?? "")));
    if (body.action === "approve" || body.action === "deny") {
      await decideByCode(String(body.code ?? ""), body.action === "approve", {
        locationId: s.locationId,
        companyId: s.companyId,
        userName: s.userName || s.email || s.userId,
      });
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    if (e instanceof OAuthError) throw new HttpError(e.status, e.message);
    throw e;
  }
  throw new HttpError(400, "Unknown action");
});
