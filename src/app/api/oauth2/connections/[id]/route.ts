import { NextResponse } from "next/server";
import { handle, HttpError, requireSession } from "@/lib/http";
import { disconnect } from "@/lib/oauth";

type Ctx = { params: Promise<{ id: string }> };

/** Disconnects an AI app: its tokens stop working immediately. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const s = requireSession(req);
  if (!(await disconnect(s.locationId, (await params).id))) throw new HttpError(404, "Connection not found");
  return NextResponse.json({ ok: true });
});
