import { describe, expect, it } from "vitest";

import {
  createDefaultExploreUrlState,
  parseExploreUrlState,
  serializeExploreUrlState,
} from "./explore-url-state";

describe("Explore URL state", () => {
  it("parses and canonicalizes shareable filters", () => {
    const fallback = createDefaultExploreUrlState("2026-08-16");
    const state = parseExploreUrlState(
      "?purpose=date&date=2026-08-17&time=19:30&duration=180&district=q3&q=Nguy%E1%BB%85n%20Hu%E1%BB%87&size=medium,small&amenities=%C4%90i%E1%BB%81u%20h%C3%B2a,Wi-Fi&price_levels=3,1&price_range=50-100",
      fallback,
    );

    expect(state).toEqual({
      amenities: ["Điều hòa", "Wi-Fi"],
      dateValue: "2026-08-17",
      serviceAreaCode: "hcm-q3",
      durationMinutes: 180,
      exactTime: "19:30",
      locationQuery: "Nguyễn Huệ",
      priceLevels: [1, 3],
      priceRangeId: "50-100",
      purpose: "date",
      sizes: ["medium", "small"],
      timeBucket: "morning",
    });

    expect(serializeExploreUrlState(state)).toBe(
      "?purpose=date&date=2026-08-17&time=19%3A30&duration=180&area=hcm-q3&q=Nguy%E1%BB%85n+Hu%E1%BB%87&size=medium%2Csmall&amenities=%C4%90i%E1%BB%81u+h%C3%B2a%2CWi-Fi&price_levels=1%2C3&price_range=50-100",
    );
  });

  it("falls back safely for invalid and privacy-sensitive location params", () => {
    const fallback = createDefaultExploreUrlState("2026-08-16");
    const state = parseExploreUrlState(
      "?purpose=unknown&date=bad&time=99:99&duration=999&district=nope&lat=10.7&lng=106.6&radius=5000",
      fallback,
    );

    expect(state).toMatchObject({
      dateValue: "2026-08-16",
      serviceAreaCode: "all",
      durationMinutes: 120,
      exactTime: "09:00",
      locationQuery: "",
      purpose: "work",
    });
    expect(serializeExploreUrlState(state)).not.toContain("lat=");
    expect(serializeExploreUrlState(state)).not.toContain("lng=");
  });
});
