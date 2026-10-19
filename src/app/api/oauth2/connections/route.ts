import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/http";
import { listConnections } from "@/lib/oauth";

/** AI apps connected to this sub-account through OAuth. */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  return NextResponse.json({ connections: await listConnections(s.locationId) });
});
