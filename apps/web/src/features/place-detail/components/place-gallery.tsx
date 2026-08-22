"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

import type { PlaceDetailMedia } from "../domain/place-detail";

type PlaceGalleryProps = Readonly<{
  matchScore?: number | null;
  media: readonly PlaceDetailMedia[];
  placeName: string;
}>;

export function PlaceGallery({
  matchScore = null,
  media,
  placeName,
}: PlaceGalleryProps) {
  const [selectedId, setSelectedId] = useState(media[0]?.id ?? null);
  const selected = media.find(({ id }) => id === selectedId) ?? media[0];

  if (!selected) {
    return (
      <section
        aria-label={`Hình ảnh của ${placeName}`}
        className="grid min-h-56 place-items-center rounded-3xl border border-dashed border-[#c96040]/25 bg-[#f5ddd3] p-6 text-center sm:min-h-72 sm:p-8"
      >
        <div className="max-w-sm">
          <span aria-hidden="true" className="text-4xl">
            ◌
          </span>
          <h2 className="mt-3 text-lg font-bold text-[#963f2a]">
            Chưa có ảnh đã xác minh
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5e746a]">
            Chốn không dùng ảnh bên thứ ba khi chưa có quyền hiển thị.
          </p>
        </div>
      </section>
    );
  }

  const selectedIndex = Math.max(
    0,
    media.findIndex(({ id }) => id === selected.id),
  );
  const selectRelativeImage = (offset: number) => {
    const targetIndex = (selectedIndex + offset + media.length) % media.length;
    const target = media[targetIndex];
    if (target) setSelectedId(target.id);
  };

  return (
    <section aria-label={`Hình ảnh của ${placeName}`}>
      <figure className="overflow-hidden rounded-3xl bg-[#d9ddc7] shadow-sm">
        <div className="relative aspect-[3/2] overflow-hidden">
          <img
            alt={selected.altText}
            className="chon-place-gallery-image size-full object-cover"
            decoding="async"
            height={selected.height}
            key={selected.id}
            src={selected.url}
            width={selected.width}
          />
          {selected.isSimulated && (
            <span className="absolute top-4 left-4 rounded-full bg-[#963f2a]/90 px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur">
              Ảnh minh họa giả lập
            </span>
          )}
          {matchScore !== null && (
            <span className="absolute right-4 bottom-4 rounded-full bg-[#fffdf9]/95 px-3 py-1.5 text-xs font-extrabold text-[#28231f] shadow-sm backdrop-blur">
              {matchScore}% phù hợp
            </span>
          )}
          {media.length > 1 && (
            <>
              <button
                aria-label="Ảnh trước"
                className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-[#963f2a]/90 text-3xl leading-none text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-[#963f2a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                onClick={() => selectRelativeImage(-1)}
                type="button"
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                aria-label="Ảnh tiếp theo"
                className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-[#963f2a]/90 text-3xl leading-none text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-[#963f2a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                onClick={() => selectRelativeImage(1)}
                type="button"
              >
                <span aria-hidden="true">›</span>
              </button>
              <span
                aria-live="polite"
                className={`absolute bottom-4 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur ${matchScore === null ? "right-4" : "left-4"}`}
              >
                {selectedIndex + 1} / {media.length}
              </span>
            </>
          )}
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 bg-white/90 px-4 py-2.5 text-xs text-[#5e746a]">
          <span>{selected.altText}</span>
          <span className="font-semibold text-[#315d50]">
            Nguồn: {selected.sourceLabel}
          </span>
        </figcaption>
      </figure>

      {media.length > 1 && (
        <div
          aria-label="Chọn ảnh xem trước"
          className="mt-2 grid grid-cols-5 gap-1.5 sm:gap-2"
          role="group"
        >
          {media.map((item, index) => (
            <button
              aria-label={`Xem ảnh ${index + 1}: ${item.altText}`}
              aria-pressed={item.id === selected.id}
              className={`aspect-[1.35] overflow-hidden rounded-lg border-2 bg-[#eee6da] transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] ${
                item.id === selected.id
                  ? "border-[#c96040] shadow-md"
                  : "border-transparent opacity-75 hover:opacity-100"
              }`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              type="button"
            >
              <img
                alt=""
                className="size-full object-cover"
                height={item.height}
                src={item.url}
                width={item.width}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
