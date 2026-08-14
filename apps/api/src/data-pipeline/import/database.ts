import pg from "pg";

import { readDatabaseConfig } from "../../database/config";

const { Client } = pg;

export type ImportDatabaseClient = InstanceType<typeof Client>;

export function createImportDatabaseClient(): ImportDatabaseClient {
  const config = readDatabaseConfig();

  return new Client({
    application_name: "chon-data-import",
    connectionTimeoutMillis: 5_000,
    database: config.name,
    host: config.host,
    options: `-c search_path=${config.schema}`,
    password: config.password,
    port: config.port,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    user: config.user,
  });
}

export async function beginImportTransaction(
  client: ImportDatabaseClient,
): Promise<void> {
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('chon-data-import'))",
  );
}
