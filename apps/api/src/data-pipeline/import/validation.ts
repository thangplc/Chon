import { z } from "zod";

import { ImportError, type ImportIssue, type ImportFile } from "./types";
import type { CsvRecord, ParsedCsv } from "./csv";

const internalId = z.string().regex(/^[a-z0-9_]{3,64}$/);
export const SUPPORTED_POI_PROVIDERS = ["fsq_os_places"] as const;
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().trim().min(1).max(maximum).optional(),
  );
const strictBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
const optionalBoolean = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  strictBoolean.optional(),
);
const integer = (minimum?: number, maximum?: number) => {
  let schema = z.coerce.number().int();

  if (minimum !== undefined) {
    schema = schema.min(minimum);
  }

  if (maximum !== undefined) {
    schema = schema.max(maximum);
  }

  return schema;
};
const optionalInteger = (minimum?: number, maximum?: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    integer(minimum, maximum).optional(),
  );
const decimal = (minimum: number, maximum: number) =>
  z.coerce.number().min(minimum).max(maximum);
const timestampWithTimezone = z
  .string()
  .regex(/T.*(?:Z|[+-]\d{2}:\d{2})$/, "timestamp must include timezone")
  .refine((value) => !Number.isNaN(Date.parse(value)), "invalid timestamp")
  .transform((value) => new Date(value));
const optionalTimestamp = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  timestampWithTimezone.optional(),
);

const placeSchema = z
  .object({
    address: requiredText(240),
    currency: z
      .preprocess(
        (value) => (value === "" || value === undefined ? "VND" : value),
        z.string().regex(/^[A-Z]{3}$/),
      )
      .default("VND"),
    district: requiredText(120),
    estimated_capacity: optionalInteger(1),
    internal_id: internalId,
    is_simulated: strictBoolean,
    latitude: decimal(-90, 90),
    longitude: decimal(-180, 180),
    name: requiredText(120),
    price_level: optionalInteger(1, 4),
    size_category: z.preprocess(
      (value) => (value === "" || value === undefined ? "unknown" : value),
      z.enum(["small", "medium", "large", "unknown"]),
    ),
    status: z.enum(["draft", "published", "archived"]),
    typical_spend_max: optionalInteger(0),
    typical_spend_min: optionalInteger(0),
  })
  .strict()
  .superRefine((row, context) => {
    if (
      row.typical_spend_min !== undefined &&
      row.typical_spend_max !== undefined &&
      row.typical_spend_max < row.typical_spend_min
    ) {
      context.addIssue({
        code: "custom",
        message: "typical_spend_max must be greater than or equal to min",
        path: ["typical_spend_max"],
      });
    }
  });

const placeAreaSchema = z
  .object({
    area_id: internalId,
    description: optionalText(240),
    is_simulated: strictBoolean,
    name: requiredText(80),
    place_id: internalId,
  })
  .strict();

const placeSourceSchema = z
  .object({
    last_synced_at: timestampWithTimezone,
    place_id: internalId,
    provider: z.enum(SUPPORTED_POI_PROVIDERS),
    provider_place_id: requiredText(255),
    source_url: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.url().max(2_048).optional(),
    ),
  })
  .strict();

const placeMediaSchema = z
  .object({
    alt_text: requiredText(240),
    captured_at: optionalTimestamp,
    height: integer(1),
    is_simulated: strictBoolean,
    media_id: internalId,
    media_type: z.literal("image"),
    moderation_status: z.enum([
      "pending",
      "approved",
      "flagged",
      "rejected",
      "archived",
    ]),
    place_area_id: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      internalId.optional(),
    ),
    place_id: internalId,
    rights_status: z.enum([
      "verified",
      "provider_allowed",
      "pending",
      "rejected",
    ]),
    sort_order: integer(0, 4),
    source_reference: optionalText(255),
    source_type: z.enum(["provider", "editorial", "community", "synthetic"]),
    source_url: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.url().max(2_048).optional(),
    ),
    storage_key: optionalText(512),
    thumbnail_key: optionalText(512),
    uploaded_by: optionalText(128),
    width: integer(1),
  })
  .strict()
  .superRefine((row, context) => {
    if (Boolean(row.storage_key) === Boolean(row.source_url)) {
      context.addIssue({
        code: "custom",
        message: "exactly one of storage_key or source_url is required",
      });
    }

    if (
      row.source_type === "synthetic" &&
      (!row.is_simulated ||
        !row.storage_key ||
        row.rights_status !== "verified")
    ) {
      context.addIssue({
        code: "custom",
        message:
          "synthetic media requires is_simulated=true, storage_key and rights_status=verified",
      });
    }
  });

