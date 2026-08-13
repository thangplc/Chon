import { describe, expect, it } from "vitest";

import type { ParsedCsv } from "./csv";
import { ImportError } from "./types";
import {
  validatePlaces,
  validatePlaceSources,
  validateVibeReports,
} from "./validation";

function parsed(record: Record<string, string>): ParsedCsv {
  return {
    file: { checksum: "test", name: "test.csv", records: 1 },
    headers: Object.keys(record),
    records: [record],
  };
}

describe("data import validation", () => {
  it("normalizes optional place defaults without weakening strict booleans", () => {
    const rows = validatePlaces(
      parsed({
        address: "1 Test Street",
        district: "Quận 1",
        internal_id: "syn_test_place",
        is_simulated: "true",
        latitude: "10.78",
        longitude: "106.7",
        name: "Test Cafe",
        status: "published",
      }),
    );

    expect(rows[0]).toMatchObject({
      currency: "VND",
      is_simulated: true,
      size_category: "unknown",
    });
  });

  it("allows a simulated research fixture", () => {
    const rows = validateVibeReports(
      parsed({
        crowd: "2",
        data_type: "research",
        is_simulated: "true",
        lighting: "3",
        location_verification: "recalled",
        moderation_status: "pending",
        noise: "2",
        place_id: "syn_test_place",
        report_id: "sim_test_report",
        visit_mode: "work",
        visited_at: "2025-01-01T09:00:00+07:00",
      }),
    );

    expect(rows[0].data_type).toBe("research");
  });

  it("rejects real research without consent and participant ID", () => {
    expect(() =>
      validateVibeReports(
        parsed({
          crowd: "2",
          data_type: "research",
          is_simulated: "false",
          lighting: "3",
          location_verification: "recalled",
          moderation_status: "pending",
          noise: "2",
          place_id: "real_test_place",
          report_id: "real_test_report",
          visit_mode: "work",
          visited_at: "2025-01-01T09:00:00+07:00",
        }),
      ),
    ).toThrow(ImportError);
  });

  it("rejects an unknown CSV column", () => {
    expect(() =>
      validatePlaces(
        parsed({
          address: "1 Test Street",
          district: "Quận 1",
          internal_id: "syn_test_place",
          is_simulated: "true",
          latitude: "10.78",
          longitude: "106.7",
          name: "Test Cafe",
          status: "published",
          typo_field: "unexpected",
        }),
      ),
    ).toThrow(ImportError);
  });

  it("accepts the configured FSQ provider provenance", () => {
    const rows = validatePlaceSources(
      parsed({
        last_synced_at: "2026-08-13T09:00:00+07:00",
        place_id: "real_test_place",
        provider: "fsq_os_places",
        provider_place_id: "fsq-place-123",
        source_url: "https://example.com/places/fsq-place-123",
      }),
    );

    expect(rows[0]).toMatchObject({
      place_id: "real_test_place",
      provider: "fsq_os_places",
      provider_place_id: "fsq-place-123",
    });
  });

  it("rejects an unconfigured POI provider", () => {
    expect(() =>
      validatePlaceSources(
        parsed({
          last_synced_at: "2026-08-13T09:00:00+07:00",
          place_id: "real_test_place",
          provider: "unknown_provider",
          provider_place_id: "unknown-123",
          source_url: "",
        }),
      ),
    ).toThrow(ImportError);
  });
});
