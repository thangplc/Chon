import { describe, expect, it } from "vitest";

import type { NormalizedPoi } from "../types";
import {
  createVietmapImportRows,
  serializeVietmapCsv,
  VIETMAP_PLACE_CSV_HEADERS,
  VIETMAP_SOURCE_CSV_HEADERS,
} from "./sync";

function poi(
  providerPlaceId: string,
  name: string,
  retrievedAt = new Date("2026-08-15T01:00:00.000Z"),
): NormalizedPoi {
  return {
    address: `${name}, 12 Đường Test, Phường Chợ Quán, Thành Phố Hồ Chí Minh`,
    addressCurrent: "Phường Chợ Quán, Thành Phố Hồ Chí Minh",
    addressLegacy: "Phường 9, Quận 3, Thành Phố Hồ Chí Minh",
    boundaries: [
      {
        fullName: "Quận 3",
        id: "1290",
        name: "3",
        prefix: "Quận",
        type: 1,
      },
    ],
    categories: ["1001-1"],
    display: name,
    distanceKilometers: 0.1,
    isSimulated: false,
    latitude: 10.78,
    longitude: 106.68,
    name,
    provider: "vietmap_maps",
    providerPlaceId,
    providerProduct: "maps_search_v4",
    rawData: {},
    retrievedAt,
    sourceUrl: "https://maps.vietmap.vn/api/search/v4",
  };
}

describe("VIETMAP import rows", () => {
  it("deduplicates repeated administrative address parts", () => {
    const result = poi("vm-generic", "Generic Cafe");
    const rows = createVietmapImportRows([
      {
        area: { code: "hcm-q3", displayName: "Quận 3" },
        poi: {
          ...result,
          address:
            "Phường Bàn Cờ, Thành phố Hồ Chí Minh, Phường Bàn Cờ, Thành phố Hồ Chí Minh",
          addressCurrent: null,
          addressLegacy: null,
        },
      },
    ]);

    expect(rows.places[0].address).toBe("Phường Bàn Cờ, Thành phố Hồ Chí Minh");
  });

  it("creates stable real place and provenance rows", () => {
    const rows = createVietmapImportRows([
      {
        area: { code: "hcm-q3", displayName: "Quận 3" },
        poi: { ...poi("vm-2", "B"), latitude: 10.781 },
      },
      {
        area: { code: "hcm-q3", displayName: "Quận 3" },
        poi: poi("vm-1", "A"),
      },
    ]);

    expect(rows.places).toHaveLength(2);
    expect(rows.places[0]).toMatchObject({
      address: "12 Đường Test, Phường Chợ Quán, Thành Phố Hồ Chí Minh",
      district: "Quận 3",
      is_simulated: "false",
      name: "A",
      size_category: "unknown",
      status: "published",
    });
    expect(rows.places[0].internal_id).toMatch(/^vietmap_[a-f0-9]{24}$/);
    expect(rows.sources[0]).toMatchObject({
      place_id: rows.places[0].internal_id,
      provider: "vietmap_maps",
      provider_place_id: "vm-1",
    });
  });

  it("deduplicates a provider place returned by overlapping areas", () => {
    const result = poi("vm-same", "Same Cafe");
    const rows = createVietmapImportRows([
      { area: { code: "hcm-q1", displayName: "Quận 1" }, poi: result },
      { area: { code: "hcm-q3", displayName: "Quận 3" }, poi: result },
    ]);

    expect(rows.places).toHaveLength(1);
    expect(rows.sources).toHaveLength(1);
  });

  it("deduplicates different provider IDs at the same named location", () => {
    const rows = createVietmapImportRows([
      {
        area: { code: "hcm-q1", displayName: "Quận 1" },
        poi: poi("vm-nearby-1", "Same Cafe"),
      },
      {
        area: { code: "hcm-q1", displayName: "Quận 1" },
        poi: poi("vm-nearby-2", "Same Cafe"),
      },
    ]);

    expect(rows.places).toHaveLength(1);
    expect(rows.sources).toHaveLength(1);
  });

  it("deduplicates nearby provider variants using the importer threshold", () => {
    const rows = createVietmapImportRows([
      {
        area: { code: "gia-lai-quy-nhon-dong", displayName: "Phường Quy Nhơn Đông" },
        poi: poi("vm-variant-2", "Mộc Coffee Quy Nhơn"),
      },
      {
        area: { code: "gia-lai-quy-nhon-dong", displayName: "Phường Quy Nhơn Đông" },
        poi: poi("vm-variant-1", "Moc Coffee Quy Nhon"),
      },
    ]);

    expect(rows.places).toHaveLength(1);
    expect(rows.sources).toHaveLength(1);
    expect(rows.sources[0].provider_place_id).toBe("vm-variant-1");
  });

  it("serializes CSV with escaped values and the strict headers", () => {
    const rows = createVietmapImportRows([
      {
        area: { code: "hcm-q1", displayName: "Quận 1" },
        poi: poi("vm-quote", 'A "quoted" cafe'),
      },
    ]);

    const csv = serializeVietmapCsv(VIETMAP_PLACE_CSV_HEADERS, rows.places);
    const sourceCsv = serializeVietmapCsv(
      VIETMAP_SOURCE_CSV_HEADERS,
      rows.sources,
    );
    expect(csv).toContain('"A ""quoted"" cafe"');
    expect(sourceCsv.split("\n")[0]).toBe(
      '"place_id","provider","provider_place_id","last_synced_at","source_url"',
    );
  });
});
