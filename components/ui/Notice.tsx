import type { ReactNode } from "react";

type NoticeProps = {
  title?: string;
  children: ReactNode;
  tone?: "neutral" | "emphasis";
  role?: "status" | "alert";
  className?: string;
};

export function Notice({
  title,
  children,
  tone = "neutral",
  role,
  className = "",
}: NoticeProps) {
  const toneClass =
    tone === "emphasis"
      ? "border-neutral-900 bg-neutral-100 text-neutral-900"
      : "border-neutral-300 bg-neutral-50 text-neutral-800";

  return (
    <div
      role={role}
      className={`rounded-md border px-3.5 py-3 text-sm ${toneClass} ${className}`}
    >
      {title ? <p className="mb-1 font-semibold text-neutral-900">{title}</p> : null}
      <div className="text-neutral-700">{children}</div>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-neutral-600">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
