import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

import type { ApiEnvironment } from "../config/api-environment";
import type { ChonDatabase } from "../database/database.module";
import { AuthService } from "./auth.service";

const secret = "test-auth-api-secret-with-at-least-32-chars";
const config = {
  get: vi.fn((key: keyof ApiEnvironment) => {
    const values = {
      AUTH_API_AUDIENCE: "chon-api",
      AUTH_API_ISSUER: "chon-web",
      AUTH_API_SECRET: secret,
    } as const;
    return values[key as keyof typeof values];
  }),
};

async function createToken(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    email: "user@example.com",
    name: "Chốn User",
    picture: null,
    provider: "google",
    providerSubject: "google-subject",
    ...overrides,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience("chon-api")
    .setIssuer("chon-web")
    .setIssuedAt()
    .setExpirationTime("1m")
    .setSubject("google-subject")
    .sign(new TextEncoder().encode(secret));
}

describe("AuthService", () => {
  it("verifies a short-lived internal auth assertion", async () => {
    const service = new AuthService(config as never, {} as ChonDatabase);
    const token = await createToken();

    await expect(
      service.verifyBearerToken(`Bearer ${token}`),
    ).resolves.toMatchObject({
      provider: "google",
      providerSubject: "google-subject",
      sub: "google-subject",
    });
  });

  it("rejects missing or tampered assertions", async () => {
    const service = new AuthService(config as never, {} as ChonDatabase);

    await expect(service.verifyBearerToken(undefined)).rejects.toThrow(
      "Authentication required",
    );
    await expect(
      service.verifyBearerToken("Bearer invalid-token"),
    ).rejects.toThrow("Invalid authentication token");
  });
});
