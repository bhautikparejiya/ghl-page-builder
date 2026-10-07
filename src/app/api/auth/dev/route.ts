import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { handle, HttpError } from "@/lib/http";
import { createSessionToken } from "@/lib/session";

/** Local-testing login (ALLOW_DEV_LOGIN=true). Lets you use the editor outside HighLevel. */
export const POST = handle(async (req: Request) => {
  if (!config.allowDevLogin) throw new HttpError(403, "Dev login is disabled");
  const { locationId } = (await req.json()) as { locationId?: string };
  if (!locationId) throw new HttpError(400, "locationId is required");
  // Dev sessions act as an agency admin so agency-wide features can be tested locally.
  const user = { locationId, companyId: "dev-company", userName: "Developer", role: "admin", userType: "agency" as const };
  return NextResponse.json({ token: createSessionToken(user), user });
});

export async function GET() {
  return NextResponse.json({ enabled: config.allowDevLogin });
}
