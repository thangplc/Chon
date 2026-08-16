import { describe, expect, it } from "vitest";

import { VIETMAP_POI_FIXTURE_PAYLOADS } from "./fixtures";
import {
  parseVietmapPlaceResponse,
  parseVietmapReverseResponse,
  parseVietmapSearchResponse,
  VietmapResponseValidationError,
} from "./response-contract";

describe("VIETMAP response contract", () => {
  it("parses the versioned cafe fixture", () => {
    const result = parseVietmapSearchResponse(
      VIETMAP_POI_FIXTURE_PAYLOADS.searchCafes,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.ref_id).toBe("fixture:POI:cafe-01");
  });

  it("rejects a non-array response", () => {
    expect(() => parseVietmapSearchResponse({ data: [] })).toThrowError(
      VietmapResponseValidationError,
    );
  });

  it("accepts search results without coordinates for Place v4 enrichment", () => {
    expect(
      parseVietmapSearchResponse([
        { address: "12 Test", name: "Cafe", ref_id: "poi-1" },
      ]),
    ).toHaveLength(1);
  });

  it("requires coordinates in the Place v4 response", () => {
    expect(() => parseVietmapPlaceResponse({ name: "Cafe" })).toThrowError(
      "place.lat: Invalid input",
    );
  });

  it("accepts empty administrative fields from the new Place v4 format", () => {
    expect(
      parseVietmapPlaceResponse({
        address: "197 Đường Trần Phú",
        city: "Thành Phố Hồ Chí Minh",
        district: "",
        lat: 10.7592,
        lng: 106.6759,
        name: "",
        street: "Đường Trần Phú",
        ward: "Phường Chợ Quán",
      }),
    ).toMatchObject({
      district: "",
      lat: 10.7592,
      lng: 106.6759,
    });
  });

  it("parses Reverse v4 results with old and new address variants", () => {
    const [result] = parseVietmapReverseResponse([
      {
        data_old: {
          address: "Phường 5,Quận 3,Thành Phố Hồ Chí Minh",
          display: "2/45 Cao Thắng Phường 5,Quận 3,Thành Phố Hồ Chí Minh",
          name: "2/45 Cao Thắng",
        },
        data_new: null,
        lat: 10.7705455,
        lng: 106.6857265,
        name: "2/45 Cao Thắng",
        ref_id: "vm:ADDRESS:test",
      },
    ]);

    expect(result).toMatchObject({
      data_old: { name: "2/45 Cao Thắng" },
      lat: 10.7705455,
    });
  });
});
