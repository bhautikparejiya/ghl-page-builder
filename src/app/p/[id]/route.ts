import { config } from "@/lib/config";
import { notFound, renderHostedPage } from "@/lib/hosted";
import { getPage } from "@/lib/pages";

type Ctx = { params: Promise<{ id: string }> };

/** Standalone hosted version of a published page (also used for the "View live" button). */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const page = await getPage(id);
  if (!page?.published) return notFound();
  return renderHostedPage(page, { canonical: `${config.pagesUrl || config.appUrl}/p/${page.id}` });
}
