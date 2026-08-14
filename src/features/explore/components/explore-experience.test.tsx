import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExplorePlace } from "../domain/explore";
import { exploreTestDataset } from "../testing/explore-test-dataset";
import { ExploreExperience } from "./explore-experience";

type MockExploreMapProps = Readonly<{
  mapStyleUrl: string | null;
  onSelectPlace: (placeId: string) => void;
  onStatusChange?: (
    status: "unconfigured" | "loading" | "ready" | "error",
  ) => void;
  onViewportChange?: (bounds: {
    east: number;
    north: number;
    south: number;
    west: number;
  }) => void;
  places: readonly ExplorePlace[];
  selectedPlaceId: string | null;
}>;

vi.mock("./explore-map", () => ({
  ExploreMap: ({
    mapStyleUrl,
    onSelectPlace,
    onStatusChange,
    onViewportChange,
    places,
    selectedPlaceId,
  }: MockExploreMapProps) => (
    <section aria-label="Bản đồ các địa điểm" role="region">
      {!mapStyleUrl ? (
        <p>Chưa cấu hình bản đồ</p>
      ) : (
        <>
          <button
            onClick={() =>
              onViewportChange?.({
                east: 106.76,
                north: 10.85,
                south: 10.75,
                west: 106.68,
              })
            }
            type="button"
          >
            Di chuyển bản đồ
          </button>
          <button onClick={() => onStatusChange?.("error")} type="button">
            Báo lỗi bản đồ
          </button>
          {places.map((place) => (
            <button
              aria-label={`Chọn ${place.name} trên bản đồ`}
              aria-pressed={place.id === selectedPlaceId}
              key={place.id}
              onClick={() => onSelectPlace(place.id)}
              type="button"
            />
          ))}
        </>
      )}
    </section>
  ),
}));

const originalScrollIntoView = Element.prototype.scrollIntoView;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalScrollIntoView) {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  } else {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  }
});

describe("ExploreExperience", () => {
  it("labels simulated community vibe and disabled providers", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

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
    expect(screen.getByText("Chưa cấu hình bản đồ")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Bỏ qua bản đồ, đến danh sách địa điểm",
      }),
    ).toHaveAttribute("href", "#explore-results");
    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toHaveAttribute("id", "explore-results");
    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("list", { name: "Danh sách địa điểm phù hợp" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bản đồ chưa được cấu hình")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Bản đồ các địa điểm" }).parentElement,
    ).toHaveClass("self-start", "lg:sticky", "lg:top-4");
  });

  it("filters the accessible place list by district", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.change(screen.getByLabelText("Khu vực"), {
      target: { value: "Quận 1" },
    });

    const results = screen.getByRole("region", { name: "2 Chốn để thử" });
    expect(within(results).getByText("Trạm Test 02")).toBeInTheDocument();
    expect(within(results).getByText("Đèn Test 03")).toBeInTheDocument();
    expect(within(results).queryByText("Góc Test 01")).not.toBeInTheDocument();
  });

  it("supports keyboard focus and exposes selection without relying on color", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    const firstPlace = screen.getByRole("button", { name: /Góc Test 01/ });
    firstPlace.focus();
    expect(firstPlace).toHaveFocus();

    fireEvent.click(firstPlace);
    expect(firstPlace).toHaveAttribute("aria-current", "true");
    expect(firstPlace).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Đang chọn")).toBeInTheDocument();
    expect(screen.getByText("Góc Test 01 đang được chọn.")).toBeInTheDocument();
  });

  it("shows an honest no-vibe state when the selected time has no reports", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.change(screen.getByLabelText("Thời gian"), {
      target: { value: "midday" },
    });

    expect(screen.getAllByText("Chưa đủ dữ liệu vibe")).toHaveLength(3);
    expect(screen.getAllByText(/Chưa có góp ý ở khung giờ này/)).toHaveLength(
      3,
    );
  });

  it("updates the list from the map viewport while preserving ranking numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ id: "test_place_002" }],
          meta: { hasMore: false },
        }),
        ok: true,
      }),
    );
    render(
      <ExploreExperience
        dataset={exploreTestDataset}
        mapStyleUrl="https://example.test/style.json"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Di chuyển bản đồ" }));

    const results = await screen.findByRole("region", {
      name: "1 Chốn trong vùng bản đồ",
    });
    expect(within(results).getByText("Trạm Test 02")).toBeInTheDocument();
    expect(within(results).getByText("3")).toBeInTheDocument();
    expect(within(results).queryByText("Góc Test 01")).not.toBeInTheDocument();
    expect(
      within(results).getByText("1 địa điểm đang nằm trong vùng xem."),
    ).toBeInTheDocument();
  });

  it("announces the viewport loading state without hiding the fallback list", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      ),
    );
    render(
      <ExploreExperience
        dataset={exploreTestDataset}
        mapStyleUrl="https://example.test/style.json"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Di chuyển bản đồ" }));

    expect(
      screen.getByText("Đang đồng bộ danh sách với vùng bản đồ…"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("list", { name: "Danh sách địa điểm phù hợp" }),
    ).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      resolveRequest?.({
        json: async () => ({ data: [], meta: { hasMore: false } }),
        ok: true,
      });
    });
  });

  it("shows a viewport empty state and can return to the full list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ data: [], meta: { hasMore: false } }),
        ok: true,
      }),
    );
    render(
      <ExploreExperience
        dataset={exploreTestDataset}
        mapStyleUrl="https://example.test/style.json"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Di chuyển bản đồ" }));

    expect(
      await screen.findByText("Không có Chốn trong vùng này"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "0 Chốn trong vùng bản đồ" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Xem toàn bộ danh sách" }),
    );
    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toBeInTheDocument();
  });

  it("keeps the fallback list and retries after a viewport error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({
        json: async () => ({
          data: [{ id: "test_place_001" }],
          meta: { hasMore: false },
        }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ExploreExperience
        dataset={exploreTestDataset}
        mapStyleUrl="https://example.test/style.json"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Di chuyển bản đồ" }));

    expect(
      await screen.findByText(
        "Không thể cập nhật theo vùng bản đồ. Đang hiển thị danh sách dự phòng.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByRole("region", {
        name: "1 Chốn trong vùng bản đồ",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("restores the complete accessible list when the map becomes unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ id: "test_place_002" }],
          meta: { hasMore: false },
        }),
        ok: true,
      }),
    );
    render(
      <ExploreExperience
        dataset={exploreTestDataset}
        mapStyleUrl="https://example.test/style.json"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Di chuyển bản đồ" }));
    expect(
      await screen.findByRole("region", {
        name: "1 Chốn trong vùng bản đồ",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Báo lỗi bản đồ" }));

    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bản đồ đang không khả dụng")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Danh sách địa điểm phù hợp" }),
    ).not.toHaveAttribute("aria-busy", "true");
  });

  it("selects and scrolls to the matching card when a map marker is pressed", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <ExploreExperience
        dataset={exploreTestDataset}
        mapStyleUrl="https://example.test/style.json"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Chọn Trạm Test 02 trên bản đồ",
      }),
    );

    const results = screen.getByRole("region", { name: "3 Chốn để thử" });
    expect(
      within(results).getByRole("button", { name: /Trạm Test 02/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
  });
});
