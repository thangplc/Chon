"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

type PlaceDetailDrawerProps = Readonly<{ children: ReactNode }>;

export function PlaceDetailDrawer({ children }: PlaceDetailDrawerProps) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.back();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div
        aria-hidden="true"
        className="chon-place-detail-backdrop absolute inset-0 bg-[#10251f]/55 backdrop-blur-sm"
        data-testid="place-detail-backdrop"
      />
      <section
        aria-label="Chi tiết địa điểm"
        aria-modal="true"
        className="chon-place-detail-panel absolute inset-0 overflow-y-auto bg-[#f3efe5] shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:w-[min(760px,82vw)]"
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="Đóng chi tiết địa điểm"
          className="fixed top-4 right-4 z-20 grid size-11 place-items-center rounded-full bg-white text-xl font-bold text-[#173f33] shadow-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
          onClick={() => router.back()}
          ref={closeButtonRef}
          type="button"
        >
          ×
        </button>
        {children}
      </section>
    </div>
  );
}
