import { NextResponse } from "next/server";
import { getLocationToken } from "@/lib/ghl";
import { handle, requireSession } from "@/lib/http";

/** Tells the UI whether this sub-account has a valid OAuth install (needed for forms → CRM, media, workflows). */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  let connected = false;
  try {
    connected = !!(await getLocationToken(s.locationId, s.companyId));
  } catch {
    connected = false;
  }
  return NextResponse.json({ connected, locationId: s.locationId });
});
