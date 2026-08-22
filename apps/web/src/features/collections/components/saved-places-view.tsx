"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedPlace } from "@chon/contracts/collections";

import { SavePlaceButton } from "./save-place-button";
import {
  loadSavedPlaces,
  SavedPlaceError,
} from "../data/saved-places-repository";

export function SavedPlacesView() {
  const [places, setPlaces] = useState<readonly SavedPlace[]>([]);
  const [state, setState] = useState<
    "loading" | "ready" | "signed-out" | "error"
  >("loading");

  useEffect(() => {
    void loadSavedPlaces()
      .then((data) => {
        setPlaces(data);
        setState("ready");
      })
      .catch((error) => {
        setState(
          error instanceof SavedPlaceError && error.status === 401
            ? "signed-out"
            : "error",
        );
      });
  }, []);

  if (state === "loading")
    return <p className="text-[#756c63]">Đang tải địa điểm đã lưu…</p>;
  if (state === "signed-out")
    return (
      <p className="text-[#756c63]">Hãy đăng nhập để xem địa điểm đã lưu.</p>
    );
  if (state === "error")
    return (
      <p className="text-[#8c5a18]">
        Không thể tải danh sách. Hãy thử lại sau.
      </p>
    );
  if (places.length === 0)
    return <p className="text-[#756c63]">Bạn chưa lưu địa điểm nào.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {places.map((place) => (
        <li
          className="rounded-xl border border-[#ddd2c3] bg-[#fffdf9] p-4"
          key={place.slug}
        >
          <p className="text-xs font-bold tracking-wide text-[#756c63] uppercase">
            {place.district}
          </p>
          <Link
            className="mt-1 block text-xl font-extrabold hover:text-[#963f2a]"
            href={`/places/${place.slug}`}
          >
            {place.name}
          </Link>
          <p className="mt-2 text-sm leading-6 text-[#5e746a]">
            {place.address}
          </p>
          <SavePlaceButton
            className="mt-4"
            onSavedChange={(saved) => {
              if (!saved) {
                setPlaces((current) =>
                  current.filter(({ slug }) => slug !== place.slug),
                );
              }
            }}
            placeName={place.name}
            placeSlug={place.slug}
          />
        </li>
      ))}
    </ul>
  );
}
