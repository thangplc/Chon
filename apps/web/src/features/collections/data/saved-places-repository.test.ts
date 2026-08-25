import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadSavedPlaceStatus,
  SavedPlaceError,
  setSavedPlace,
} from "./saved-places-repository";

describe("saved places repository", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads saved status without caching", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { saved: true, savedAt: "2026-08-22T02:00:00.000Z", slug: "goc-may-01" },
        }),
        { status: 200 },
      ),
    );

    await expect(loadSavedPlaceStatus("goc-may-01")).resolves.toMatchObject({
      saved: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/saved-places/goc-may-01",
      expect.objectContaining({ cache: "no-store", method: "GET" }),
    );
  });

  it("uses idempotent PUT and preserves authentication errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Sign in is required" }), {
        status: 401,
      }),
    );

    await expect(setSavedPlace("goc-may-01", true)).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<SavedPlaceError>);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/saved-places/goc-may-01",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
