import { NextResponse } from "next/server";
import { ghlFetch } from "@/lib/ghl";
import { handle, requireSession } from "@/lib/http";

interface Workflow {
  id: string;
  name: string;
  status: string;
}

/** Lists the sub-account's workflows so forms can enroll new leads. */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const data = await ghlFetch<{ workflows: Workflow[] }>(
    s.locationId,
    `/workflows/?locationId=${encodeURIComponent(s.locationId)}`,
    {},
    s.companyId,
  );
  const workflows = (data.workflows ?? []).map(({ id, name, status }) => ({ id, name, status }));
  return NextResponse.json({ workflows });
});
