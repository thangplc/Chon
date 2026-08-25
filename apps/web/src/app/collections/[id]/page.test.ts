import { afterEach, describe, expect, it, vi } from "vitest";

import { generateMetadata } from "./page";
import { loadPublicCollectionServer } from "@/features/collections/server/load-public-collection";

vi.mock("@/features/collections/server/load-public-collection", () => ({
  loadPublicCollectionServer: vi.fn(),
}));

const collection = {
  description: "Những quán phù hợp làm việc sâu.",
  id: "11111111-1111-4111-8111-111111111111",
  isDefault: false,
  name: "Cafe làm việc ở Quy Nhơn",
  ownerType: "editorial" as const,
  placeCount: 2,
  places: [],
  publishedAt: "2026-08-22T00:00:00.000Z",
  slug: "cafe-lam-viec-o-quy-nhon",
  status: "published" as const,
  visibility: "public" as const,
};

describe("public collection metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("uses the configured public origin for canonical and social metadata", async () => {
    vi.stubEnv("SITE_URL", "https://chon.example");
    vi.mocked(loadPublicCollectionServer).mockResolvedValue(collection);
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: collection.id }),
    });

    expect(metadata.title).toBe(collection.name);
    expect(metadata.alternates?.canonical).toBe(
      `https://chon.example/collections/${collection.id}`,
    );
    expect(metadata.openGraph).toMatchObject({
      description: collection.description,
      title: collection.name,
    });
  });

  it("marks unavailable or private collections as noindex", async () => {
    vi.mocked(loadPublicCollectionServer).mockResolvedValue(null);
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: collection.id }),
    });
    expect(metadata.robots).toEqual({ follow: false, index: false });
  });
});
