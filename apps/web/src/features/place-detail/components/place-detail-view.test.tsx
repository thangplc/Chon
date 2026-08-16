import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { placeDetailTestData } from "../testing/place-detail-test-data";
import { PlaceDetailView } from "./place-detail-view";

const canonicalVibe = {
  aggregationVersion: "fusion-v1",
  component: "canonical" as const,
  confidence: { level: "medium" as const, score: 0.6 },
  dayType: "weekday" as const,
  generatedAt: new Date("2026-08-16T03:00:00Z"),
  isSimulated: false,
  lastReportAt: new Date("2026-08-16T03:00:00Z"),
  placeAreaId: null,
  placeId: "22222222-2222-4222-8222-222222222222",
  providerSignalCount: 1,
  reportCount: 3,
  scores: {
    crowd: 2,
    lighting: 3,
    noise: 1,
    privacy: 4,
    socialEnergy: 2,
    workability: 5,
  },
  sourceDataTypes: ["community" as const],
  sourceProviders: ["foursquare_places"],
  timeBucket: "morning" as const,
};

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

  it("renders verified opening hours, price and internal areas", () => {
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
      screen.getByRole("heading", { name: "Thông tin địa điểm" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Xem lịch cả tuần")).toBeInTheDocument();
    expect(screen.getByText(/45\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Phân khúc: Phổ thông/)).toBeInTheDocument();
    expect(screen.getByText("Khu trong nhà")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Vị trí của Góc Test" }),
    ).toBeInTheDocument();
  });

  it("keeps missing facts explicit without inventing values", () => {
    render(
      <PlaceDetailView
        mapStyleUrl={null}
        place={{
          ...placeDetailTestData,
          areas: [],
          amenities: [],
          estimatedCapacity: null,
          openingHours: null,
          priceLevel: null,
          sizeCategory: "unknown",
          spaceNote: null,
          typicalSpendMax: null,
          typicalSpendMin: null,
        }}
      />,
    );

    expect(
      screen.getByText("Chưa có lịch mở cửa đã xác minh."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chưa có thông tin giá đã xác minh."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chưa có thông tin không gian đã xác minh."),
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

  it("offers canonical full-page navigation from the drawer", () => {
    render(
      <PlaceDetailView
        mapStyleUrl={null}
        place={placeDetailTestData}
        presentation="drawer"
      />,
    );

    expect(screen.getByRole("link", { name: /Mở toàn trang/ })).toHaveAttribute(
      "href",
      "/places/goc-test",
    );
  });

  it("renders canonical dimensions, confidence and evidence counts", () => {
    render(
      <PlaceDetailView
        mapStyleUrl={null}
        place={placeDetailTestData}
        vibeSnapshots={[canonicalVibe]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Chốn vibe" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tin cậy trung bình")).toBeInTheDocument();
    expect(screen.getByText("3 góp ý · 1 nguồn bổ trợ")).toBeInTheDocument();
    expect(screen.getByText("Ồn")).toBeInTheDocument();
    expect(screen.getByText("Làm việc")).toBeInTheDocument();
    expect(screen.getByText("5.0/5")).toBeInTheDocument();
  });
});
