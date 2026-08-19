import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "chip";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Readonly<{
    variant?: ButtonVariant;
  }>;

const variantClasses: Record<ButtonVariant, string> = {
  chip: "border-[#ddd2c3] bg-[#fffdf9] text-[#28231f] hover:border-[#c96040] hover:bg-[#f5ddd3] hover:text-[#963f2a]",
  ghost: "border-transparent bg-transparent text-[#426b57] hover:bg-[#eee6da]",
  primary: "border-[#c96040] bg-[#c96040] text-white hover:bg-[#963f2a]",
  secondary:
    "border-[#ddd2c3] bg-[#fffdf9] text-[#28231f] hover:border-[#c96040]",
};

export function Button({
  className,
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
