import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { placeDetailTestData } from "../testing/place-detail-test-data";
import type { PlaceDetailIntent } from "../domain/place-vibe-presentation";
import { PlaceDetailView } from "./place-detail-view";

const intent: PlaceDetailIntent = {
  dayType: "weekday",
  purpose: "work",
  purposeLabel: "Làm việc",
  timeBucket: "morning",
  timeLabel: "09:00",
};

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

describe("PlaceDetailView", () => {
  it("renders verified opening hours, price and internal areas", () => {
    render(<PlaceDetailView intent={intent} place={placeDetailTestData} />);

    expect(
      screen.getByRole("heading", { name: "Góc Test", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 Đường Test/)).toBeInTheDocument();
    expect(
      screen.getByText("Prototype · địa điểm và hình ảnh mô phỏng"),
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
    expect(screen.getByRole("link", { name: /Chỉ đường/ })).toHaveAttribute(
      "href",
      `https://www.openstreetmap.org/?mlat=${placeDetailTestData.latitude}&mlon=${placeDetailTestData.longitude}#map=18/${placeDetailTestData.latitude}/${placeDetailTestData.longitude}`,
    );
  });

  it("keeps missing facts explicit without inventing values", () => {
    render(
      <PlaceDetailView
        intent={intent}
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

  it("renders canonical dimensions, confidence and evidence counts", () => {
    render(
      <PlaceDetailView
        intent={intent}
        place={placeDetailTestData}
        vibeSnapshots={[canonicalVibe]}
      />,
    );

    expect(screen.getByText(/% phù hợp/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Vì sao phù hợp với làm việc?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Độ tin cậy trung bình")).toBeInTheDocument();
    expect(screen.getByText(/3 góp ý cộng đồng/)).toBeInTheDocument();
    expect(screen.getByText("Độ ồn")).toBeInTheDocument();
    expect(screen.getByText("Làm việc")).toBeInTheDocument();
    expect(screen.getByLabelText("Làm việc: 5.0 trên 5")).toBeInTheDocument();
  });
});
