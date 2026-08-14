import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { placeDetailTestData } from "../testing/place-detail-test-data";
import { PlaceDetailView } from "./place-detail-view";

const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
}));

vi.mock("./place-detail-map", () => ({
  PlaceDetailMap: ({ name }: { name: string }) => (
    <section aria-label={`Vị trí của ${name}`} />
  ),
}));

describe("PlaceDetailView", () => {
  beforeEach(() => back.mockClear());

  it("renders base place information without inventing later Sprint 3 data", () => {
    render(<PlaceDetailView mapStyleUrl={null} place={placeDetailTestData} />);

    expect(
      screen.getByRole("heading", { name: "Góc Test", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 Đường Test/)).toBeInTheDocument();
    expect(
      screen.getByText("Địa điểm và hình ảnh đang là dữ liệu giả lập"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Trở về Explore" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByText(/Giờ mở cửa, mức giá, khu vực trong quán/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Vị trí của Góc Test" }),
    ).toBeInTheDocument();
  });

  it("returns through router history when rendered inside the drawer", () => {
    render(
      <PlaceDetailView
        mapStyleUrl={null}
        place={placeDetailTestData}
        presentation="drawer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trở về Explore" }));

    expect(back).toHaveBeenCalledOnce();
  });
});
