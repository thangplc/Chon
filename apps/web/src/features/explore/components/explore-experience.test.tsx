import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExplorePlace } from "../domain/explore";
import { exploreTestDataset } from "../testing/explore-test-dataset";
import { ExploreExperience } from "./explore-experience";

vi.mock("../analytics/explore-analytics", () => ({
  trackExploreEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

type MockExploreMapProps = Readonly<{
  locationSelectionEnabled?: boolean;
  mapStyleUrl: string | null;
  onSelectLocation?: (location: {
    latitude: number;
    longitude: number;
  }) => void;
  onSelectPlace: (placeId: string) => void;
  onUserLocationChange?: (location: {
    accuracy: number;
    latitude: number;
    longitude: number;
  }) => void;
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
    locationSelectionEnabled,
    mapStyleUrl,
    onSelectLocation,
    onSelectPlace,
    onUserLocationChange,
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
          {locationSelectionEnabled && (
            <button
              onClick={() =>
                onSelectLocation?.({ latitude: 10.775, longitude: 106.699 })
              }
              type="button"
            >
              Chọn tâm trên bản đồ
            </button>
          )}
          <button
            onClick={() =>
              onUserLocationChange?.({
                accuracy: 20,
                latitude: 10.775,
                longitude: 106.699,
              })
            }
            type="button"
          >
            Mô phỏng vị trí hiện tại
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

const exploreApiDataset = (() => {
  const placeIds = new Map(
    exploreTestDataset.places.map((place, index) => [
      place.id,
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ]),
  );

  return {
    ...exploreTestDataset,
    places: exploreTestDataset.places.map((place) => ({
      ...place,
      id: placeIds.get(place.id)!,
    })),
    reports: exploreTestDataset.reports.map((report) => ({
      ...report,
      placeId: placeIds.get(report.placeId)!,
    })),
  };
})();

const originalScrollIntoView = Element.prototype.scrollIntoView;

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
  window.history.replaceState(null, "", "/");
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
    const results = screen.getByRole("region", { name: "3 Chốn để thử" });
    expect(results).toHaveAttribute("id", "explore-results");
    expect(results).not.toHaveClass("-mt-10");
    expect(results).toHaveClass("rounded-xl");
    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("list", { name: "Danh sách địa điểm phù hợp" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Xem chi tiết Góc Test 01" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Bản đồ chưa được cấu hình")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Bản đồ các địa điểm" }).parentElement,
    ).toHaveClass("self-start", "chon-desktop-map-sticky");
  });

  it("hydrates shareable filters from the URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/?purpose=date&date=2026-08-17&time=19:30&duration=180&district=q1&size=large&q=Đèn",
    );

    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    expect(
      await screen.findByRole("region", { name: "1 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Khu vực")).toHaveValue("hcm-q1");
    expect(screen.getByLabelText("Ngày ghé")).toHaveValue("2026-08-17");
    expect(screen.getByLabelText("Giờ chính xác")).toHaveValue("19:30");
    expect(screen.getByLabelText("Thời lượng ngồi")).toHaveValue("180");
    expect(screen.getByRole("button", { name: "Hẹn hò" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Quy mô Lớn")).toBeChecked();
    expect(screen.getByLabelText("Tìm khu vực hoặc địa điểm")).toHaveValue(
      "Đèn",
    );
    expect(screen.getByText("Đèn Test 03")).toBeInTheDocument();
  });

  it("copies a canonical share URL and reports the result", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.change(screen.getByLabelText("Khu vực"), {
      target: { value: "hcm-q3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ bộ lọc" }));

    expect(await screen.findByText("Đã sao chép link")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("area=hcm-q3"),
    );
  });

  it("shows deterministic reasons for the ranked result", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    expect(screen.getByText("Vì sao hợp")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Khả năng làm việc: rất thuận tiện · Mức ồn: rất yên tĩnh",
      ),
    ).toBeInTheDocument();
  });

  it("filters the accessible place list by district", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.change(screen.getByLabelText("Khu vực"), {
      target: { value: "hcm-q1" },
    });

    const results = screen.getByRole("region", { name: "2 Chốn để thử" });
    expect(within(results).getByText("Trạm Test 02")).toBeInTheDocument();
    expect(within(results).getByText("Đèn Test 03")).toBeInTheDocument();
    expect(within(results).queryByText("Góc Test 01")).not.toBeInTheDocument();
  });

  it("keeps metadata changes pending until apply and clears them on apply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: exploreApiDataset }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.click(screen.getByText("Bộ lọc quy mô, tiện ích và giá"));
    fireEvent.click(screen.getByLabelText("Quy mô Nhỏ"));

    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 đang chọn")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    expect(
      await screen.findByRole("region", { name: "1 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/explore/simulated?size=small",
      { cache: "no-store" },
    );
    expect(screen.getByText("1 đang áp dụng")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(
      screen.getByRole("region", { name: "1 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Đã thay đổi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    expect(
      await screen.findByRole("region", { name: "3 Chốn để thử" }),
    ).toBeInTheDocument();
  });

  it("applies amenity filters with AND semantics and supports price levels", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: exploreApiDataset }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.click(screen.getByText("Bộ lọc quy mô, tiện ích và giá"));
    fireEvent.click(screen.getByLabelText("Tiện ích Wi-Fi"));
    fireEvent.click(screen.getByLabelText("Tiện ích Điều hòa"));

    expect(
      screen.getByRole("region", { name: "3 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));

    const amenityResults = await screen.findByRole("region", {
      name: "1 Chốn để thử",
    });
    expect(
      within(amenityResults).getByText("Trạm Test 02"),
    ).toBeInTheDocument();
    expect(
      within(amenityResults).queryByText("Góc Test 01"),
    ).not.toBeInTheDocument();
    unmount();
    window.history.replaceState(null, "", "/");

    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );
    fireEvent.click(screen.getByText("Bộ lọc quy mô, tiện ích và giá"));
    fireEvent.click(screen.getByLabelText("Phân khúc giá 3 Khá"));
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    expect(
      await screen.findByRole("region", { name: "1 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Đèn Test 03")).toBeInTheDocument();
  });

  it("searches places and areas without hiding the accessible list", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.change(screen.getByLabelText("Tìm khu vực hoặc địa điểm"), {
      target: { value: "Quận 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm" }));

    const results = screen.getByRole("region", { name: "2 Chốn để thử" });
    expect(within(results).getByText("Trạm Test 02")).toBeInTheDocument();
    expect(within(results).getByText("Đèn Test 03")).toBeInTheDocument();
    expect(within(results).queryByText("Góc Test 01")).not.toBeInTheDocument();
    expect(screen.getByText("Khu vực tìm kiếm")).toBeInTheDocument();
    expect(screen.getByText("· Đã cập nhật kết quả")).toBeInTheDocument();
  });

  it("derives the ranking time bucket from an exact date and time", () => {
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.change(screen.getByLabelText("Ngày ghé"), {
      target: { value: "2026-08-14" },
    });
    fireEvent.change(screen.getByLabelText("Giờ chính xác"), {
      target: { value: "19:30" },
    });
    fireEvent.change(screen.getByLabelText("Thời lượng ngồi"), {
      target: { value: "180" },
    });

    expect(
      screen.getByText(/14\/08\/2026 · 19:30 · 3 giờ/),
    ).toBeInTheDocument();
    expect(screen.getByText("Tối · 19:30")).toBeInTheDocument();
  });

  it("queries a selected map point with the chosen radius", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: [{ id: "test_place_002" }],
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

    fireEvent.change(screen.getByLabelText("Bán kính tìm kiếm"), {
      target: { value: "3000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Chọn trên bản đồ" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Chọn tâm trên bản đồ" }),
    );

    expect(
      await screen.findByRole("region", { name: "1 Chốn để thử" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("lat=10.775000"),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("radius=3000"),
      expect.anything(),
    );
  });

  it("supports keyboard focus and exposes selection without relying on color", async () => {
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

    const selectedPlaceCard = screen.getByRole("complementary", {
      name: "Địa điểm đang chọn: Góc Test 01",
    });
    expect(selectedPlaceCard).toHaveClass("chon-desktop-selection");
    const results = screen.getByRole("region", { name: "3 Chốn để thử" });
    expect(
      within(results).getByRole("link", { name: "Xem chi tiết" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/places/goc-test-01?purpose=work"),
    );
    expect(
      within(results).getByRole("button", { name: "Góp vibe" }),
    ).toBeInTheDocument();
    expect(
      within(selectedPlaceCard).getByRole("link", { name: "Mở chi tiết" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/places/goc-test-01?purpose=work"),
    );
    fireEvent.click(
      within(selectedPlaceCard).getByRole("button", {
        name: "Đóng thẻ Góc Test 01",
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("complementary", {
          name: "Địa điểm đang chọn: Góc Test 01",
        }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Mở thẻ Góc Test 01" }),
    ).toBeInTheDocument();
    expect(firstPlace).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Mở thẻ Góc Test 01" }));
    expect(
      screen.getByRole("complementary", {
        name: "Địa điểm đang chọn: Góc Test 01",
      }),
    ).toBeInTheDocument();
  });

  it("opens the quick contribution modal from the selected place card", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: {} }), { status: 200 }),
        ),
    );
    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Góc Test 01/ }));
    fireEvent.click(
      within(
        screen.getByRole("complementary", {
          name: "Địa điểm đang chọn: Góc Test 01",
        }),
      ).getByRole("button", { name: /Góp vibe/ }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /Bạn đang chia sẻ trải nghiệm nào/,
      }),
    ).toBeInTheDocument();
    expect(window.location.search).toContain("contribute=1");
    expect(window.location.search).toContain("place=goc-test-01");

    fireEvent.click(screen.getByRole("button", { name: "Đóng góp vibe" }));
    expect(window.location.search).not.toContain("contribute=1");
  });

  it("restores the quick contribution modal after an OAuth callback", async () => {
    window.history.replaceState(null, "", "/?contribute=1&place=goc-test-01");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: {} }), { status: 200 }),
        ),
    );

    render(
      <ExploreExperience dataset={exploreTestDataset} mapStyleUrl={null} />,
    );

    expect(
      await screen.findByRole("heading", {
        name: /Bạn đang chia sẻ trải nghiệm nào/,
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "3 Chốn để thử" })).getByRole(
        "button",
        { name: /^Hạng .*Góc Test 01/ },
      ),
    ).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("contribute=1");
    expect(window.location.search).toContain("place=goc-test-01");
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
      within(results).getByRole("button", { name: /^Hạng .*Trạm Test 02/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
  });
});
