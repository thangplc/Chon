import { describe, expect, it } from "vitest";

import { authAssertionSchema, authMeResponseSchema } from "./auth";

describe("auth contracts", () => {
  it("accepts a provider assertion without exposing raw token claims", () => {
    expect(
      authAssertionSchema.parse({
        email: "user@example.com",
        name: "Chốn User",
        picture: null,
        provider: "google",
        providerSubject: "google-subject",
        sub: "google-subject",
      }),
    ).toMatchObject({ provider: "google" });
  });

  it("accepts the public current-user response", () => {
    expect(
      authMeResponseSchema.parse({
        data: {
          avatarUrl: null,
          displayName: "Chốn User",
          email: "user@example.com",
          id: "11111111-1111-4111-8111-111111111111",
          provider: "google",
          status: "active",
        },
      }).data.status,
    ).toBe("active");
  });
});
