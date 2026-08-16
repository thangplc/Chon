import { z } from "zod";

const localDefaults = {
  API_CORS_ORIGINS: "http://localhost:3000",
  API_HOST: "0.0.0.0",
  API_PORT: "3001",
  EXPLORE_INCLUDE_REAL_PLACES: "false",
  EXPLORE_PLACE_DATA_MODE: "synthetic",
  EXPLORE_PLACE_METADATA_MODE: "synthetic",
} as const;

const environmentSchema = z
  .object({
    API_CORS_ORIGINS: z.string().min(1),
    API_HOST: z.string().min(1),
    API_PORT: z.coerce.number().int().min(1).max(65_535),
    DATABASE_HOST: z.string().min(1),
    DATABASE_NAME: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50),
    DATABASE_PORT: z.coerce.number().int().min(1).max(65_535),
    DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/),
    DATABASE_SSL: z.enum(["true", "false"]),
    DATABASE_USER: z.string().min(1),
    DATA_IMPORT_TARGET_ENVIRONMENT: z.enum([
      "local",
      "ci",
      "staging",
      "production",
    ]),
    EXPLORE_INCLUDE_REAL_PLACES: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    EXPLORE_PLACE_DATA_MODE: z.enum(["synthetic", "mixed", "real"]),
    EXPLORE_PLACE_METADATA_MODE: z.enum(["synthetic", "mixed", "real"]),
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  })
  .passthrough();

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function validateApiEnvironment(
  input: Record<string, unknown>,
): ApiEnvironment {
  const nodeEnvironment = input.NODE_ENV ?? "development";
  // Keep the old rollout flag working for existing .env files. New setups
  // should use EXPLORE_PLACE_DATA_MODE explicitly.
  const explorePlaceDataMode =
    input.EXPLORE_PLACE_DATA_MODE ??
    (input.EXPLORE_INCLUDE_REAL_PLACES === "true" ||
    input.EXPLORE_INCLUDE_REAL_PLACES === true
      ? "mixed"
      : "synthetic");
  const withLocalDefaults =
    nodeEnvironment === "production"
      ? { ...input, EXPLORE_PLACE_DATA_MODE: explorePlaceDataMode }
      : {
          ...localDefaults,
          ...input,
          EXPLORE_PLACE_DATA_MODE: explorePlaceDataMode,
          NODE_ENV: nodeEnvironment,
        };

  const environment = environmentSchema.parse(withLocalDefaults);
  if (
    environment.DATA_IMPORT_TARGET_ENVIRONMENT === "production" &&
    environment.EXPLORE_PLACE_METADATA_MODE !== "real"
  ) {
    throw new Error("Production requires EXPLORE_PLACE_METADATA_MODE=real");
  }
  return environment;
}

export function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    throw new Error("API_CORS_ORIGINS must contain explicit origins");
  }

  return origins;
}
