import { NextResponse } from "next/server";
import { recordAb } from "@/lib/ab";
import { ghlFetch } from "@/lib/ghl";
import { CORS_HEADERS } from "@/lib/http";
import { addSubmission, getPage } from "@/lib/pages";

/** Form field names that map 1:1 to HighLevel contact fields. "cf_<id>" fields map to custom fields; anything else becomes a note. */
const CONTACT_FIELDS = new Set([
  "firstName",
  "lastName",
  "name",
  "email",
  "phone",
  "companyName",
  "website",
  "address1",
  "city",
  "state",
  "postalCode",
  "country",
]);
const TRACKING = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "page_url", "referrer"]);

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS_HEADERS });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

type FieldValue = string | string[];

const clip = (v: string) => v.slice(0, 2000).trim();
const asText = (v: FieldValue) => (Array.isArray(v) ? v.join(", ") : v);
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");

/** Lead form submissions from published pages → HighLevel contact (+ custom fields, tags, workflow, opportunity, note). */
export async function POST(req: Request) {
  let body: { pageId?: string; formId?: string; fields?: Record<string, unknown>; hp?: string; t?: number; ab?: Record<string, string> | null };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  // Spam traps: hidden honeypot field + minimum time on page.
  if (body.hp || (typeof body.t === "number" && body.t < 1500)) return json({ ok: true });

  const page = body.pageId ? await getPage(body.pageId) : null;
  if (!page?.published) return json({ error: "Page not found" }, 404);
  const formId = String(body.formId || "");
  const cfg = page.published.forms[formId] ?? { tags: [] };

  const fields: Record<string, FieldValue> = {};
  for (const [k, v] of Object.entries(body.fields ?? {}).slice(0, 80)) {
    if (k.length >= 64) continue;
    if (typeof v === "string") fields[k] = clip(v);
    else if (Array.isArray(v)) fields[k] = v.filter((x): x is string => typeof x === "string").slice(0, 50).map(clip);
  }
  const email = asText(fields.email ?? "");
  if (!email && !asText(fields.phone ?? "")) return json({ error: "Please provide an email or phone number." }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400);

  const utm = (k: string) => asText(fields[k] ?? "");
  const source = [`PageForge: ${page.name}`, utm("utm_source") && `(${[utm("utm_source"), utm("utm_campaign")].filter(Boolean).join(" / ")})`].filter(Boolean).join(" ");
  const contact: Record<string, unknown> = { locationId: page.locationId, source };
  const customFields: { id: string; field_value: FieldValue }[] = [];
  const extras: string[] = [];
  const tracking: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!v || (Array.isArray(v) && !v.length)) continue;
    if (CONTACT_FIELDS.has(k)) contact[k] = asText(v);
    else if (k.startsWith("cf_")) customFields.push({ id: k.slice(3), field_value: v });
    else if (TRACKING.has(k)) tracking.push(`${k}: ${asText(v)}`);
    else extras.push(`${k}: ${asText(v)}`);
  }
  if (customFields.length) contact.customFields = customFields;

  let contactId: string | undefined;
  let error: string | undefined;
  try {
    const res = await ghlFetch<{ contact: { id: string } }>(
      page.locationId,
      "/contacts/upsert",
      { method: "POST", body: JSON.stringify(contact) },
      page.companyId,
    );
    contactId = res.contact?.id;
    if (contactId) {
      const id = contactId;
      const call = (path: string, payload: unknown) =>
        ghlFetch(page.locationId, path, { method: "POST", body: JSON.stringify(payload) }, page.companyId);
      const tasks: Promise<unknown>[] = [];
      if (cfg.tags.length) tasks.push(call(`/contacts/${id}/tags`, { tags: cfg.tags }));
      if (extras.length || tracking.length) {
        const note = [`Form on page "${page.name}":`, ...extras, ...(tracking.length ? ["", "Attribution:", ...tracking] : [])].join("\n");
        tasks.push(call(`/contacts/${id}/notes`, { body: note }));
      }
      if (cfg.workflowId) tasks.push(call(`/contacts/${id}/workflow/${cfg.workflowId}`, {}));
      if (cfg.pipelineId) {
        const name = [asText(fields.firstName ?? ""), asText(fields.lastName ?? "")].filter(Boolean).join(" ") || asText(fields.name ?? "") || email || "New lead";
        tasks.push(
          call("/opportunities/", {
            locationId: page.locationId,
            pipelineId: cfg.pipelineId,
            ...(cfg.stageId ? { pipelineStageId: cfg.stageId } : {}),
            contactId: id,
            name: fill(cfg.opportunityName || "{{name}} – {{page}}", { name, email, page: page.name }).slice(0, 200),
            status: "open",
            ...(typeof cfg.opportunityValue === "number" ? { monetaryValue: cfg.opportunityValue } : {}),
            source,
          }),
        );
      }
      const results = await Promise.allSettled(tasks);
      const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (failed) error = String(failed.reason?.message ?? failed.reason).slice(0, 300);
    }
  } catch (err) {
    error = (err as Error).message.slice(0, 300);
    console.error("Form → HighLevel failed", err);
  }

  const stored: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) stored[k] = asText(v);
  await addSubmission(page.id, { at: Date.now(), formId, fields: stored, contactId, error });

  // A/B conversions: the variants this visitor saw.
  if (body.ab && typeof body.ab === "object") {
    await Promise.all(Object.entries(body.ab).slice(0, 10).map(([t, v]) => recordAb(page.id, t, v, "conversion"))).catch(() => {});
  }

  return json({
    ok: true,
    message: cfg.successMessage || "Thanks! We'll be in touch shortly.",
    redirectUrl: cfg.redirectUrl || null,
  });
}
