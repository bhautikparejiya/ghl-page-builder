import { NextResponse } from "next/server";
import { BLUEPRINTS, toRendered } from "@/lib/blueprints";
import { kitCss } from "@/lib/brandkit";
import { handle, HttpError, requireSession } from "@/lib/http";
import { getKit } from "@/lib/kits";
import { fontUrlFor } from "@/lib/theme";

/** A built-in template rendered with this sub-account's brand kit, for live previews in the template picker. */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const id = new URL(req.url).searchParams.get("id");
  const bp = BLUEPRINTS.find((b) => b.id === id);
  if (!bp) throw new HttpError(404, "Unknown template");
  const { kit } = await getKit(s.locationId, s.companyId);
  const { html, css } = toRendered(bp.nodes);
  return NextResponse.json({ html, css: kitCss(kit) + css, fontUrl: fontUrlFor([kit.fonts.heading, kit.fonts.body]) });
});
