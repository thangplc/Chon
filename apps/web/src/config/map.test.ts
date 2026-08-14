import { describe, expect, it } from "vitest";

import { getPublicMapConfiguration } from "./map";

describe("getPublicMapConfiguration", () => {
  it("fails closed when the browser key is missing", () => {
    expect(getPublicMapConfiguration({})).toEqual({ styleUrl: null });
  });

  it("builds an encoded MapTiler style URL", () => {
    expect(
      getPublicMapConfiguration({
        NEXT_PUBLIC_MAPTILER_API_KEY: "public key",
        NEXT_PUBLIC_MAPTILER_STYLE_ID: "streets-v4",
      }),
    ).toEqual({
      styleUrl:
        "https://api.maptiler.com/maps/streets-v4/style.json?key=public%20key",
    });
  });

  it("rejects an unsafe style identifier", () => {
    expect(
      getPublicMapConfiguration({
        NEXT_PUBLIC_MAPTILER_API_KEY: "public-key",
        NEXT_PUBLIC_MAPTILER_STYLE_ID: "../../private",
      }),
    ).toEqual({ styleUrl: null });
  });
});
