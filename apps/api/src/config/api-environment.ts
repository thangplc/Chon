import { z } from "zod";

const localDefaults = {
  API_CORS_ORIGINS: "http://localhost:3000",
  API_HOST: "0.0.0.0",
  API_PORT: "3001",
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
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  })
  .passthrough();

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function validateApiEnvironment(
  input: Record<string, unknown>,
): ApiEnvironment {
  const nodeEnvironment = input.NODE_ENV ?? "development";
  const withLocalDefaults =
    nodeEnvironment === "production"
      ? input
      : { ...localDefaults, ...input, NODE_ENV: nodeEnvironment };

  return environmentSchema.parse(withLocalDefaults);
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
