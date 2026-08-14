import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaceDetailDrawer } from "./place-detail-drawer";

const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
}));

describe("PlaceDetailDrawer", () => {
  beforeEach(() => back.mockClear());

  it("is an accessible dialog and closes from button or Escape", () => {
    render(
      <PlaceDetailDrawer>
        <p>Nội dung chi tiết</p>
      </PlaceDetailDrawer>,
    );

    expect(
      screen.getByRole("dialog", { name: "Chi tiết địa điểm" }),
    ).toHaveAttribute("aria-modal", "true");
    const closeButton = screen.getByRole("button", {
      name: "Đóng chi tiết địa điểm",
    });
    expect(closeButton).toHaveFocus();
    fireEvent.click(closeButton);
    expect(back).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(back).toHaveBeenCalledTimes(2);
  });

  it("does not close when the backdrop is clicked", () => {
    render(
      <PlaceDetailDrawer>
        <p>Nội dung chi tiết</p>
      </PlaceDetailDrawer>,
    );

    fireEvent.click(screen.getByTestId("place-detail-backdrop"));

    expect(back).not.toHaveBeenCalled();
  });
});
