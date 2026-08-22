import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#ddd2c3] bg-[#fffdf9] shadow-[0_5px_18px_rgba(69,50,37,0.08)]",
        className,
      )}
      {...props}
    />
  );
}
