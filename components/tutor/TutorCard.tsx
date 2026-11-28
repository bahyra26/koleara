import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { TutorSearchResult } from "@/lib/contracts";
import {
  formatCoursePillLabel,
  formatDepartmentLabel,
  formatIdrSpaced,
  isPhysicsCourse,
  resolvePrimaryCourse,
} from "@/lib/tutorDisplay";

type TutorCardProps = {
  result: TutorSearchResult;
  activeCourseId?: string;
};

export function TutorCard({ result, activeCourseId }: TutorCardProps) {
  const { tutor, courses } = result;
  const primaryCourse = resolvePrimaryCourse(tutor, courses, activeCourseId);
  const physicsTheme = isPhysicsCourse(primaryCourse?.id);

  return (
    <article className="group flex flex-col justify-between rounded-[26px] border border-[#8EB4CE] bg-white p-3.5 transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-[#3979A5] hover:shadow-[0_14px_32px_rgba(40,91,123,0.10)]">
      <div>
        {/* Top Pastel Banner */}
        <div
          aria-hidden="true"
          className={`h-[124px] w-full rounded-[19px] transition-colors ${
            physicsTheme ? "bg-[#E6D5D5]" : "bg-[#E5EEF3]"
          }`}
        />

        {/* Overlapping Silhouette Avatar + Course Pill */}
        <div className="px-2">
          <div className="-mt-11 inline-flex flex-col items-center">
            <UserAvatar
              tone={physicsTheme ? "rose" : "blue"}
              size="md"
              className="transition-transform duration-150 group-hover:scale-[1.03]"
            />
            <span
              className={`relative z-10 -mt-2.5 inline-flex items-center justify-center rounded-full px-3 py-0.5 text-[10.5px] font-medium tracking-tight shadow-2xs ${
                physicsTheme
                  ? "bg-[#E2CECE] text-[#2B2626]"
                  : "bg-[#8EB3CE] text-white"
              }`}
            >
              {formatCoursePillLabel(primaryCourse)}
            </span>
          </div>

          {/* Identity & Cohort */}
          <div className="mt-3">
            <h2 className="truncate text-[18px] font-semibold leading-snug text-[#263238]">
              {tutor.name}
            </h2>
            <p className="mt-1 truncate text-[12.5px] font-normal text-[#9AA4A9]">
              {formatDepartmentLabel(tutor.department)}
            </p>
            <p className="mt-0.5 text-[12.5px] font-normal text-[#9AA4A9]">
              Class of {tutor.cohort}
            </p>
          </div>
        </div>
      </div>

      {/* Price + Rating + CTA */}
      <div className="mt-5 px-2 pb-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[18px] font-bold tracking-tight text-[#1E272C]">
            {formatIdrSpaced(tutor.hourlyRate)}{" "}
            <span className="text-[12px] font-normal text-[#9AA4A9]">
              / hour
            </span>
          </p>

          <div className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#9AA4A9]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="#F3CE6B"
              aria-hidden="true"
              className="-translate-y-px"
            >
              <path d="M12 2.5c.42 0 .8.25.97.64l2.24 5.1 5.54.54c.42.04.78.33.91.74.13.4 0 .84-.32 1.12l-4.17 3.68 1.2 5.43c.09.41-.07.84-.41 1.09-.35.25-.81.28-1.18.06L12 18.08l-4.78 2.82c-.37.22-.83.19-1.18-.06a1.07 1.07 0 0 1-.41-1.09l1.2-5.43-4.17-3.68a1.07 1.07 0 0 1-.32-1.12c.13-.41.49-.7.91-.74l5.54-.54 2.24-5.1c.17-.39.55-.64.97-.64Z" />
            </svg>
            <span>
              {typeof tutor.rating === "number"
                ? tutor.rating.toFixed(1)
                : "New"}
            </span>
          </div>
        </div>

        <Link
          href={`/tutor/${tutor.id}`}
          className="mt-3.5 inline-flex min-h-11 w-full items-center justify-center rounded-[11px] bg-[#3979A5] px-4 py-2.5 text-[13.5px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-[#2E668D] active:translate-y-px"
        >
          View Profile
        </Link>
      </div>
    </article>
  );
}
