import { describe, expect, it } from "vitest";

import { placeDetailResponseSchema } from "./backend";

const weekly = {
  friday: [{ closes: "22:00", opens: "07:00" }],
  monday: [{ closes: "22:00", opens: "07:00" }],
  saturday: [{ closes: "23:00", opens: "08:00" }],
  sunday: [],
  thursday: [{ closes: "22:00", opens: "07:00" }],
  tuesday: [{ closes: "22:00", opens: "07:00" }],
  wednesday: [{ closes: "22:00", opens: "07:00" }],
};

const response = {
  data: {
    address: "12 Đường Test",
    areas: [
      {
        description: "Không gian có máy lạnh",
        id: "11111111-1111-4111-8111-111111111111",
        isSimulated: true,
        name: "Khu trong nhà",
      },
    ],
    currency: "VND",
    description: null,
    district: "Quận 3",
    estimatedCapacity: 40,
    id: "22222222-2222-4222-8222-222222222222",
    isSimulated: true,
    latitude: 10.78,
    longitude: 106.687,
    media: [],
    name: "Góc Test",
    openingHours: { timezone: "Asia/Ho_Chi_Minh", weekly },
    priceLevel: 2,
    sizeCategory: "medium",
    slug: "goc-test",
    typicalSpendMax: 90_000,
    typicalSpendMin: 45_000,
  },
};

describe("place detail backend contract", () => {
  it("accepts complete and explicitly empty place facts", () => {
    expect(placeDetailResponseSchema.parse(response)).toEqual(response);
    expect(
      placeDetailResponseSchema.parse({
        data: {
          ...response.data,
          areas: [],
          estimatedCapacity: null,
          openingHours: null,
          priceLevel: null,
          sizeCategory: "unknown",
          typicalSpendMax: null,
          typicalSpendMin: null,
        },
      }).data.openingHours,
    ).toBeNull();
  });

  it("rejects incomplete opening-hours data", () => {
    expect(() =>
      placeDetailResponseSchema.parse({
        data: {
          ...response.data,
          openingHours: {
            timezone: "Asia/Ho_Chi_Minh",
            weekly: { monday: [] },
          },
        },
      }),
    ).toThrow();

    expect(() =>
      placeDetailResponseSchema.parse({
        data: {
          ...response.data,
          openingHours: {
            timezone: "Asia/Ho_Chi_Minh",
            weekly: {
              ...weekly,
              monday: [{ closes: "07:00", opens: "22:00" }],
            },
          },
        },
      }),
    ).toThrow();
  });
});
