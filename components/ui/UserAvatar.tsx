type UserAvatarProps = {
  tone?: "blue" | "rose" | "neutral";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  sm: "h-10 w-10 border-2",
  md: "h-[68px] w-[68px] border-[3px]",
  lg: "h-28 w-28 border-4",
  xl: "h-32 w-32 sm:h-[152px] sm:w-[152px] border-[4px]",
};

const TONE_STYLES: Record<
  NonNullable<UserAvatarProps["tone"]>,
  { bg: string; fg: string }
> = {
  blue: {
    bg: "bg-[#EDF3F7]",
    fg: "text-[#8EB2CA]",
  },
  rose: {
    bg: "bg-[#F6EDED]",
    fg: "text-[#CE9E9E]",
  },
  neutral: {
    bg: "bg-[#F0F2F4]",
    fg: "text-[#9AA5AC]",
  },
};

export function UserAvatar({
  tone = "neutral",
  size = "md",
  className = "",
}: UserAvatarProps) {
  const palette = TONE_STYLES[tone];

  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full border-white shadow-[0_4px_14px_rgba(38,50,56,0.08)] ${SIZE_CLASSES[size]} ${palette.bg} ${palette.fg} ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="currentColor"
        className="h-[88%] w-[88%] translate-y-[4%]"
      >
        <circle cx="32" cy="23" r="11.5" />
        <path d="M12 58c0-10.5 8.95-18.5 20-18.5S52 47.5 52 58H12Z" />
      </svg>
    </div>
  );
}
