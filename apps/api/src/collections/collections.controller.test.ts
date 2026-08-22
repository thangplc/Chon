import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import {
  CollectionsController,
  OwnedCollectionsController,
  PublicCollectionsController,
} from "./collections.controller";

const user = {
  avatarUrl: null,
  displayName: "Chốn User",
  email: "user@example.com",
  id: "11111111-1111-4111-8111-111111111111",
  provider: "google" as const,
  status: "active" as const,
};

describe("CollectionsController", () => {
  it("always derives collection ownership from the authenticated request", async () => {
    const savePlace = vi.fn().mockResolvedValue({
      saved: true,
      savedAt: new Date("2026-08-22T02:00:00.000Z"),
      slug: "goc-may-01",
    });
    const controller = new CollectionsController({ savePlace } as never);

    await controller.save("goc-may-01", { authUser: user } as never);

    expect(savePlace).toHaveBeenCalledWith(user, "goc-may-01");
  });

  it("rejects access when the guard did not resolve a user", async () => {
    const controller = new CollectionsController({} as never);
    await expect(controller.list({} as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe("OwnedCollectionsController", () => {
  it("derives collection ownership from the authenticated request", async () => {
    const createCollection = vi.fn().mockResolvedValue({ id: "collection-id" });
    const controller = new OwnedCollectionsController({
      createCollection,
    } as never);
    await controller.create({ name: "Đi một mình", visibility: "public" }, {
      authUser: user,
    } as never);
    expect(createCollection).toHaveBeenCalledWith(user, {
      name: "Đi một mình",
      visibility: "public",
    });
  });
});

describe("PublicCollectionsController", () => {
  it("reads a public collection without an authenticated identity", async () => {
    const readPublicCollection = vi
      .fn()
      .mockResolvedValue({ name: "Quán yên tĩnh" });
    const controller = new PublicCollectionsController({
      readPublicCollection,
    } as never);
    await controller.read("11111111-1111-4111-8111-111111111111");
    expect(readPublicCollection).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
  });
});
