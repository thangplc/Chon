import { describe, expect, it } from "vitest";

import {
  matchesExploreMetadataQuery,
  parseExploreDatasetQuery,
} from "./explore-query";

const place = {
  address: "Địa chỉ test",
  amenities: ["Wi-Fi", "Điều hòa"],
  currency: "VND",
  district: "Quận 3",
  estimatedCapacity: 40,
  id: "00000000-0000-4000-8000-000000000001",
  latitude: 10.78,
  longitude: 106.687,
  metadata: {
    isSimulated: true,
    label: "Dữ liệu minh họa",
    source: "synthetic",
  },
  name: "Góc Test",
  priceLevel: 2,
  sizeCategory: "medium",
  slug: "goc-test",
  typicalSpendMax: 90_000,
  typicalSpendMin: 45_000,
} as const;

describe("parseExploreDatasetQuery", () => {
  it("parses metadata filters sent by Explore Apply", () => {
    const query = parseExploreDatasetQuery(
      new URLSearchParams(
        "size=small,medium&amenities=Wi-Fi,%C4%90i%E1%BB%81u%20h%C3%B2a&price_levels=2,3&price_range=50-100",
      ),
    );

    expect(query).toEqual({
      amenities: ["Wi-Fi", "Điều hòa"],
      priceLevels: [2, 3],
      priceMax: 100_000,
      priceMin: 50_000,
      sizeCategories: ["small", "medium"],
    });
  });

  it("ignores unknown filter values and represents an empty query", () => {
    expect(
      parseExploreDatasetQuery(
        new URLSearchParams("size=invalid&price_levels=7&price_range=unknown"),
      ),
    ).toEqual({
      amenities: [],
      priceLevels: [],
      priceMax: null,
      priceMin: null,
      sizeCategories: [],
    });
  });

  it("uses AND semantics for amenities and overlaps price ranges", () => {
    const query = parseExploreDatasetQuery(
      new URLSearchParams(
        "amenities=Wi-Fi,%C4%90i%E1%BB%81u%20h%C3%B2a&price_range=50-100",
      ),
    );

    expect(matchesExploreMetadataQuery(place, query)).toBe(true);
    expect(
      matchesExploreMetadataQuery(place, {
        ...query,
        amenities: ["Wi-Fi", "Ngoài trời"],
      }),
    ).toBe(false);
  });
});
