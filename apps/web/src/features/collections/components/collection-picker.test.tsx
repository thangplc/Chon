import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { trackAnalyticsEvent } from "@/features/analytics/client";
import {
  loadCollections,
  loadOwnedCollection,
  setPlaceInCollection,
} from "../data/collections-repository";
import { CollectionPicker } from "./collection-picker";

vi.mock("@/features/analytics/client", () => ({
  trackAnalyticsEvent: vi.fn(),
}));
vi.mock("../data/collections-repository", () => ({
  loadCollections: vi.fn(),
  loadOwnedCollection: vi.fn(),
  setPlaceInCollection: vi.fn(),
}));

const collection = {
  description: null,
  id: "11111111-1111-4111-8111-111111111111",
  isDefault: false,
  name: "Cafe làm việc",
  ownerType: "user" as const,
  placeCount: 0,
  publishedAt: "2026-08-22T00:00:00.000Z",
  slug: "cafe-lam-viec",
  status: "published" as const,
  visibility: "private" as const,
};

describe("CollectionPicker", () => {
  it("tracks a place only after the collection write succeeds", async () => {
    vi.mocked(loadCollections).mockResolvedValue([collection]);
    vi.mocked(loadOwnedCollection).mockResolvedValue({
      ...collection,
      places: [],
    });
    vi.mocked(setPlaceInCollection).mockResolvedValue(undefined);

    render(
      <CollectionPicker
        onClose={vi.fn()}
        placeName="Góc Mây"
        placeSlug="goc-may-01"
        surface="explore"
      />,
    );
    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(trackAnalyticsEvent).toHaveBeenCalledWith("place_save_succeeded", {
        collectionType: "custom",
        placeSlug: "goc-may-01",
        surface: "explore",
      }),
    );
  });
});
