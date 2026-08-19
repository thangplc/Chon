import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VibeReportFlow } from "./vibe-report-flow";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}));

describe("VibeReportFlow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/places/goc-may-01");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              accuracy: 30,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              latitude: 10.78,
              longitude: 106.7,
              speed: null,
            } as GeolocationCoordinates,
            timestamp: Date.now(),
          } as GeolocationPosition),
        ),
      },
    });
  });

  it("walks through three steps and submits a pending report", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: "33333333-3333-4333-8333-333333333333",
              locationVerification: "none",
              moderationStatus: "pending",
              placeId: "22222222-2222-4222-8222-222222222222",
              submittedAt: "2026-08-16T02:00:00.000Z",
            },
          }),
          { status: 201 },
        ),
      );

    render(<VibeReportFlow placeName="Góc Mây 01" placeSlug="goc-may-01" />);

    fireEvent.click(screen.getByRole("button", { name: /Góp vibe/ }));
    expect(
      await screen.findByRole("heading", { name: /Bạn ghé Chốn này khi nào/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xác minh vị trí" }));
    expect(screen.getByText("Đã lấy vị trí")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(
      screen.getByRole("heading", { name: /Chấm nhanh không khí/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mức ồn: 1 trên 5" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Độ riêng tư: 4 trên 5" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Khả năng làm việc: 5 trên 5" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(
      screen.getByRole("heading", { name: /Thêm ghi chú nếu muốn/ }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("textbox", { name: /Ghi chú tùy chọn/ }),
      {
        target: { value: "Buổi sáng khá yên tĩnh." },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Gửi góp vibe" }));

    expect(
      await screen.findByRole("heading", { name: "Đã nhận góp vibe" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/places/goc-may-01/vibe-reports",
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      locationEvidence: {
        accuracyMeters: 30,
        latitude: 10.78,
        longitude: 106.7,
      },
      scores: { noise: 1, privacy: 4, workability: 5 },
      shortNote: "Buổi sáng khá yên tĩnh.",
      visitMode: "work",
    });
  });

  it("shows a login gate for guests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 401 }), { status: 401 }),
    );

    render(<VibeReportFlow placeName="Góc Mây 01" placeSlug="goc-may-01" />);
    fireEvent.click(screen.getByRole("button", { name: /Góp vibe/ }));

    expect(
      await screen.findByText("Cần đăng nhập để góp vibe"),
    ).toBeInTheDocument();

    await screen.getByRole("button", { name: "Đăng nhập bằng Google" }).click();

    expect(signInMock).toHaveBeenCalledWith("google", {
      callbackUrl:
        "http://localhost:3000/places/goc-may-01?contribute=1&place=goc-may-01",
    });
  });

  it("resumes the contribution flow after OAuth callback", async () => {
    window.history.replaceState({}, "", "/places/goc-may-01?contribute=1");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    render(<VibeReportFlow placeName="Góc Mây 01" placeSlug="goc-may-01" />);

    expect(
      await screen.findByRole("heading", { name: /Bạn ghé Chốn này khi nào/ }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("shows an unavailable state when the backend auth check fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 503 }), { status: 503 }),
    );

    render(<VibeReportFlow placeName="Góc Mây 01" placeSlug="goc-may-01" />);
    fireEvent.click(screen.getByRole("button", { name: /Góp vibe/ }));

    expect(
      await screen.findByText("Chưa thể xác minh phiên đăng nhập"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Cần đăng nhập để góp vibe"),
    ).not.toBeInTheDocument();
  });
});
