import { describe, expect, it } from "vitest";

import { readSiteUrl } from "./site";

describe("readSiteUrl", () => {
  it("normalizes the configured public origin", () => {
    expect(readSiteUrl({ SITE_URL: "https://chon.example/" })).toBe(
      "https://chon.example",
    );
  });

  it("rejects credentials in public URLs", () => {
    expect(() =>
      readSiteUrl({ SITE_URL: "https://user:secret@chon.example" }),
    ).toThrow("must not contain credentials");
  });
});
