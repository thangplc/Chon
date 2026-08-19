"use client";

import Link from "next/link";

export function PlaceDetailBackControl({
  compact = false,
  href = "/",
}: Readonly<{ compact?: boolean; href?: string }>) {
  return (
    <Link
      aria-label={compact ? "Trở về Explore" : undefined}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#ddd2c3] bg-[#fffdf9] px-3 text-sm font-bold text-[#28231f] transition-colors hover:border-[#c96040] hover:text-[#963f2a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] ${compact ? "size-10 p-0 text-xl" : ""}`}
      href={href}
    >
      <span aria-hidden="true">←</span>
      {!compact && "Trở về Explore"}
    </Link>
  );
}
