"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { CollectionSummary } from "@chon/contracts/collections";

import {
  loadCollections,
  loadOwnedCollection,
  setPlaceInCollection,
} from "../data/collections-repository";

export function CollectionPicker({
  onClose,
  onDefaultChange,
  placeName,
  placeSlug,
}: Readonly<{
  onClose: () => void;
  onDefaultChange?: (saved: boolean) => void;
  placeName: string;
  placeSlug: string;
}>) {
  const [collections, setCollections] = useState<readonly CollectionSummary[]>(
    [],
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    void loadCollections()
      .then(async (items) => {
        const details = await Promise.all(
          items.map((item) => loadOwnedCollection(item.slug)),
        );
        if (!active) return;
        setCollections(items);
        setSelected(
          new Set(
            details
              .filter((detail) =>
                detail.places.some(({ slug }) => slug === placeSlug),
              )
              .map(({ slug }) => slug),
          ),
        );
        setState("ready");
      })
      .catch(() => setState("error"));
    return () => {
      active = false;
    };
  }, [placeSlug]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-label={`Chọn bộ sưu tập cho ${placeName}`}
      aria-modal="true"
      className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <section className="my-auto w-full max-w-md rounded-2xl bg-[#fffdf9] p-5 shadow-[0_24px_80px_rgba(40,35,31,0.4)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-[#963f2a] uppercase">
              Lưu địa điểm
            </p>
            <h2 className="mt-1 text-xl font-extrabold">Chọn bộ sưu tập</h2>
          </div>
          <button
            aria-label="Đóng"
            className="h-10 w-10 rounded-full border"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {state === "loading" && (
          <p className="mt-5 text-[#756c63]">Đang tải…</p>
        )}
        {state === "error" && (
          <p className="mt-5 text-[#8c5a18]">Không thể tải bộ sưu tập.</p>
        )}
        {state === "ready" &&
          (collections.length === 0 ? (
            <p className="mt-5 text-[#756c63]">
              Bạn chưa có bộ sưu tập. Hãy tạo bộ sưu tập đầu tiên.
            </p>
          ) : (
            <ul className="mt-5 grid max-h-[50vh] gap-2 overflow-y-auto">
              {collections.map((collection) => {
                const checked = selected.has(collection.slug);
                return (
                  <li key={collection.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                      <input
                        checked={checked}
                        onChange={async () => {
                          const next = !checked;
                          await setPlaceInCollection(
                            collection.slug,
                            placeSlug,
                            next,
                          );
                          if (collection.isDefault) onDefaultChange?.(next);
                          setSelected((current) => {
                            const updated = new Set(current);
                            if (next) updated.add(collection.slug);
                            else updated.delete(collection.slug);
                            return updated;
                          });
                        }}
                        type="checkbox"
                      />
                      <span className="flex-1 font-bold">
                        {collection.name}
                      </span>
                      <span className="text-xs text-[#756c63]">
                        {collection.visibility === "public"
                          ? "Công khai"
                          : "Riêng tư"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ))}
        <Link
          className="mt-5 inline-block text-sm font-bold text-[#315d50]"
          href="/saved"
        >
          Quản lý bộ sưu tập →
        </Link>
      </section>
    </div>,
    document.body,
  );
}
