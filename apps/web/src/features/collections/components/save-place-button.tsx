"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import {
  loadSavedPlaceStatus,
  SavedPlaceError,
  setSavedPlace,
} from "../data/saved-places-repository";
import { CollectionPicker } from "./collection-picker";

type SavePlaceButtonProps = Readonly<{
  className?: string;
  compact?: boolean;
  onSavedChange?: (saved: boolean) => void;
  placeName: string;
  placeSlug: string;
}>;

export function SavePlaceButton({
  className = "",
  compact = false,
  onSavedChange,
  placeName,
  placeSlug,
}: SavePlaceButtonProps) {
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<
    "checking" | "idle" | "saving" | "signed-out" | "error"
  >("checking");

  useEffect(() => {
    let active = true;
    void loadSavedPlaceStatus(placeSlug)
      .then(async (result) => {
        if (!active) return;
        setSaved(result.saved);
        setStatus("idle");

        const url = new URL(window.location.href);
        if (url.searchParams.get("savePlace") !== placeSlug || result.saved) {
          return;
        }
        setStatus("saving");
        const updated = await setSavedPlace(placeSlug, true);
        if (!active) return;
        setSaved(updated.saved);
        setStatus("idle");
        url.searchParams.delete("savePlace");
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      })
      .catch((error) => {
        if (!active) return;
        setStatus(
          error instanceof SavedPlaceError && error.status === 401
            ? "signed-out"
            : "error",
        );
      });
    return () => {
      active = false;
    };
  }, [placeSlug]);

  async function toggleSaved() {
    if (status === "signed-out") {
      const callbackUrl = new URL(window.location.href);
      callbackUrl.searchParams.set("savePlace", placeSlug);
      await signIn("google", { callbackUrl: callbackUrl.toString() });
      return;
    }
    if (status === "checking" || status === "saving") return;

    const previous = saved;
    setSaved(!previous);
    setStatus("saving");
    try {
      const result = await setSavedPlace(placeSlug, !previous);
      setSaved(result.saved);
      onSavedChange?.(result.saved);
      setStatus("idle");
    } catch (error) {
      setSaved(previous);
      setStatus(
        error instanceof SavedPlaceError && error.status === 401
          ? "signed-out"
          : "error",
      );
    }
  }

  const busy = status === "checking" || status === "saving";
  const label =
    status === "signed-out"
      ? "Đăng nhập để lưu"
      : status === "error"
        ? "Thử lưu lại"
        : saved
          ? "Đã lưu"
          : "Lưu";

  return (
    <>
      <button
        aria-label={`${label} ${placeName}`}
        aria-pressed={saved}
        className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#ddd2c3] bg-[#fffdf9] px-3 text-sm font-extrabold text-[#28231f] transition hover:border-[#c96040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] disabled:cursor-wait disabled:opacity-60 ${className}`}
        disabled={busy}
        onClick={() => {
          if (status === "signed-out") void toggleSaved();
          else if (!busy) setPickerOpen(true);
        }}
        type="button"
      >
        <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
        {!compact && (
          <span>
            {busy
              ? "Đang tải…"
              : saved
                ? "Đã lưu · Chọn bộ sưu tập"
                : "Lưu vào bộ sưu tập"}
          </span>
        )}
      </button>
      {pickerOpen && (
        <CollectionPicker
          onClose={() => setPickerOpen(false)}
          onDefaultChange={(nextSaved) => {
            setSaved(nextSaved);
            onSavedChange?.(nextSaved);
          }}
          placeName={placeName}
          placeSlug={placeSlug}
        />
      )}
    </>
  );
}
