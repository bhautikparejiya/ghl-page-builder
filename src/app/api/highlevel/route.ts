import { NextResponse } from "next/server";
import { ghlFetch } from "@/lib/ghl";
import { handle, requireSession } from "@/lib/http";

type Opt = { value: string; label: string };

/**
 * Data the editor needs from HighLevel for widget settings. Each list is loaded independently, so a missing
 * OAuth scope only empties that list (and is reported in `errors`).
 */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const loc = encodeURIComponent(s.locationId);
  const get = <T,>(path: string) => ghlFetch<T>(s.locationId, path, {}, s.companyId);

  const [calendars, pipelines, fields, values] = await Promise.allSettled([
    get<{ calendars: { id: string; name: string; isActive?: boolean }[] }>(`/calendars/?locationId=${loc}`),
    get<{ pipelines: { id: string; name: string; stages?: { id: string; name: string }[] }[] }>(`/opportunities/pipelines?locationId=${loc}`),
    get<{ customFields: { id: string; name: string; fieldKey?: string; dataType?: string; model?: string }[] }>(`/locations/${loc}/customFields?model=contact`),
    get<{ customValues: { id: string; name: string; fieldKey?: string }[] }>(`/locations/${loc}/customValues`),
  ]);

  const errors: Record<string, string> = {};
  const pick = <T,>(r: PromiseSettledResult<T>, name: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    errors[name] = String((r.reason as Error)?.message ?? r.reason).slice(0, 200);
    return null;
  };

  const cal = pick(calendars, "calendars");
  const pip = pick(pipelines, "pipelines");
  const cf = pick(fields, "customFields");
  const cv = pick(values, "customValues");

  return NextResponse.json({
    calendars: (cal?.calendars ?? []).filter((c) => c.isActive !== false).map((c): Opt => ({ value: c.id, label: c.name })),
    pipelines: (pip?.pipelines ?? []).map((p) => ({ id: p.id, name: p.name, stages: (p.stages ?? []).map((st) => ({ id: st.id, name: st.name })) })),
    customFields: (cf?.customFields ?? [])
      .filter((f) => !f.model || f.model === "contact")
      .map((f) => ({ value: `cf:${f.id}`, label: f.name, dataType: f.dataType })),
    customValues: (cv?.customValues ?? []).map((v): Opt => {
      const key = (v.fieldKey ?? "").match(/custom_values\.([\w-]+)/)?.[1] ?? v.name;
      return { value: `{{custom_values.${key}}}`, label: v.name };
    }),
    errors,
  });
});
