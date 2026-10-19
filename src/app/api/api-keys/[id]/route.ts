import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/apiKeys";
import { handle, HttpError, requireSession } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Revokes a key: AI tools using it lose access immediately. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  if (!(await revokeApiKey(s.locationId, (await params).id))) throw new HttpError(404, "Key not found");
  return NextResponse.json({ ok: true });
});
