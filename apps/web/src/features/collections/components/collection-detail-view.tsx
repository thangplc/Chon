"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CollectionDetail } from "@chon/contracts/collections";

import {
  loadOwnedCollection,
  loadPublicCollection,
  setPlaceInCollection,
} from "../data/collections-repository";

export function CollectionDetailView({
  identifier,
  initialCollection = null,
  owned,
}: Readonly<{
  identifier: string;
  initialCollection?: CollectionDetail | null;
  owned: boolean;
}>) {
  const [collection, setCollection] = useState<CollectionDetail | null>(
    initialCollection,
  );
  const [state, setState] = useState<"loading" | "ready" | "error">(
    initialCollection ? "ready" : "loading",
  );
  const load = useCallback(
    () =>
      (owned
        ? loadOwnedCollection(identifier)
        : loadPublicCollection(identifier)
      ).then((data) => {
        setCollection(data);
        setState("ready");
      }),
    [identifier, owned],
  );
  useEffect(() => {
    if (initialCollection && !owned) return;
    void load().catch(() => setState("error"));
  }, [initialCollection, load, owned]);
  if (state === "loading") return <p>Đang tải bộ sưu tập…</p>;
  if (state === "error" || !collection)
    return <p>Không tìm thấy bộ sưu tập hoặc bạn không có quyền xem.</p>;
  return (
    <section className="rounded-3xl border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-sm sm:p-8">
      <p className="text-xs font-bold tracking-wide text-[#963f2a] uppercase">
        {collection.ownerType === "editorial"
          ? "Chốn tuyển chọn"
          : collection.visibility === "public"
            ? "Bộ sưu tập công khai"
            : "Bộ sưu tập riêng tư"}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold sm:text-4xl">
          {collection.name}
        </h1>
        {collection.visibility === "public" && (
          <button
            className="rounded-xl border px-4 py-2 font-bold"
            onClick={() =>
              void navigator.clipboard.writeText(
                `${window.location.origin}/collections/${collection.id}`,
              )
            }
            type="button"
          >
            Sao chép link
          </button>
        )}
      </div>
      {collection.description && (
        <p className="mt-4 max-w-2xl text-[#5e746a]">
          {collection.description}
        </p>
      )}
      <p className="mt-3 text-sm font-bold text-[#756c63]">
        {collection.placeCount} địa điểm
      </p>
      {collection.places.length === 0 ? (
        <p className="mt-8 text-[#756c63]">Bộ sưu tập chưa có địa điểm.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {collection.places.map((place) => (
            <li
              className="flex min-h-52 flex-col rounded-2xl border border-[#ddd2c3] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c96040] hover:shadow-md"
              key={place.slug}
            >
              <p className="text-xs font-bold text-[#756c63] uppercase">
                {place.district}
              </p>
              <Link
                className="mt-1 block text-xl font-extrabold"
                href={`/places/${place.slug}`}
              >
                {place.name}
              </Link>
              <p className="mt-2 text-sm text-[#5e746a]">{place.address}</p>
              {place.note && (
                <p className="mt-3 rounded-xl bg-[#f7f2eb] px-3 py-2 text-sm text-[#756c63]">
                  {place.note}
                </p>
              )}
              {!owned && (
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Link
                    className="rounded-xl bg-[#c96040] px-4 py-2 text-sm font-bold text-white"
                    href={`/places/${place.slug}`}
                  >
                    Mở địa điểm
                  </Link>
                  <a
                    className="rounded-xl border border-[#ddd2c3] px-4 py-2 text-sm font-bold"
                    href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(place.address)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Chỉ đường ↗
                  </a>
                </div>
              )}
              {owned && (
                <button
                  className="mt-4 text-sm font-bold text-[#963f2a]"
                  onClick={async () => {
                    await setPlaceInCollection(
                      collection.slug,
                      place.slug,
                      false,
                    );
                    await load();
                  }}
                  type="button"
                >
                  Xóa khỏi bộ sưu tập
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
