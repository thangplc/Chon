import { z } from "zod";

export const editorialCollectionRowSchema = z
  .object({
    collection_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    collection_name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    environment: z.enum(["local", "ci", "staging", "production"]),
    note: z.preprocess(
      (value) => (value === "" ? null : value),
      z.string().trim().min(1).max(500).nullable(),
    ),
    place_internal_id: z.string().regex(/^[a-z0-9_]{3,64}$/),
    position: z.coerce.number().int().nonnegative(),
    status: z.enum(["draft", "published"]),
  })
  .strict();

export type EditorialCollectionRow = z.infer<
  typeof editorialCollectionRowSchema
>;

export function parseEditorialCollectionRows(
  records: readonly Readonly<Record<string, string>>[],
): readonly EditorialCollectionRow[] {
  const rows = records.map((record, index) => {
    const parsed = editorialCollectionRowSchema.safeParse(record);
    if (!parsed.success) {
      throw new Error(
        `Invalid editorial collection row ${index + 2}: ${parsed.error.issues
          .map(({ message, path }) => `${path.join(".")}: ${message}`)
          .join("; ")}`,
      );
    }
    return parsed.data;
  });
  if (rows.length === 0) throw new Error("Editorial collection CSV is empty");

  const groups = new Map<string, EditorialCollectionRow[]>();
  for (const row of rows) {
    const group = groups.get(row.collection_slug) ?? [];
    group.push(row);
    groups.set(row.collection_slug, group);
  }
  for (const [slug, group] of groups) {
    const first = group[0]!;
    const metadataMismatch = group.some(
      (row) =>
        row.collection_name !== first.collection_name ||
        row.description !== first.description ||
        row.environment !== first.environment ||
        row.status !== first.status,
    );
    if (metadataMismatch) {
      throw new Error(`Collection ${slug} has inconsistent metadata`);
    }
    if (new Set(group.map(({ position }) => position)).size !== group.length) {
      throw new Error(`Collection ${slug} has duplicate positions`);
    }
    if (
      new Set(group.map(({ place_internal_id }) => place_internal_id)).size !==
      group.length
    ) {
      throw new Error(`Collection ${slug} has duplicate places`);
    }
  }
  return rows;
}
