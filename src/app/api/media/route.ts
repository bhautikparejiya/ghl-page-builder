import { NextResponse } from "next/server";
import { ghlFetch } from "@/lib/ghl";
import { handle, HttpError, requireSession } from "@/lib/http";

interface MediaFile {
  url: string;
  name?: string;
  type?: string;
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i;

/** Lists images from the sub-account's HighLevel Media Library. */
export const GET = handle(async (req: Request) => {
  const s = requireSession(req);
  const qs = new URLSearchParams({
    altId: s.locationId,
    altType: "location",
    sortBy: "createdAt",
    sortOrder: "desc",
    type: "file",
    limit: "100",
  });
  const data = await ghlFetch<{ files: MediaFile[] }>(s.locationId, `/medias/files?${qs}`, {}, s.companyId);
  const files = (data.files ?? [])
    .filter((f) => f.url && (IMAGE_RE.test(f.url) || f.type?.startsWith("image")))
    .map((f) => ({ src: f.url, name: f.name }));
  return NextResponse.json({ files });
});

/** Uploads an image to the HighLevel Media Library (max ~4MB on Vercel). */
export const POST = handle(async (req: Request) => {
  const s = requireSession(req);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
  if (!file.type.startsWith("image/")) throw new HttpError(400, "Only images are supported");

  const out = new FormData();
  out.set("file", file, file.name);
  out.set("hosted", "false");
  out.set("name", file.name);
  const data = await ghlFetch<{ fileId: string; url: string }>(
    s.locationId,
    "/medias/upload-file",
    { method: "POST", body: out },
    s.companyId,
  );
  return NextResponse.json({ src: data.url, name: file.name });
});
