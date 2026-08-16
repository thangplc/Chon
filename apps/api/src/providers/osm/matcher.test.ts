import { describe, expect, it } from "vitest";

import { matchOsmOpeningHours } from "./matcher";

const candidate = {
  latitude: 10.7751,
  longitude: 106.6901,
  name: "Nép Nhỏ 03",
  openingHours: "Mo-Su 07:00-22:00",
  osmId: "123",
  osmType: "node" as const,
  sourceUrl: "https://www.openstreetmap.org/node/123",
  tags: {
    amenity: "cafe",
    name: "Nép Nhỏ 03",
    opening_hours: "Mo-Su 07:00-22:00",
  },
};

describe("matchOsmOpeningHours", () => {
  it("matches a nearby same-name POI", () => {
    expect(
      matchOsmOpeningHours(
        {
          internalId: "vietmap_demo",
          latitude: 10.775,
          longitude: 106.69,
          name: "Nep Nho 03",
        },
        [candidate],
        100,
      ),
    ).toMatchObject({
      status: "matched",
      candidate,
      confidence: expect.any(Number),
    });
  });

  it("rejects a nearby but unrelated name", () => {
    expect(
      matchOsmOpeningHours(
        {
          internalId: "vietmap_other",
          latitude: 10.775,
          longitude: 106.69,
          name: "Blue Lemon Cafe",
        },
        [candidate],
        100,
      ),
    ).toEqual({ status: "unmatched" });
  });
});
