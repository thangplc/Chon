import { z } from "zod";

const querySchema = z.object({
  dayType: z.enum(["weekday", "friday", "weekend"]).optional(),
  placeAreaId: z.string().uuid().optional(),
  timeBucket: z
    .enum(["morning", "midday", "afternoon", "evening", "late"])
    .optional(),
});

export type VibeSnapshotQuery = z.output<typeof querySchema>;

export class VibeSnapshotQueryValidationError extends Error {
  readonly code = "vibe_snapshot_query_invalid";

  constructor(message: string) {
    super(message);
    this.name = "VibeSnapshotQueryValidationError";
  }
}

export function parseVibeSnapshotQuery(
  searchParams: URLSearchParams,
): VibeSnapshotQuery {
  const parsed = querySchema.safeParse({
    dayType: searchParams.get("day_type") ?? undefined,
    placeAreaId: searchParams.get("area_id") ?? undefined,
    timeBucket: searchParams.get("time_bucket") ?? undefined,
  });
  if (!parsed.success) {
    throw new VibeSnapshotQueryValidationError(
      parsed.error.issues
        .map(({ message, path }) => `${path.join(".")}: ${message}`)
        .join("; "),
    );
  }
  return parsed.data;
}
