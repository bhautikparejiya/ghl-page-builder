import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/http";
import { createSessionToken } from "@/lib/session";
import { decryptUserContext } from "@/lib/sso";

/** Exchanges the encrypted HighLevel user context for a signed editor session. */
export const POST = handle(async (req: Request) => {
  const { payload } = (await req.json()) as { payload?: string };
  if (!payload) throw new HttpError(400, "Missing payload");

  let ctx;
  try {
    ctx = decryptUserContext(payload);
  } catch (err) {
    throw new HttpError(401, (err as Error).message);
  }
  if (!ctx.activeLocation) {
    throw new HttpError(400, "Please open PageForge from inside a sub-account.");
  }

  const user = {
    locationId: ctx.activeLocation,
    companyId: ctx.companyId,
    userId: ctx.userId,
    userName: ctx.userName,
    email: ctx.email,
    role: ctx.role,
  };
  return NextResponse.json({ token: createSessionToken(user), user });
});
