import { describe, expect, it } from "vitest";

import { explainPurposeMatch } from "./explanation";

describe("explainPurposeMatch", () => {
  it("returns weighted positive reasons for a complete vibe", () => {
    const explanation = explainPurposeMatch(
      {
        crowd: 2,
        lighting: 2,
        noise: 1,
        privacy: 4,
        socialEnergy: 1,
        workability: 5,
      },
      "work",
    );

    expect(explanation.reasons).toEqual([
      "Khả năng làm việc: rất thuận tiện",
      "Mức ồn: rất yên tĩnh",
    ]);
    expect(explanation.cautions).toEqual([]);
  });

  it("returns the highest-priority caution when a dimension misses the target", () => {
    const explanation = explainPurposeMatch(
      {
        crowd: 5,
        lighting: 5,
        noise: 5,
        privacy: 1,
        socialEnergy: 5,
        workability: 1,
      },
      "work",
    );

    expect(explanation.reasons).toHaveLength(2);
    expect(explanation.cautions).toEqual([
      "Khả năng làm việc: khó làm việc; lệch 4 mức so với nhu cầu.",
    ]);
  });

  it("does not fabricate reasons without a vibe", () => {
    expect(explainPurposeMatch(null, "date")).toEqual({
      cautions: ["Chưa đủ dữ liệu vibe để giải thích mức độ phù hợp."],
      reasons: [],
    });
  });
});
