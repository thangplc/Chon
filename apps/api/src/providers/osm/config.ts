import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const positiveInteger = (fallback: number, maximum: number) =>
  z.coerce.number().int().min(1).max(maximum).default(fallback);

const environmentSchema = z.object({
  OSM_OPENING_HOURS_ENABLED: booleanFromEnv,
  OSM_OPENING_HOURS_PRODUCTION_READY: booleanFromEnv,
  OSM_OPENING_HOURS_BATCH_SIZE: positiveInteger(20, 50),
  OSM_OPENING_HOURS_MAX_REQUESTS: positiveInteger(10, 100),
  OSM_OPENING_HOURS_RADIUS_METERS: positiveInteger(100, 250),
  OSM_OPENING_HOURS_TIMEOUT_MS: positiveInteger(15_000, 60_000),
  OSM_OVERPASS_URL: z
    .url()
    .default("https://overpass.openstreetmap.fr/api/interpreter"),
  OSM_USER_AGENT: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .default("Chon/0.1 (OSM opening-hours enrichment)"),
});

export type OsmOpeningHoursConfig = Readonly<{
  batchSize: number;
  enabled: boolean;
  maxRequests: number;
  productionReady: boolean;
  radiusMeters: number;
  timeoutMs: number;
  overpassUrl: string;
  userAgent: string;
}>;

export function readOsmOpeningHoursConfig(
  input: Record<string, unknown> = process.env,
): OsmOpeningHoursConfig {
  const parsed = environmentSchema.parse({
    OSM_OPENING_HOURS_BATCH_SIZE: input.OSM_OPENING_HOURS_BATCH_SIZE,
    OSM_OPENING_HOURS_ENABLED: input.OSM_OPENING_HOURS_ENABLED,
    OSM_OPENING_HOURS_MAX_REQUESTS: input.OSM_OPENING_HOURS_MAX_REQUESTS,
    OSM_OPENING_HOURS_PRODUCTION_READY:
      input.OSM_OPENING_HOURS_PRODUCTION_READY,
    OSM_OPENING_HOURS_RADIUS_METERS: input.OSM_OPENING_HOURS_RADIUS_METERS,
    OSM_OPENING_HOURS_TIMEOUT_MS: input.OSM_OPENING_HOURS_TIMEOUT_MS,
    OSM_OVERPASS_URL: input.OSM_OVERPASS_URL,
    OSM_USER_AGENT: input.OSM_USER_AGENT,
  });

  return {
    batchSize: parsed.OSM_OPENING_HOURS_BATCH_SIZE,
    enabled: parsed.OSM_OPENING_HOURS_ENABLED,
    maxRequests: parsed.OSM_OPENING_HOURS_MAX_REQUESTS,
    productionReady: parsed.OSM_OPENING_HOURS_PRODUCTION_READY,
    radiusMeters: parsed.OSM_OPENING_HOURS_RADIUS_METERS,
    timeoutMs: parsed.OSM_OPENING_HOURS_TIMEOUT_MS,
    overpassUrl: parsed.OSM_OVERPASS_URL,
    userAgent: parsed.OSM_USER_AGENT,
  };
}
