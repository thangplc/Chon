import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { readDatabaseConfig } from "./config";
import * as schema from "./schema";

function createDatabaseConnection() {
  const config = readDatabaseConfig();
  const pool = new Pool({
    application_name: "chon-operator",
    connectionTimeoutMillis: 5_000,
    database: config.name,
    host: config.host,
    idleTimeoutMillis: 30_000,
    max: config.poolMax,
    options: `-c search_path=${config.schema}`,
    password: config.password,
    port: config.port,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    user: config.user,
  });

  return {
    db: drizzle({ client: pool, schema }),
    pool,
  };
}

export type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

const globalForDatabase = globalThis as typeof globalThis & {
  chonDatabaseConnection?: DatabaseConnection;
};

export function getDatabaseConnection(): DatabaseConnection {
  globalForDatabase.chonDatabaseConnection ??= createDatabaseConnection();

  return globalForDatabase.chonDatabaseConnection;
}

export async function closeDatabaseConnection(): Promise<void> {
  const connection = globalForDatabase.chonDatabaseConnection;

  if (!connection) {
    return;
  }

  await connection.pool.end();
  delete globalForDatabase.chonDatabaseConnection;
}
