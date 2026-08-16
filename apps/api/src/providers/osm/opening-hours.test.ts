import { describe, expect, it } from "vitest";

import { parseOsmOpeningHours } from "./opening-hours";

describe("parseOsmOpeningHours", () => {
  it("normalizes day ranges and multiple weekly rules", () => {
    const result = parseOsmOpeningHours("Mo-Fr 07:00-22:00; Sa-Su 08:00-23:00");

    expect(result).toEqual({
      ok: true,
      openingHours: {
        timezone: "Asia/Ho_Chi_Minh",
        weekly: {
          monday: [{ opens: "07:00", closes: "22:00" }],
          tuesday: [{ opens: "07:00", closes: "22:00" }],
          wednesday: [{ opens: "07:00", closes: "22:00" }],
          thursday: [{ opens: "07:00", closes: "22:00" }],
          friday: [{ opens: "07:00", closes: "22:00" }],
          saturday: [{ opens: "08:00", closes: "23:00" }],
          sunday: [{ opens: "08:00", closes: "23:00" }],
        },
      },
    });
  });

  it("supports split same-day periods", () => {
    const result = parseOsmOpeningHours("Mo,Tu 07:00-12:00,13:00-21:00");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.openingHours.weekly.monday).toEqual([
        { opens: "07:00", closes: "12:00" },
        { opens: "13:00", closes: "21:00" },
      ]);
    }
  });

  it("does not guess overnight or calendar-dependent rules", () => {
    expect(parseOsmOpeningHours("Mo-Su 18:00-02:00")).toMatchObject({
      ok: false,
      status: "invalid",
    });
    expect(parseOsmOpeningHours("24/7")).toMatchObject({
      ok: false,
      status: "unsupported",
    });
    expect(parseOsmOpeningHours("Mo-Fr 07:00-22:00; PH off")).toMatchObject({
      ok: false,
      status: "unsupported",
    });
  });
});
