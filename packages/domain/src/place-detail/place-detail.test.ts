import { describe, expect, it } from "vitest";

import {
  mediaSourceLabel,
  openingHoursAreEqual,
  parsePlaceOpeningHours,
  parsePriceLevel,
  resolvePlaceMediaUrl,
} from "./place-detail";

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

describe("place detail facts", () => {
  const weekly = {
    friday: [{ closes: "22:00", opens: "07:00" }],
    monday: [{ closes: "22:00", opens: "07:00" }],
    saturday: [{ closes: "23:00", opens: "08:00" }],
    sunday: [],
    thursday: [{ closes: "22:00", opens: "07:00" }],
    tuesday: [{ closes: "22:00", opens: "07:00" }],
    wednesday: [{ closes: "22:00", opens: "07:00" }],
  };

  it("parses a complete weekly schedule", () => {
    const hours = parsePlaceOpeningHours({
      timezone: "Asia/Ho_Chi_Minh",
      weekly,
    });

    expect(hours.weekly.sunday).toEqual([]);
    expect(openingHoursAreEqual(hours, { ...hours })).toBe(true);
  });

  it("rejects missing weekdays and overlapping periods", () => {
    expect(() =>
      parsePlaceOpeningHours({
        timezone: "Asia/Ho_Chi_Minh",
        weekly: { monday: [] },
      }),
    ).toThrow("exactly seven weekdays");

    expect(() =>
      parsePlaceOpeningHours({
        timezone: "Asia/Ho_Chi_Minh",
        weekly: {
          ...weekly,
          monday: [
            { closes: "12:00", opens: "07:00" },
            { closes: "14:00", opens: "11:00" },
          ],
        },
      }),
    ).toThrow("must not overlap");
  });

  it("narrows database price levels", () => {
    expect(parsePriceLevel(3)).toBe(3);
    expect(parsePriceLevel(null)).toBeNull();
    expect(() => parsePriceLevel(5)).toThrow("Invalid place price level");
  });
});
