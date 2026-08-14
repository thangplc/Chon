"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type PlaceDetailBackControlProps = Readonly<{
  presentation: "page" | "drawer";
}>;

const className =
  "inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-[#315d50] transition-colors hover:bg-white/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]";

function DrawerBackButton() {
  const router = useRouter();

  return (
    <button className={className} onClick={() => router.back()} type="button">
      <span aria-hidden="true">←</span>
      Trở về Explore
    </button>
  );
}

export function PlaceDetailBackControl({
  presentation,
}: PlaceDetailBackControlProps) {
  if (presentation === "drawer") return <DrawerBackButton />;

  return (
    <Link className={className} href="/">
      <span aria-hidden="true">←</span>
      Trở về Explore
    </Link>
  );
}
