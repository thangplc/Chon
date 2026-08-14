import { describe, expect, it } from "vitest";

import { readBackendConfig } from "./backend";

describe("readBackendConfig", () => {
  it("uses the local API URL outside production", () => {
    expect(readBackendConfig({ NODE_ENV: "development" })).toEqual({
      baseUrl: "http://127.0.0.1:3001",
      timeoutMs: 5000,
    });
  });

  it("requires an API URL in production", () => {
    expect(() => readBackendConfig({ NODE_ENV: "production" })).toThrow(
      "BACKEND_API_URL",
    );
  });

  it("rejects credentials embedded in the API URL", () => {
    expect(() =>
      readBackendConfig({
        BACKEND_API_URL: "https://user:secret@api.example.test",
      }),
    ).toThrow("must not contain credentials");
  });
});
