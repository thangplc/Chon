import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { trackAnalyticsEvent } from "@/features/analytics/client";
import { CollectionDetailView } from "./collection-detail-view";

vi.mock("@/features/analytics/client", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

const collection = {
  description: "Danh sách Chốn tuyển chọn.",
  id: "11111111-1111-4111-8111-111111111111",
  isDefault: false,
  name: "Cafe Sài Gòn",
  ownerType: "editorial" as const,
  placeCount: 0,
  places: [],
  publishedAt: "2026-08-22T00:00:00.000Z",
  slug: "cafe-sai-gon",
  status: "published" as const,
  visibility: "public" as const,
};

describe("CollectionDetailView", () => {
  it("tracks sharing only after the public URL is copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <CollectionDetailView
        identifier={collection.id}
        initialCollection={collection}
        owned={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sao chép link" }));
    await waitFor(() =>
      expect(trackAnalyticsEvent).toHaveBeenCalledWith(
        "collection_share_clicked",
        {
          collectionId: collection.id,
          ownerType: "editorial",
          placeCount: 0,
        },
      ),
    );
  });
});
