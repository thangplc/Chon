import { describe, expect, it, vi } from "vitest";

import type { ChonDatabase } from "../database/database.module";
import { PlacesService } from "./places.service";

function selection(rows: readonly unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ limit, orderBy }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

describe("PlacesService place detail", () => {
  it("returns opening hours, price and internal areas", async () => {
    const weekly = {
      friday: [{ closes: "22:00", opens: "07:00" }],
      monday: [{ closes: "22:00", opens: "07:00" }],
      saturday: [{ closes: "23:00", opens: "08:00" }],
      sunday: [],
      thursday: [{ closes: "22:00", opens: "07:00" }],
      tuesday: [{ closes: "22:00", opens: "07:00" }],
      wednesday: [{ closes: "22:00", opens: "07:00" }],
    };
    const select = vi
      .fn()
      .mockReturnValueOnce(
        selection([
          {
            address: "12 Đường Test",
            currency: "VND",
            description: null,
            district: "Quận 3",
            estimatedCapacity: 40,
            id: "22222222-2222-4222-8222-222222222222",
            isSimulated: true,
            location: { latitude: 10.78, longitude: 106.687 },
            name: "Góc Test",
            openingHours: { timezone: "Asia/Ho_Chi_Minh", weekly },
            priceLevel: 2,
            sizeCategory: "medium",
            slug: "goc-test",
            typicalSpendMax: 90_000,
            typicalSpendMin: 45_000,
          },
        ]),
      )
      .mockReturnValueOnce(
        selection([
          {
            description: "Không gian có máy lạnh",
            id: "11111111-1111-4111-8111-111111111111",
            isSimulated: true,
            name: "Khu trong nhà",
          },
        ]),
      )
      .mockReturnValueOnce(selection([]));
    const service = new PlacesService(
      { select } as unknown as ChonDatabase,
      {} as never,
    );

    await expect(
      service.findDetailBySlug("goc-test", "local"),
    ).resolves.toEqual(
      expect.objectContaining({
        areas: [
          expect.objectContaining({
            name: "Khu trong nhà",
          }),
        ],
        openingHours: { timezone: "Asia/Ho_Chi_Minh", weekly },
        priceLevel: 2,
        sizeCategory: "medium",
        typicalSpendMax: 90_000,
        typicalSpendMin: 45_000,
      }),
    );
  });
});
