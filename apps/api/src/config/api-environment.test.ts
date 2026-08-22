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
    expect(environment.EXPLORE_INCLUDE_REAL_PLACES).toBe(false);
    expect(environment.EXPLORE_PLACE_DATA_MODE).toBe("synthetic");
    expect(environment.EXPLORE_PLACE_METADATA_MODE).toBe("synthetic");
    expect(environment.AUTH_API_ISSUER).toBe("chon-web");
    expect(environment.AUTH_API_AUDIENCE).toBe("chon-api");
    expect(environment.AUTH_API_SECRET).toContain("dev-only");
    expect(environment.VIBE_REPORT_LIMIT_10_MINUTES).toBe(3);
    expect(environment.VIBE_REPORT_LIMIT_24_HOURS).toBe(10);
    expect(environment.VIBE_REPORT_PLACE_COOLDOWN_MINUTES).toBe(360);
  });

  it("parses the real-place Explore rollout flag", () => {
    const environment = validateApiEnvironment({
      ...databaseEnvironment,
      EXPLORE_INCLUDE_REAL_PLACES: "true",
    });

    expect(environment.EXPLORE_INCLUDE_REAL_PLACES).toBe(true);
    expect(environment.EXPLORE_PLACE_DATA_MODE).toBe("mixed");
  });

  it("supports an explicit real-only Explore dataset", () => {
    const environment = validateApiEnvironment({
      ...databaseEnvironment,
      EXPLORE_INCLUDE_REAL_PLACES: "true",
      EXPLORE_PLACE_DATA_MODE: "real",
    });

    expect(environment.EXPLORE_PLACE_DATA_MODE).toBe("real");
  });

  it("rejects synthetic metadata overlays in production", () => {
    expect(() =>
      validateApiEnvironment({
        ...databaseEnvironment,
        API_CORS_ORIGINS: "https://chon.example",
        API_HOST: "0.0.0.0",
        API_PORT: "8080",
        DATA_IMPORT_TARGET_ENVIRONMENT: "production",
        DATABASE_SSL: "true",
        DATABASE_PASSWORD: "production-password",
        EXPLORE_PLACE_DATA_MODE: "real",
        EXPLORE_PLACE_METADATA_MODE: "synthetic",
      }),
    ).toThrow("Production requires EXPLORE_PLACE_METADATA_MODE=real");
  });

  it("requires API deployment values in production", () => {
    expect(() =>
      validateApiEnvironment({
        ...databaseEnvironment,
        NODE_ENV: "production",
      }),
    ).toThrow();
  });

  it("rejects the default assertion secret in production", () => {
    expect(() =>
      validateApiEnvironment({
        ...databaseEnvironment,
        API_CORS_ORIGINS: "https://chon.example",
        API_HOST: "0.0.0.0",
        API_PORT: "8080",
        AUTH_API_AUDIENCE: "chon-api",
        AUTH_API_ISSUER: "chon-web",
        AUTH_API_SECRET: "dev-only-change-this-auth-api-secret-32chars",
        DATA_IMPORT_TARGET_ENVIRONMENT: "production",
        DATABASE_SSL: "true",
        DATABASE_PASSWORD: "production-password",
        EXPLORE_PLACE_DATA_MODE: "real",
        EXPLORE_PLACE_METADATA_MODE: "real",
        EXPLORE_INCLUDE_REAL_PLACES: "true",
        NODE_ENV: "production",
      }),
    ).toThrow("Production requires a non-default AUTH_API_SECRET");
  });

  it("rejects wildcard CORS configuration", () => {
    expect(() => parseCorsOrigins("*")).toThrow(
      "API_CORS_ORIGINS must contain explicit origins",
    );
  });
});
