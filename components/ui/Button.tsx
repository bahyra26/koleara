import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md";

type StyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleOptions;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-neutral-900 text-white border border-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:border-neutral-300 disabled:text-neutral-500",
  secondary:
    "bg-neutral-200 text-neutral-900 border border-neutral-300 hover:bg-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-400",
  outline:
    "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100 disabled:text-neutral-400 disabled:bg-neutral-50",
  ghost:
    "bg-transparent text-neutral-700 border border-transparent hover:bg-neutral-100 hover:text-neutral-900 disabled:text-neutral-400",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: StyleOptions = {}): string {
  return `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
