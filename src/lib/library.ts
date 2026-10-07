import { num, query } from "./db";
import { newId } from "./pages";

export type LibraryKind = "section" | "page";

export interface LibraryDoc {
  /** Editor component JSON (what gets inserted). */
  components: unknown;
  /** Rendered HTML / CSS, used for previews and for serving global sections on live pages. */
  html: string;
  css: string;
  fonts?: string[];
}

export interface LibraryItem {
  id: string;
  ownerType: "location" | "company";
  ownerId: string;
  kind: LibraryKind;
  name: string;
  category: string;
  isGlobal: boolean;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  doc?: LibraryDoc;
}

interface Row {
  id: string;
  owner_type: "location" | "company";
  owner_id: string;
  kind: LibraryKind;
  name: string;
  category: string;
  is_global: boolean;
  thumbnail: string | null;
  created_at: unknown;
  updated_at: unknown;
  doc?: LibraryDoc;
}

const fromRow = (r: Row): LibraryItem => ({
  id: r.id,
  ownerType: r.owner_type,
  ownerId: r.owner_id,
  kind: r.kind,
  name: r.name,
  category: r.category,
  isGlobal: r.is_global,
  thumbnail: r.thumbnail ?? undefined,
  createdAt: num(r.created_at),
  updatedAt: num(r.updated_at),
  doc: r.doc,
});

/** Items visible to a sub-account: its own, plus everything its agency shared. */
export async function listLibrary(locationId: string, companyId?: string | null): Promise<LibraryItem[]> {
  const rows = await query<Row>(
    `SELECT id, owner_type, owner_id, kind, name, category, is_global, thumbnail, created_at, updated_at
       FROM library_items
      WHERE (owner_type = 'location' AND owner_id = $1) OR (owner_type = 'company' AND owner_id = $2)
      ORDER BY updated_at DESC LIMIT 300`,
    [locationId, companyId ?? ""],
  );
  return rows.map(fromRow);
}

export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
  const rows = await query<Row>("SELECT * FROM library_items WHERE id = $1", [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Global sections by id (for composing live pages). */
export async function getGlobalSections(ids: string[]): Promise<Map<string, LibraryDoc>> {
  if (!ids.length) return new Map();
  const rows = await query<{ id: string; doc: LibraryDoc }>("SELECT id, doc FROM library_items WHERE id = ANY($1) AND is_global = TRUE", [ids]);
  return new Map(rows.map((r) => [r.id, r.doc]));
}

export function canRead(item: LibraryItem, locationId: string, companyId?: string | null) {
  return (item.ownerType === "location" && item.ownerId === locationId) || (item.ownerType === "company" && !!companyId && item.ownerId === companyId);
}

export async function createLibraryItem(input: Omit<LibraryItem, "id" | "createdAt" | "updatedAt"> & { doc: LibraryDoc }): Promise<LibraryItem> {
  const now = Date.now();
  const item: LibraryItem = { ...input, id: `lib_${newId(12)}`, createdAt: now, updatedAt: now };
  await query(
    `INSERT INTO library_items (id, owner_type, owner_id, kind, name, category, is_global, doc, thumbnail, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
    [item.id, item.ownerType, item.ownerId, item.kind, item.name, item.category, item.isGlobal, JSON.stringify(input.doc), item.thumbnail ?? null, now, now],
  );
  return item;
}

export async function updateLibraryItem(id: string, patch: { name?: string; category?: string; doc?: LibraryDoc; thumbnail?: string | null }) {
  const sets: string[] = [];
  const params: unknown[] = [id];
  const add = (col: string, v: unknown, cast = "") => {
    params.push(v);
    sets.push(`${col} = $${params.length}${cast}`);
  };
  if (patch.name !== undefined) add("name", patch.name);
  if (patch.category !== undefined) add("category", patch.category);
  if (patch.doc !== undefined) add("doc", JSON.stringify(patch.doc), "::jsonb");
  if (patch.thumbnail !== undefined) add("thumbnail", patch.thumbnail);
  add("updated_at", Date.now());
  await query(`UPDATE library_items SET ${sets.join(", ")} WHERE id = $1`, params);
}

export async function deleteLibraryItem(id: string) {
  await query("DELETE FROM library_items WHERE id = $1", [id]);
}
