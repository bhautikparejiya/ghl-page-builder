import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/apiKeys";
import { handle, HttpError, requireSession } from "@/lib/http";

export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  return NextResponse.json({ keys: await listApiKeys(s.locationId) });
});

/** Creates an API key for the MCP server. The token is in this response only. */
export const POST = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if ((await listApiKeys(s.locationId)).length >= 20) throw new HttpError(400, "This sub-account already has 20 keys. Revoke one first.");
  const { key, token } = await createApiKey({
    locationId: s.locationId,
    companyId: s.companyId,
    name: String(body.name ?? "").trim() || "AI assistant",
    createdBy: s.userName || s.email || s.userId,
  });
  return NextResponse.json({ key, token });
});