const vibeReportSchema = z
  .object({
    consent_recorded: optionalBoolean,
    crowd: optionalInteger(1, 5),
    data_type: z.enum(["synthetic", "research", "editorial", "community"]),
    day_type: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.enum(["weekday", "friday", "weekend"]).optional(),
    ),
    is_simulated: strictBoolean,
    lighting: optionalInteger(1, 5),
    location_verification: z.enum([
      "none",
      "recalled",
      "approximate",
      "verified",
    ]),
    moderation_status: z.enum([
      "pending",
      "approved",
      "flagged",
      "rejected",
      "archived",
    ]),
    noise: optionalInteger(1, 5),
    participant_id: optionalText(64),
    place_area_id: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      internalId.optional(),
    ),
    place_id: internalId,
    privacy: optionalInteger(1, 5),
    report_id: internalId,
    seat_availability: z.preprocess(
      (value) => (value === "" || value === undefined ? "unknown" : value),
      z.enum(["easy", "normal", "difficult", "unknown"]),
    ),
    short_note: optionalText(140),
    social_energy: optionalInteger(1, 5),
    source_note: optionalText(240),
    time_bucket: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.enum(["morning", "midday", "afternoon", "evening", "late"]).optional(),
    ),
    user_id: optionalText(128),
    verified_at: optionalTimestamp,
    verified_by: optionalText(128),
    visit_mode: z.enum([
      "work",
      "study",
      "solo",
      "date",
      "friends",
      "business_meeting",
      "relax",
      "late_night",
    ]),
    visited_at: timestampWithTimezone,
    workability: optionalInteger(1, 5),
  })
  .strict()
  .superRefine((row, context) => {
    const scoreCount = [
      row.noise,
      row.crowd,
      row.lighting,
      row.privacy,
      row.workability,
      row.social_energy,
    ].filter((score) => score !== undefined).length;

    if (scoreCount < 3) {
      context.addIssue({
        code: "custom",
        message: "at least three vibe dimensions are required",
      });
    }

    if (row.visited_at.getTime() > Date.now()) {
      context.addIssue({
        code: "custom",
        message: "visited_at is in the future",
      });
    }

    if (row.verified_at && row.verified_at < row.visited_at) {
      context.addIssue({
        code: "custom",
        message: "verified_at cannot be before visited_at",
        path: ["verified_at"],
      });
    }

    if (
      row.data_type === "synthetic" &&
      (!row.is_simulated ||
        row.location_verification !== "none" ||
        !row.day_type ||
        !row.time_bucket)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "synthetic requires is_simulated=true, location_verification=none, day_type and time_bucket",
      });
    }

    if (
      row.data_type === "research" &&
      !row.is_simulated &&
      (!row.participant_id || row.consent_recorded !== true)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "real research requires participant_id and consent_recorded=true",
      });
    }

    if (
      row.data_type === "editorial" &&
      !row.is_simulated &&
      (!row.verified_by ||
        !row.verified_at ||
        !row.source_note ||
        row.location_verification !== "verified" ||
        row.moderation_status !== "approved")
    ) {
      context.addIssue({
        code: "custom",
        message: "real editorial report does not satisfy verification rules",
      });
    }

    if (row.data_type === "community" && !row.user_id) {
      context.addIssue({
        code: "custom",
        message: "community requires user_id",
      });
    }
  });

export type PlaceInput = z.output<typeof placeSchema>;
export type PlaceAreaInput = z.output<typeof placeAreaSchema>;
export type PlaceMediaInput = z.output<typeof placeMediaSchema>;
export type PlaceSourceInput = z.output<typeof placeSourceSchema>;
export type VibeReportInput = z.output<typeof vibeReportSchema>;

function zodIssues(
  file: ImportFile,
  rowIndex: number,
  error: z.ZodError,
): ImportIssue[] {
  return error.issues.map((issue) => ({
    code: "schema_validation",
    file: file.name,
    message: `${issue.path.join(".") || "record"}: ${issue.message}`,
    row: rowIndex + 2,
    severity: "error",
  }));
}

function validateRecords<T>(
  parsed: ParsedCsv,
  schema: z.ZodType<T>,
): readonly T[] {
  const output: T[] = [];
  const issues: ImportIssue[] = [];

  parsed.records.forEach((record: CsvRecord, index) => {
    const result = schema.safeParse(record);

    if (result.success) {
      output.push(result.data);
    } else {
      issues.push(...zodIssues(parsed.file, index, result.error));
    }
  });

  if (issues.length > 0) {
    throw new ImportError(`Validation failed for ${parsed.file.name}`, issues);
  }

  return output;
}

export function validatePlaces(parsed: ParsedCsv): readonly PlaceInput[] {
  return validateRecords(parsed, placeSchema);
}

export function validatePlaceAreas(
  parsed: ParsedCsv,
): readonly PlaceAreaInput[] {
  return validateRecords(parsed, placeAreaSchema);
}

export function validatePlaceSources(
  parsed: ParsedCsv,
): readonly PlaceSourceInput[] {
  return validateRecords(parsed, placeSourceSchema);
}

export function validatePlaceMedia(
  parsed: ParsedCsv,
): readonly PlaceMediaInput[] {
  return validateRecords(parsed, placeMediaSchema);
}

export function validateVibeReports(
  parsed: ParsedCsv,
): readonly VibeReportInput[] {
  return validateRecords(parsed, vibeReportSchema);
}

export function assertUniqueIds<T>(
  rows: readonly T[],
  getId: (row: T) => string,
  entity: string,
): void {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const row of rows) {
    const id = getId(row);
    if (seen.has(id)) duplicateIds.add(id);
    seen.add(id);
  }

  if (duplicateIds.size > 0) {
    throw new ImportError(`Duplicate ${entity} IDs`, [
      {
        code: "duplicate_id",
        message: `Duplicate ${entity} IDs: ${[...duplicateIds].join(", ")}`,
        severity: "error",
      },
    ]);
  }
}
