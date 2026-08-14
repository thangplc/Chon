import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { placeDetailTestData } from "../testing/place-detail-test-data";
import { PlaceGallery } from "./place-gallery";

describe("PlaceGallery", () => {
  it("shows approved media with explicit simulated provenance", () => {
    render(
      <PlaceGallery
        media={placeDetailTestData.media}
        placeName={placeDetailTestData.name}
      />,
    );

    expect(screen.getByAltText("Góc cửa sổ thử nghiệm")).toBeInTheDocument();
    expect(screen.getByText("Ảnh minh họa giả lập")).toBeInTheDocument();
    expect(
      screen.getByText("Nguồn: Minh họa giả lập của Chốn"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ảnh tiếp theo" }));
    expect(screen.getByAltText("Góc đọc sách thử nghiệm")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ảnh trước" }));
    expect(screen.getByAltText("Góc cửa sổ thử nghiệm")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Xem ảnh 2: Góc đọc sách thử nghiệm",
      }),
    );
    expect(screen.getByAltText("Góc đọc sách thử nghiệm")).toBeInTheDocument();
  });

  it("uses an honest empty state when no media is approved", () => {
    render(<PlaceGallery media={[]} placeName="Chốn không ảnh" />);

    expect(
      screen.getByRole("heading", { name: "Chưa có ảnh đã xác minh" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/không dùng ảnh bên thứ ba khi chưa có quyền/),
    ).toBeInTheDocument();
  });
});
