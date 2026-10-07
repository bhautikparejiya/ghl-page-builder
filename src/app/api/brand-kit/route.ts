import { NextResponse } from "next/server";
import type { BrandKit } from "@/lib/brandkit";
import { handle, HttpError, requireSession } from "@/lib/http";
import { getAgencyKit, getKit, resetLocationKit, saveKit } from "@/lib/kits";
import { clearLocationCache, getLocationData } from "@/lib/locationData";

/** The sub-account's brand kit (or the agency default it inherits). */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const { kit, source } = await getKit(s.locationId, s.companyId);
  const isAgency = s.userType === "agency" && !!s.companyId;
  // Suggest the logo from the HighLevel business profile when the kit has none.
  let suggestedLogo: string | undefined;
  if (!kit.logoUrl) suggestedLogo = (await getLocationData(s.locationId, s.companyId).catch(() => null))?.logoUrl;
  return NextResponse.json({
    kit,
    source,
    suggestedLogo,
    canEditAgency: isAgency,
    agencyKit: isAgency ? await getAgencyKit(s.companyId!) : null,
  });
});

/** Saves the sub-account kit, or (agency users) the agency default kit. */
export const PUT = handle(async (req: Request) => {
  const s = requireSession(req);
  const body = (await req.json()) as { kit?: BrandKit; scope?: "location" | "agency" };
  if (!body.kit) throw new HttpError(400, "Missing kit");
  if (body.scope === "agency") {
    if (s.userType !== "agency" || !s.companyId) throw new HttpError(403, "Only agency users can change the agency brand kit.");
    return NextResponse.json({ kit: await saveKit("agency", s.companyId, body.kit) });
  }
  return NextResponse.json({ kit: await saveKit("location", s.locationId, body.kit) });
});

/** Drops the sub-account's own kit so it follows the agency default again. */
export const DELETE = handle(async (req: Request) => {
  const s = requireSession(req);
  await resetLocationKit(s.locationId);
  await clearLocationCache(s.locationId);
  return NextResponse.json(await getKit(s.locationId, s.companyId));
});
