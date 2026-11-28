"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TutorCard } from "@/components/tutor/TutorCard";
import {
  TutorFilters,
  type TutorFilterValues,
} from "@/components/tutor/TutorFilters";
import { useTutorSearch } from "@/features/tutors/useTutors";
import { formatCourseTabLabel } from "@/lib/tutorDisplay";

export function TutorSearchView() {
  const searchParams = useSearchParams();
  return (
    <TutorSearchContent
      key={searchParams.toString()}
      initialCourse={searchParams.get("course") ?? ""}
      initialQuery={searchParams.get("q") ?? ""}
    />
  );
}

function TutorSearchContent({
  initialCourse,
  initialQuery,
}: {
  initialCourse: string;
  initialQuery: string;
}) {
  const [filters, setFilters] = useState<TutorFilterValues>({
    query: initialQuery,
    courseId: initialCourse,
    topic: "",
    maxBudgetRaw: "",
    scheduleQuery: "",
    location: "",
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const parsedBudget =
    filters.maxBudgetRaw.trim() !== "" &&
    /^\d+$/.test(filters.maxBudgetRaw.trim())
      ? Number.parseInt(filters.maxBudgetRaw.trim(), 10)
      : null;

  const { courses, topics, results } = useTutorSearch({
    query: filters.query,
    courseId: filters.courseId,
    topic: filters.topic,
    maxBudget: parsedBudget,
    scheduleQuery: filters.scheduleQuery,
    location: filters.location,
  });

  const activeFilterCount = [
    filters.query.trim(),
    filters.courseId,
    filters.topic,
    filters.maxBudgetRaw.trim(),
    filters.scheduleQuery,
    filters.location,
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const handleReset = () => {
    setFilters({
      query: "",
      courseId: "",
      topic: "",
      maxBudgetRaw: "",
      scheduleQuery: "",
      location: "",
    });
  };

  const handleCoursePill = (courseId: string) => {
    setFilters((prev) => ({
      ...prev,
      courseId,
      topic: prev.courseId === courseId ? prev.topic : "",
    }));
  };

  return (
    <section className="koleara-enter pb-10 pt-2 sm:pt-4">
      {/* Page Title & Subtitle */}
      <header>
        <h1 className="text-[clamp(2rem,5.5vw,3.375rem)] font-semibold leading-[1.18] tracking-tight text-[#263238]">
          Find Your <span className="font-bold text-[#3979A5]">Tutor</span>
        </h1>
        <p className="mt-2.5 max-w-5xl text-[clamp(0.95rem,1.65vw,1.35rem)] font-medium leading-relaxed text-[#A3ADB1]">
          Verified senior students from ITS. Pick a course, then chat or book a
          session.
        </p>
      </header>

      {/* Main Layout: Sidebar Filter + Course Tabs & Tutor Grid */}
      <div className="mt-7 flex flex-col gap-6 lg:mt-9 lg:flex-row lg:items-start lg:gap-7">
        {/* Desktop Sidebar */}
        <div className="hidden w-[264px] shrink-0 lg:block xl:w-[276px]">
          <TutorFilters
            values={filters}
            courses={courses}
            topics={topics}
            hasActiveFilters={hasActiveFilters}
            onChange={setFilters}
            onReset={handleReset}
          />
        </div>

        {/* Right Content Column */}
        <div className="min-w-0 flex-1">
          {/* Quick Course Pills + Mobile/Tablet Filter Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Course quick filter"
              className="flex flex-wrap items-center gap-2 sm:gap-3"
            >
              <button
                type="button"
                aria-pressed={filters.courseId === ""}
                onClick={() => handleCoursePill("")}
                className={`inline-flex min-h-11 min-w-[68px] cursor-pointer items-center justify-center rounded-[13px] px-4 py-2 text-[14px] font-medium transition-[background-color,color,transform] duration-150 active:translate-y-px sm:min-w-[96px] sm:px-5 sm:text-[16px] ${
                  filters.courseId === ""
                    ? "bg-[#3979A5] font-semibold text-white"
                    : "bg-[#F2F3F5] text-[#9AA4A9] hover:bg-[#E7ECEF] hover:text-[#263238]"
                }`}
              >
                All
              </button>

              {courses.map((course) => {
                const active = filters.courseId === course.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleCoursePill(course.id)}
                    className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[13px] px-4 py-2 text-[14px] font-medium transition-[background-color,color,transform] duration-150 active:translate-y-px sm:px-6 sm:text-[16px] ${
                      active
                        ? "bg-[#3979A5] font-semibold text-white"
                        : "bg-[#F2F3F5] text-[#9AA4A9] hover:bg-[#E7ECEF] hover:text-[#263238]"
                    }`}
                  >
                    {formatCourseTabLabel(course)}
                  </button>
                );
              })}
            </div>

            {/* Mobile & Tablet Filter Drawer Toggle */}
            <button
              type="button"
              aria-expanded={mobileFiltersOpen}
              aria-controls="mobile-tutor-filters"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[13px] border px-4 py-2 text-[14px] font-medium transition-colors lg:hidden ${
                mobileFiltersOpen || hasActiveFilters
                  ? "border-[#3979A5] bg-[#EAF2F7] text-[#285B7B]"
                  : "border-[#CBD2D6] bg-[#F5F5F5] text-[#263238] hover:border-[#3979A5]"
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="7" x2="17" y1="12" y2="12" />
                <line x1="10" x2="14" y1="18" y2="18" />
              </svg>
              <span>
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </span>
            </button>
          </div>

          {/* Collapsible Filter Panel on Mobile & Tablet */}
          {mobileFiltersOpen ? (
            <div id="mobile-tutor-filters" className="mt-4 lg:hidden">
              <TutorFilters
                values={filters}
                courses={courses}
                topics={topics}
                hasActiveFilters={hasActiveFilters}
                onChange={setFilters}
                onReset={handleReset}
              />
            </div>
          ) : null}

          {/* Tutor Cards Grid */}
          {results.length === 0 ? (
            <div className="mt-6 rounded-[26px] border border-[#CBD2D6] bg-[#F8FAFB] px-6 py-12 text-center">
              <h2 className="text-[18px] font-semibold text-[#263238]">
                No tutors match these filters
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[#7D898F]">
                Try broadening your budget, choosing another day or location, or
                resetting all filters.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] bg-[#3979A5] px-6 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#2E668D]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((item) => (
                <TutorCard
                  key={item.tutor.id}
                  result={item}
                  activeCourseId={filters.courseId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
