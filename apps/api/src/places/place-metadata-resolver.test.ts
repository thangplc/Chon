import { describe, expect, it } from "vitest";

import { resolvePlaceMetadata } from "./place-metadata-resolver";

const canonical = {
  currency: "VND",
  estimatedCapacity: null,
  openingHours: null,
  priceLevel: null,
  sizeCategory: "unknown" as const,
  typicalSpendMax: null,
  typicalSpendMin: null,
};

const synthetic = {
  amenities: ["Wi-Fi", "Ổ cắm điện"],
  currency: "VND",
  estimatedCapacity: 40,
  openingHours: null,
  priceLevel: 2 as const,
  sizeCategory: "medium" as const,
  spaceNote: "Có khu trong nhà.",
  typicalSpendMax: 90_000,
  typicalSpendMin: 45_000,
};

describe("resolvePlaceMetadata", () => {
  it("ignores synthetic overlays in real mode", () => {
    const result = resolvePlaceMetadata(canonical, synthetic, "real");

    expect(result.metadata.source).toBe("canonical");
    expect(result.metadata.isSimulated).toBe(false);
    expect(result.typicalSpendMin).toBeNull();
    expect(result.amenities).toEqual([]);
  });

  it("fills missing canonical facts in mixed mode", () => {
    const result = resolvePlaceMetadata(canonical, synthetic, "mixed");

    expect(result.metadata.source).toBe("synthetic");
    expect(result.metadata.isSimulated).toBe(true);
    expect(result.typicalSpendMin).toBe(45_000);
    expect(result.sizeCategory).toBe("medium");
    expect(result.amenities).toEqual(["Wi-Fi", "Ổ cắm điện"]);
  });

  it("does not replace a verified canonical value in mixed mode", () => {
    const result = resolvePlaceMetadata(
      { ...canonical, typicalSpendMin: 50_000 },
      synthetic,
      "mixed",
    );

    expect(result.typicalSpendMin).toBe(50_000);
    expect(result.metadata.source).toBe("synthetic");
  });
});
