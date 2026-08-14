import { describe, expect, it } from "vitest";

import { mediaSourceLabel, resolvePlaceMediaUrl } from "./place-detail";

describe("place detail media", () => {
  it("resolves an immutable local storage key", () => {
    expect(
      resolvePlaceMediaUrl({
        sourceUrl: null,
        storageKey: "place-media/synthetic/cafe-window.svg",
      }),
    ).toBe("/place-media/synthetic/cafe-window.svg");
  });

  it("rejects absolute and traversing storage keys", () => {
    expect(() =>
      resolvePlaceMediaUrl({ sourceUrl: null, storageKey: "/secret.svg" }),
    ).toThrow("Invalid place media storage key");
    expect(() =>
      resolvePlaceMediaUrl({ sourceUrl: null, storageKey: "../secret.svg" }),
    ).toThrow("Invalid place media storage key");
  });

  it("keeps synthetic provenance explicit", () => {
    expect(mediaSourceLabel("synthetic")).toBe("Minh họa giả lập của Chốn");
  });
});
