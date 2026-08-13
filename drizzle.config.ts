import "dotenv/config";

import { defineConfig } from "drizzle-kit";

import { readDatabaseConfig } from "./src/config/database";

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
  schema: "./src/db/schema/index.ts",
  strict: true,
  verbose: true,
});
