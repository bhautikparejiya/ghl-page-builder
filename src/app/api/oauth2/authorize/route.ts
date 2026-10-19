import { NextResponse } from "next/server";
import { cancelAuthorization, pollAuthorization, startAuthorization, type StartParams } from "@/lib/oauth";
import { oauthHandle } from "@/lib/oauthHttp";

/**
 * Used by the /oauth/authorize page (same origin):
 * - { action: "start", params } validates the request and returns a pairing code
 * - { action: "poll", id, secret } returns the redirect once the user approved or declined in PageForge
 * - { action: "cancel", id, secret }
 */
export const POST = oauthHandle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { action?: string; params?: StartParams; id?: string; secret?: string };
  if (body.action === "start") return NextResponse.json(await startAuthorization(body.params ?? {}));
  if (body.action === "poll") return NextResponse.json(await pollAuthorization(String(body.id), String(body.secret)));
  if (body.action === "cancel") {
    await cancelAuthorization(String(body.id), String(body.secret));
    return NextResponse.json(await pollAuthorization(String(body.id), String(body.secret)));
  }
  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
});
