import { describe, expect, it } from "vitest";

import {
  exploreDatasetResponseSchema,
  placeDetailResponseSchema,
  vibeSnapshotsResponseSchema,
} from "./backend";

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
    metadata: {
      isSimulated: true,
      label: "Dữ liệu minh họa — chưa xác minh",
      source: "synthetic",
    },
    amenities: ["Wi-Fi"],
    latitude: 10.78,
    longitude: 106.687,
    media: [],
    name: "Góc Test",
    openingHours: { timezone: "Asia/Ho_Chi_Minh", weekly },
    priceLevel: 2,
    sizeCategory: "medium",
    spaceNote: "Có khu trong nhà.",
    slug: "goc-test",
    typicalSpendMax: 90_000,
    typicalSpendMin: 45_000,
  },
};

const canonicalSnapshot = {
  aggregationVersion: "fusion-v1",
  component: "canonical" as const,
  confidence: { level: "medium" as const, score: 0.6 },
  dayType: "weekday" as const,
  generatedAt: "2026-08-16T03:00:00.000Z",
  isSimulated: false,
  lastReportAt: "2026-08-16T03:00:00.000Z",
  placeAreaId: null,
  placeId: "22222222-2222-4222-8222-222222222222",
  providerSignalCount: 1,
  reportCount: 3,
  scores: {
    crowd: 2.3,
    lighting: 3,
    noise: 1.4,
    privacy: 4,
    socialEnergy: 2,
    workability: 5,
  },
  sourceDataTypes: ["community" as const],
  sourceProviders: ["foursquare_places"],
  timeBucket: "morning" as const,
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

describe("explore backend contract", () => {
  it("accepts a mixed provider-place dataset", () => {
    const parsed = exploreDatasetResponseSchema.parse({
      data: {
        places: [
          {
            address: "12 Đường Test",
            amenities: ["Wi-Fi", "Ổ cắm điện"],
            currency: "VND",
            district: "Quận 3",
            estimatedCapacity: 40,
            id: "22222222-2222-4222-8222-222222222222",
            latitude: 10.78,
            longitude: 106.687,
            metadata: {
              isSimulated: true,
              label: "Dữ liệu minh họa — chưa xác minh",
              source: "synthetic",
            },
            name: "Góc Test",
            priceLevel: 2,
            serviceAreaCode: "hcm-q3",
            serviceAreaName: "Quận 3",
            sizeCategory: "medium",
            slug: "goc-test",
            typicalSpendMax: 90_000,
            typicalSpendMin: 45_000,
          },
        ],
        reports: [],
        vibes: [],
        source: "database_mixed",
      },
    });

    expect(parsed.data.places[0]).toMatchObject({
      amenities: ["Wi-Fi", "Ổ cắm điện"],
      priceLevel: 2,
      sizeCategory: "medium",
    });
    expect(parsed.data.source).toBe("database_mixed");
  });

  it("accepts a real-only provider-place dataset", () => {
    expect(
      exploreDatasetResponseSchema.parse({
        data: {
          places: [],
          reports: [],
          vibes: [],
          source: "database_real",
        },
      }).data.source,
    ).toBe("database_real");
  });
});

describe("canonical vibe backend contract", () => {
  it("accepts one fused snapshot with provider provenance", () => {
    expect(
      vibeSnapshotsResponseSchema.parse({
        data: {
          placeId: "22222222-2222-4222-8222-222222222222",
          snapshots: [canonicalSnapshot],
        },
      }).data.snapshots[0]?.component,
    ).toBe("canonical");
  });

  it("allows a provider-only result to report zero first-party reports", () => {
    expect(
      vibeSnapshotsResponseSchema.parse({
        data: {
          placeId: "22222222-2222-4222-8222-222222222222",
          snapshots: [
            {
              ...canonicalSnapshot,
              reportCount: 0,
              sourceDataTypes: [],
            },
          ],
        },
      }).data.snapshots[0]?.reportCount,
    ).toBe(0);
  });
});
