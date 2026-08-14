"use client";

import Link from "next/link";
import { useEffect } from "react";

type PlaceDetailErrorProps = Readonly<{
  error: Error & Readonly<{ digest?: string }>;
  reset: () => void;
}>;

export default function PlaceDetailError({
  error,
  reset,
}: PlaceDetailErrorProps) {
  useEffect(() => {
    console.error("Place detail route failed", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3efe5] px-6 text-center text-[#18352d]">
      <div className="max-w-lg rounded-[2rem] border border-[#805b39]/20 bg-white/90 p-8 shadow-xl">
        <p className="text-xs font-bold tracking-[0.15em] text-[#805b39] uppercase">
          Không thể tải chi tiết
        </p>
        <h1 className="mt-3 text-3xl font-bold">Đã có lỗi từ dữ liệu</h1>
        <p className="mt-3 text-sm leading-6 text-[#5e746a]">
          Bạn có thể thử lại hoặc quay về danh sách địa điểm accessible.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            className="rounded-xl bg-[#173f33] px-5 py-3 text-sm font-bold text-white"
            onClick={reset}
            type="button"
          >
            Thử lại
          </button>
          <Link
            className="rounded-xl border border-[#173f33]/15 px-5 py-3 text-sm font-bold"
            href="/"
          >
            Về Explore
          </Link>
        </div>
      </div>
    </main>
  );
}
