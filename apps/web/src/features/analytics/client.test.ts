import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackAnalyticsEvent } from "./client";

describe("trackAnalyticsEvent", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends a privacy-safe event with a stable anonymous session", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });

    trackAnalyticsEvent("directions_opened", {
      placeSlug: "goc-may-01",
      provider: "openstreetmap",
      surface: "place_detail",
    });
    trackAnalyticsEvent("directions_opened", {
      placeSlug: "goc-may-01",
      provider: "openstreetmap",
      surface: "place_detail",
    });

    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem("chon.analytics.session_id")).toMatch(
      /^anon_/,
    );
  });

  it("falls back to keepalive fetch when beacon is rejected", () => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);

    trackAnalyticsEvent("collection_share_clicked", {
      collectionId: "11111111-1111-4111-8111-111111111111",
      ownerType: "user",
      placeCount: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({ keepalive: true, method: "POST" }),
    );
  });
});
