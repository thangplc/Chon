import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "accent" | "success" | "warning";

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  Readonly<{
    tone?: BadgeTone;
  }>;

const toneClasses: Record<BadgeTone, string> = {
  accent: "bg-[#f5ddd3] text-[#963f2a]",
  neutral: "bg-[#eee6da] text-[#756c63]",
  success: "bg-[#deeadf] text-[#426b57]",
  warning: "bg-[#f5e8c8] text-[#8c5a18]",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-extrabold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
