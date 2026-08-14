import { describe, expect, it } from "vitest";

import { readDatabaseConfig } from "./config";

const validEnvironment = {
  DATABASE_HOST: "127.0.0.1",
  DATABASE_NAME: "chon",
  DATABASE_PASSWORD: "local-password",
  DATABASE_POOL_MAX: "10",
  DATABASE_PORT: "5432",
  DATABASE_SCHEMA: "public",
  DATABASE_SSL: "false",
  DATABASE_USER: "chon",
};

describe("readDatabaseConfig", () => {
  it("parses discrete database environment values", () => {
    expect(readDatabaseConfig(validEnvironment)).toEqual({
      host: "127.0.0.1",
      name: "chon",
      password: "local-password",
      poolMax: 10,
      port: 5432,
      schema: "public",
      ssl: false,
      user: "chon",
    });
  });

  it("rejects a missing password without exposing another value", () => {
    expect(() =>
      readDatabaseConfig({
        ...validEnvironment,
        DATABASE_PASSWORD: "",
      }),
    ).toThrowError("Missing required environment variable: DATABASE_PASSWORD");
  });

  it("rejects an unsafe schema identifier", () => {
    expect(() =>
      readDatabaseConfig({
        ...validEnvironment,
        DATABASE_SCHEMA: "public; drop schema public",
      }),
    ).toThrowError("DATABASE_SCHEMA must be a lowercase PostgreSQL identifier");
  });
});
