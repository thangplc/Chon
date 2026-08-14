import "./scripts/load-api-env.mjs";

import { defineConfig } from "drizzle-kit";

import { readDatabaseConfig } from "./src/database/config";

const database = readDatabaseConfig();

export default defineConfig({
  dbCredentials: {
    database: database.name,
    host: database.host,
    password: database.password,
    port: database.port,
    ssl: database.ssl,
    user: database.user,
  },
  dialect: "postgresql",
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  out: "./drizzle",
  schema: "./src/database/schema/index.ts",
  strict: true,
  verbose: true,
});
