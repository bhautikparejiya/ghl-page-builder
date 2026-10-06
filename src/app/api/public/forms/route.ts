import { NextResponse } from "next/server";
import { ghlFetch } from "@/lib/ghl";
import { CORS_HEADERS } from "@/lib/http";
import { addSubmission, getPage } from "@/lib/pages";

/** Form field names that map 1:1 to HighLevel contact fields. Anything else is saved as a contact note. */
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

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS_HEADERS });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Lead form submissions from published pages → HighLevel contact (+ tags, workflow, note). */
export async function POST(req: Request) {
  let body: { pageId?: string; formId?: string; fields?: Record<string, unknown>; hp?: string; t?: number };
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

  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.fields ?? {})) {
    if (typeof v === "string" && k.length < 64) fields[k] = v.slice(0, 2000).trim();
  }
  if (!fields.email && !fields.phone) return json({ error: "Please provide an email or phone number." }, 400);
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  const contact: Record<string, unknown> = { locationId: page.locationId, source: `PageForge: ${page.name}` };
  const extras: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    if (CONTACT_FIELDS.has(k)) contact[k] = v;
    else extras.push(`${k}: ${v}`);
  }

  let contactId: string | undefined;
  let error: string | undefined;
  try {
    const res = await ghlFetch<{ contact: { id: string } }>(page.locationId, "/contacts/upsert", {
      method: "POST",
      body: JSON.stringify(contact),
    });
    contactId = res.contact?.id;
    if (contactId) {
      const id = contactId;
      const tasks: Promise<unknown>[] = [];
      if (cfg.tags.length) {
        tasks.push(ghlFetch(page.locationId, `/contacts/${id}/tags`, { method: "POST", body: JSON.stringify({ tags: cfg.tags }) }));
      }
      if (extras.length) {
        tasks.push(
          ghlFetch(page.locationId, `/contacts/${id}/notes`, {
            method: "POST",
            body: JSON.stringify({ body: `Form "${formId}" on page "${page.name}":\n${extras.join("\n")}` }),
          }),
        );
      }
      if (cfg.workflowId) {
        tasks.push(ghlFetch(page.locationId, `/contacts/${id}/workflow/${cfg.workflowId}`, { method: "POST", body: "{}" }));
      }
      const results = await Promise.allSettled(tasks);
      const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (failed) error = String(failed.reason?.message ?? failed.reason).slice(0, 300);
    }
  } catch (err) {
    error = (err as Error).message.slice(0, 300);
    console.error("Form → HighLevel failed", err);
  }

  await addSubmission(page.id, { at: Date.now(), formId, fields, contactId, error });

  return json({
    ok: true,
    message: cfg.successMessage || "Thanks! We'll be in touch shortly.",
    redirectUrl: cfg.redirectUrl || null,
  });
}
