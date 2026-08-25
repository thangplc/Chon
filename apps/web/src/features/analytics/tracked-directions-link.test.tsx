import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrackedDirectionsLink } from "./tracked-directions-link";
import { trackAnalyticsEvent } from "./client";

vi.mock("./client", () => ({ trackAnalyticsEvent: vi.fn() }));

describe("TrackedDirectionsLink", () => {
  it("records the destination after an intentional click", () => {
    render(
      <TrackedDirectionsLink
        href="https://www.openstreetmap.org"
        placeSlug="goc-may-01"
        surface="place_detail"
      >
        Chỉ đường
      </TrackedDirectionsLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Chỉ đường" }));
    expect(trackAnalyticsEvent).toHaveBeenCalledWith("directions_opened", {
      placeSlug: "goc-may-01",
      provider: "openstreetmap",
      surface: "place_detail",
    });
  });
});
