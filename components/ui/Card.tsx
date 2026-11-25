import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({
  padded = true,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white ${padded ? "p-4 sm:p-5" : ""} ${className}`}
      {...props}
    />
  );
}
