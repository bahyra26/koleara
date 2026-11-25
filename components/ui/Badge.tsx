import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "solid" | "outline" | "muted";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-800 border border-neutral-200",
  solid: "bg-neutral-900 text-white border border-neutral-900",
  outline: "bg-white text-neutral-800 border border-neutral-400",
  muted: "bg-neutral-100 text-neutral-600 border border-neutral-200",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
