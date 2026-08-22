import { describe, expect, it, vi } from "vitest";

import { AuthGuard } from "./auth.guard";

describe("AuthGuard", () => {
  it("attaches the resolved user to the request", async () => {
    const user = {
      avatarUrl: null,
      displayName: "Chốn User",
      email: "user@example.com",
      id: "11111111-1111-4111-8111-111111111111",
      provider: "google" as const,
      status: "active" as const,
    };
    const authService = {
      resolveUser: vi.fn().mockResolvedValue(user),
      verifyBearerToken: vi.fn().mockResolvedValue({
        email: user.email,
        name: user.displayName,
        picture: null,
        provider: "google" as const,
        providerSubject: "google-subject",
        sub: "google-subject",
        issuedAt: 1,
      }),
    };
    const request: {
      authUser?: typeof user;
      headers: { authorization: string };
    } = {
      headers: { authorization: "Bearer token" },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };
    const guard = new AuthGuard(authService as never);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.authUser).toEqual(user);
  });
});
