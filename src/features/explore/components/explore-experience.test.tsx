import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { exploreTestDataset } from "../testing/explore-test-dataset";
import { ExploreExperience } from "./explore-experience";

describe("ExploreExperience", () => {
  it("labels simulated community vibe and disabled providers", () => {
    render(<ExploreExperience dataset={exploreTestDataset} />);

    expect(
      screen.getByRole("heading", {
        name: "Hôm nay bạn cần một Chốn thế nào?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Môi trường thử nghiệm · Vibe cộng đồng mô phỏng"),
    ).toBeInTheDocument();
    expect(screen.getByText("Provider vibe: Tắt")).toBeInTheDocument();
    expect(screen.getByText("3 Chốn để thử")).toBeInTheDocument();
  });

  it("filters the accessible place list by district", () => {
    render(<ExploreExperience dataset={exploreTestDataset} />);

    fireEvent.change(screen.getByLabelText("Khu vực"), {
      target: { value: "Quận 1" },
    });

    const results = screen.getByRole("region", { name: "2 Chốn để thử" });
    expect(within(results).getByText("Trạm Test 02")).toBeInTheDocument();
    expect(within(results).getByText("Đèn Test 03")).toBeInTheDocument();
    expect(within(results).queryByText("Góc Test 01")).not.toBeInTheDocument();
  });

  it("shows an honest no-vibe state when the selected time has no reports", () => {
    render(<ExploreExperience dataset={exploreTestDataset} />);

    fireEvent.change(screen.getByLabelText("Thời gian"), {
      target: { value: "midday" },
    });

    expect(screen.getAllByText("Chưa đủ dữ liệu vibe")).toHaveLength(3);
    expect(screen.getAllByText(/Chưa có góp ý ở khung giờ này/)).toHaveLength(
      3,
    );
  });
});
