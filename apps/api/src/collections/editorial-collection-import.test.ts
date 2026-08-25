import { describe, expect, it } from "vitest";

import { parseEditorialCollectionRows } from "./editorial-collection-import";

const row = {
  collection_name: "Cafe làm việc tại Sài Gòn",
  collection_slug: "cafe-lam-viec-sai-gon",
  description: "Các POI thật do Chốn tuyển chọn.",
  environment: "local",
  note: "Không gian tham khảo.",
  place_internal_id: "vietmap_abc123",
  position: "0",
  status: "published",
};

describe("parseEditorialCollectionRows", () => {
  it("parses a valid editorial collection", () => {
    expect(parseEditorialCollectionRows([row])).toEqual([
      { ...row, note: row.note, position: 0 },
    ]);
  });

  it("rejects duplicate place membership", () => {
    expect(() =>
      parseEditorialCollectionRows([row, { ...row, position: "1" }]),
    ).toThrow("duplicate places");
  });

  it("rejects inconsistent collection metadata", () => {
    expect(() =>
      parseEditorialCollectionRows([
        row,
        { ...row, collection_name: "Tên khác", position: "1" },
      ]),
    ).toThrow("inconsistent metadata");
  });
});
