import { describe, expect, it } from "vitest";

import { parseCorsOrigins, validateApiEnvironment } from "./api-environment";

const databaseEnvironment = {
  DATABASE_HOST: "127.0.0.1",
  DATABASE_NAME: "chon",
  DATABASE_PASSWORD: "test-password",
  DATABASE_POOL_MAX: "10",
  DATABASE_PORT: "5432",
  DATABASE_SCHEMA: "public",
  DATABASE_SSL: "false",
  DATABASE_USER: "chon",
  DATA_IMPORT_TARGET_ENVIRONMENT: "local",
};

describe("API environment", () => {
  it("uses explicit safe local defaults", () => {
    const environment = validateApiEnvironment(databaseEnvironment);

    expect(environment.API_PORT).toBe(3001);
    expect(environment.API_CORS_ORIGINS).toBe("http://localhost:3000");
  });

  it("requires API deployment values in production", () => {
    expect(() =>
      validateApiEnvironment({
        ...databaseEnvironment,
        NODE_ENV: "production",
      }),
    ).toThrow();
  });

  it("rejects wildcard CORS configuration", () => {
    expect(() => parseCorsOrigins("*")).toThrow(
      "API_CORS_ORIGINS must contain explicit origins",
    );
  });
});
