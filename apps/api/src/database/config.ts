const POSTGRES_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

type Environment = Readonly<Record<string, string | undefined>>;

export type DatabaseConfig = Readonly<{
  host: string;
  name: string;
  password: string;
  poolMax: number;
  port: number;
  schema: string;
  ssl: boolean;
  user: string;
}>;

function requireEnvironmentValue(
  environment: Environment,
  key: string,
): string {
  const value = environment[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function parseIntegerInRange(
  value: string,
  key: string,
  minimum: number,
  maximum: number,
): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${key} must be an integer`);
  }

  const parsedValue = Number(value);

  if (parsedValue < minimum || parsedValue > maximum) {
    throw new Error(`${key} must be between ${minimum} and ${maximum}`);
  }

  return parsedValue;
}

function parseBoolean(value: string, key: string): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${key} must be either true or false`);
}

export function readDatabaseConfig(
  environment: Environment = process.env,
): DatabaseConfig {
  const schema = requireEnvironmentValue(environment, "DATABASE_SCHEMA");

  if (!POSTGRES_IDENTIFIER.test(schema)) {
    throw new Error(
      "DATABASE_SCHEMA must be a lowercase PostgreSQL identifier",
    );
  }

  return {
    host: requireEnvironmentValue(environment, "DATABASE_HOST"),
    name: requireEnvironmentValue(environment, "DATABASE_NAME"),
    password: requireEnvironmentValue(environment, "DATABASE_PASSWORD"),
    poolMax: parseIntegerInRange(
      requireEnvironmentValue(environment, "DATABASE_POOL_MAX"),
      "DATABASE_POOL_MAX",
      1,
      50,
    ),
    port: parseIntegerInRange(
      requireEnvironmentValue(environment, "DATABASE_PORT"),
      "DATABASE_PORT",
      1,
      65_535,
    ),
    schema,
    ssl: parseBoolean(
      requireEnvironmentValue(environment, "DATABASE_SSL"),
      "DATABASE_SSL",
    ),
    user: requireEnvironmentValue(environment, "DATABASE_USER"),
  };
}
