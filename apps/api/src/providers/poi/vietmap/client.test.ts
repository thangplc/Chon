import { describe, expect, it, vi } from "vitest";

import { readVietmapPoiConfig } from "../config";
import { VietmapPoiClient, VietmapPoiClientError } from "./client";
import { VIETMAP_POI_FIXTURE_PAYLOADS } from "./fixtures";

function config() {
  return readVietmapPoiConfig({
    VIETMAP_API_KEY: "secret",
    VIETMAP_POI_ENABLED: "true",
    VIETMAP_POI_MAX_REQUESTS: "1",
    VIETMAP_POI_REQUEST_INTERVAL_MS: "0",
  });
}

describe("VietmapPoiClient", () => {
  it("sends a server-side POI search with category and circle filters", async () => {
    const fetcher = vi.fn(async (input: URL) => {
      expect(input.searchParams.get("apikey")).toBe("secret");
      expect(input.searchParams.get("cats")).toBe("1001-1");
      expect(input.searchParams.get("circle_radius")).toBe("750");
      expect(input.searchParams.get("layers")).toBe("POI");
      if (input.pathname.endsWith("/search/v4")) {
        return new Response(
          JSON.stringify(VIETMAP_POI_FIXTURE_PAYLOADS.searchCafes),
          { status: 200 },
        );
      }
      expect(input.pathname).toBe("/api/place/v4");
      expect(input.searchParams.get("refid")).toBeTruthy();
      return new Response(JSON.stringify({ lat: 10.78, lng: 106.69 }), {
        status: 200,
      });
    });
    const client = new VietmapPoiClient(config(), fetcher);

    const result = await client.search({
      category: "1001-1",
      latitude: 10.78,
      longitude: 106.69,
      radiusMeters: 750,
      text: "cafe",
    });

    expect(result).toHaveLength(2);
    expect(result.every(({ isSimulated }) => !isSimulated)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not exceed the configured request limit", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify([]), { status: 200 }),
    );
    const client = new VietmapPoiClient(config(), fetcher);
    const area = {
      latitude: 10.78,
      longitude: 106.69,
      radiusMeters: 750,
      text: "cafe",
    };

    await client.search(area);
    await expect(client.search(area)).rejects.toThrowError(
      VietmapPoiClientError,
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retries HTTP 429 responses using Retry-After", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          new Response("rate limited", {
            headers: { "retry-after": "0" },
            status: 429,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        );
      const client = new VietmapPoiClient(
        readVietmapPoiConfig({
          VIETMAP_API_KEY: "secret",
          VIETMAP_POI_ENABLED: "true",
          VIETMAP_POI_MAX_REQUESTS: "5",
          VIETMAP_POI_REQUEST_INTERVAL_MS: "0",
        }),
        fetcher,
      );

      const resultPromise = client.search({
        latitude: 10.78,
        longitude: 106.69,
        radiusMeters: 750,
        text: "cafe",
      });
      await vi.runAllTimersAsync();

      await expect(resultPromise).resolves.toEqual([]);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("enriches live search results with coordinates from Place v4", async () => {
    const fetcher = vi.fn(async (input: URL) => {
      if (input.pathname.endsWith("/search/v4")) {
        return new Response(
          JSON.stringify([
            {
              address: "Phường Võ Thị Sáu, Quận 3",
              boundaries: [],
              categories: ["1001-1"],
              entry_points: [],
              name: "Live Cafe",
              ref_id: "geocode:live-cafe",
            },
          ]),
          { status: 200 },
        );
      }
      expect(input.pathname).toBe("/api/place/v4");
      expect(input.searchParams.get("refid")).toBe("geocode:live-cafe");
      return new Response(
        JSON.stringify({
          address: "12 Đường Nguyễn Đình Chiểu",
          city: "Thành Phố Hồ Chí Minh",
          district: "Quận 3",
          hs_num: "12",
          lat: 10.7842,
          lng: 106.6902,
          street: "Đường Nguyễn Đình Chiểu",
          ward: "Phường 6",
        }),
        { status: 200 },
      );
    });
    const client = new VietmapPoiClient(
      readVietmapPoiConfig({
        VIETMAP_API_KEY: "secret",
        VIETMAP_POI_ENABLED: "true",
        VIETMAP_POI_MAX_REQUESTS: "2",
        VIETMAP_POI_REQUEST_INTERVAL_MS: "0",
      }),
      fetcher,
    );

    const [result] = await client.search({
      category: "1001-1",
      latitude: 10.78,
      longitude: 106.69,
      radiusMeters: 750,
      text: "cafe",
    });

    expect(result).toMatchObject({
      address:
        "12 Đường Nguyễn Đình Chiểu, Phường 6, Quận 3, Thành Phố Hồ Chí Minh",
      latitude: 10.7842,
      longitude: 106.6902,
      providerPlaceId: "geocode:live-cafe",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("enriches a generic POI address with Reverse v4", async () => {
    const fetcher = vi.fn(async (input: URL) => {
      if (input.pathname.endsWith("/search/v4")) {
        return new Response(
          JSON.stringify([
            {
              address: "Phường Bàn Cờ, Thành phố Hồ Chí Minh",
              boundaries: [],
              categories: ["1001-1"],
              entry_points: [],
              lat: 10.7705455,
              lng: 106.6857265,
              name: "Blue Lemon Cafe",
              ref_id: "geocode:blue-lemon",
            },
          ]),
          { status: 200 },
        );
      }
      expect(input.pathname).toBe("/api/reverse/v4");
      expect(input.searchParams.get("display_type")).toBe("5");
      return new Response(
        JSON.stringify([
          {
            data_old: {
              address: "Phường 5,Quận 3,Thành Phố Hồ Chí Minh",
              display: "2/45 Cao Thắng Phường 5,Quận 3,Thành Phố Hồ Chí Minh",
              name: "2/45 Cao Thắng",
            },
            data_new: null,
            distance: 0.000047,
            lat: 10.7705455,
            lng: 106.6857265,
            name: "2/45 Cao Thắng",
            ref_id: "vm:ADDRESS:test",
          },
        ]),
        { status: 200 },
      );
    });
    const client = new VietmapPoiClient(
      readVietmapPoiConfig({
        VIETMAP_API_KEY: "secret",
        VIETMAP_POI_ENABLED: "true",
        VIETMAP_POI_MAX_REQUESTS: "2",
        VIETMAP_POI_REQUEST_INTERVAL_MS: "0",
      }),
      fetcher,
    );

    const [result] = await client.search({
      category: "1001-1",
      latitude: 10.77,
      longitude: 106.68,
      radiusMeters: 750,
      text: "cafe",
    });

    expect(result.address).toBe(
      "2/45 Cao Thắng, Phường 5, Quận 3, Thành Phố Hồ Chí Minh",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
