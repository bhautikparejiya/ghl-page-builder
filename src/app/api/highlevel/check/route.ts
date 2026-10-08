import { NextResponse } from "next/server";
import { ghlFetch, GhlNotInstalledError, getLocationToken } from "@/lib/ghl";
import { handle, requireSession } from "@/lib/http";

interface Check {
  id: string;
  label: string;
  /** What in PageForge depends on it. */
  usedFor: string;
  scope: string;
  path: (loc: string) => string;
  /** Short summary of what came back, e.g. "12 workflows". */
  summarize: (data: Record<string, unknown>) => string;
}

const count = (key: string, noun: string) => (d: Record<string, unknown>) => {
  const n = Array.isArray(d[key]) ? (d[key] as unknown[]).length : 0;
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
};

const CHECKS: Check[] = [
  {
    id: "location",
    label: "Business profile",
    usedFor: "{{location.*}} values and the logo suggestion in the brand kit",
    scope: "locations.readonly",
    path: (l) => `/locations/${l}`,
    summarize: (d) => String((d.location as { name?: string } | undefined)?.name ?? "Loaded"),
  },
  {
    id: "contacts",
    label: "Contacts",
    usedFor: "Lead forms creating and updating contacts",
    scope: "contacts.readonly / contacts.write",
    path: (l) => `/contacts/?locationId=${l}&limit=1`,
    summarize: () => "Readable",
  },
  { id: "workflows", label: "Workflows", usedFor: "“Add to workflow” on forms", scope: "workflows.readonly", path: (l) => `/workflows/?locationId=${l}`, summarize: count("workflows", "workflow") },
  {
    id: "media",
    label: "Media library",
    usedFor: "Choosing and uploading images",
    scope: "medias.readonly / medias.write",
    path: (l) => `/medias/files?altId=${l}&altType=location&type=file&limit=1`,
    summarize: () => "Readable",
  },
  {
    id: "customFields",
    label: "Custom fields",
    usedFor: "Mapping form fields to custom contact fields",
    scope: "locations/customFields.readonly",
    path: (l) => `/locations/${l}/customFields?model=contact`,
    summarize: count("customFields", "custom field"),
  },
  {
    id: "customValues",
    label: "Custom values",
    usedFor: "{{custom_values.*}} on live pages",
    scope: "locations/customValues.readonly",
    path: (l) => `/locations/${l}/customValues`,
    summarize: count("customValues", "custom value"),
  },
  { id: "calendars", label: "Calendars", usedFor: "The Booking calendar widget", scope: "calendars.readonly", path: (l) => `/calendars/?locationId=${l}`, summarize: count("calendars", "calendar") },
  {
    id: "pipelines",
    label: "Pipelines",
    usedFor: "Creating opportunities from forms",
    scope: "opportunities.readonly / opportunities.write",
    path: (l) => `/opportunities/pipelines?locationId=${l}`,
    summarize: count("pipelines", "pipeline"),
  },
];

/** "HighLevel API 401 /path: {...}" → a readable reason and fix. */
function explain(err: unknown, scope: string): { reason: string; fix?: string } {
  const msg = String((err as Error)?.message ?? err);
  const status = Number(msg.match(/HighLevel API (\d{3})/)?.[1] ?? 0);
  if (status === 401 || status === 403 || /not authorized for this scope/i.test(msg)) {
    return {
      reason: "Permission missing",
      fix: `Add the ${scope} scope to the app in the HighLevel Developer Portal, then reinstall the app on this sub-account so the new permission is granted.`,
    };
  }
  if (status === 404) return { reason: "Not found (the endpoint returned 404)" };
  if (status === 429) return { reason: "Rate limited by HighLevel. Try again in a minute." };
  return { reason: msg.slice(0, 200) };
}

/**
 * Calls each HighLevel API PageForge uses for this sub-account and reports what works,
 * so missing permissions can be found without guessing.
 */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  let installed = false;
  try {
    installed = !!(await getLocationToken(s.locationId, s.companyId));
  } catch {
    installed = false;
  }
  if (!installed) {
    return NextResponse.json({
      installed: false,
      checks: [],
      message: "No HighLevel install found for this sub-account. Install (or reinstall) the app from the Marketplace, then run the check again.",
    });
  }

  const loc = encodeURIComponent(s.locationId);
  const checks = await Promise.all(
    CHECKS.map(async (c) => {
      try {
        const data = await ghlFetch<Record<string, unknown>>(s.locationId, c.path(loc), {}, s.companyId);
        return { id: c.id, label: c.label, usedFor: c.usedFor, scope: c.scope, ok: true, detail: c.summarize(data) };
      } catch (err) {
        if (err instanceof GhlNotInstalledError) return { id: c.id, label: c.label, usedFor: c.usedFor, scope: c.scope, ok: false, detail: "Not installed" };
        const { reason, fix } = explain(err, c.scope);
        return { id: c.id, label: c.label, usedFor: c.usedFor, scope: c.scope, ok: false, detail: reason, fix };
      }
    }),
  );
  return NextResponse.json({ installed: true, checks });
});
