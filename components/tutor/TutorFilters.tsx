"use client";

import type { Course, TutorLocationFilter } from "@/lib/contracts";
import { formatCourseOptionLabel, formatTopicLabel } from "@/lib/tutorDisplay";

export type TutorFilterValues = {
  query: string;
  courseId: string;
  topic: string;
  maxBudgetRaw: string;
  scheduleQuery: string;
  location: TutorLocationFilter | "";
};

type TutorFiltersProps = {
  values: TutorFilterValues;
  courses: Course[];
  topics: string[];
  hasActiveFilters: boolean;
  onChange: (next: TutorFilterValues) => void;
  onReset: () => void;
  className?: string;
};

const DAYS = [
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
  { value: "Sunday", label: "Sunday" },
] as const;

const LOCATIONS: ReadonlyArray<{
  value: TutorLocationFilter | "";
  label: string;
}> = [
  { value: "", label: "All Location" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline (ITS Sukolilo)" },
];

const BUDGET_PRESETS = [
  { amount: 40000, label: "\u2264 40k" },
  { amount: 45000, label: "\u2264 45k" },
  { amount: 50000, label: "\u2264 50k" },
  { amount: 60000, label: "\u2264 60k" },
] as const;

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[13.5px] font-medium text-[#6C777C]"
      >
        {label}
      </label>
      <div className="relative mt-2">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-full cursor-pointer appearance-none rounded-[11px] border border-[#AEB7BB] bg-white py-2.5 pr-9 pl-3.5 text-[13.5px] font-medium text-[#263238] transition-colors hover:border-[#3979A5] focus:border-[#3979A5] focus:outline-none"
        >
          {children}
        </select>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#263238"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

export function TutorFilters({
  values,
  courses,
  topics,
  hasActiveFilters,
  onChange,
  onReset,
  className = "",
}: TutorFiltersProps) {
  return (
    <aside
      aria-label="Tutor filters"
      className={`rounded-[26px] border border-[#BFC7CB] bg-[#F5F5F5] p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#CBD2D6] pb-4">
        <h2 className="text-[20px] font-semibold text-[#263238]">Filter</h2>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-[13px] font-medium text-[#3979A5] transition-colors hover:text-[#285B7B]"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-4.5">
        <FilterSelect
          id="filter-course"
          label="Course"
          value={values.courseId}
          onChange={(courseId) =>
            onChange({
              ...values,
              courseId,
              topic: "",
            })
          }
        >
          <option value="">All Course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {formatCourseOptionLabel(course)}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filter-topic"
          label="Topics"
          value={values.topic}
          onChange={(topic) => onChange({ ...values, topic })}
        >
          <option value="">All Topics</option>
          {topics.map((topic) => (
            <option key={topic} value={topic}>
              {formatTopicLabel(topic)}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filter-day"
          label="Available Day"
          value={values.scheduleQuery}
          onChange={(scheduleQuery) => onChange({ ...values, scheduleQuery })}
        >
          <option value="">All Days</option>
          {DAYS.map((day) => (
            <option key={day.value} value={day.value}>
              {day.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filter-location"
          label="Location"
          value={values.location}
          onChange={(loc) =>
            onChange({
              ...values,
              location: (loc as TutorLocationFilter | "") ?? "",
            })
          }
        >
          {LOCATIONS.map((loc) => (
            <option key={loc.label} value={loc.value}>
              {loc.label}
            </option>
          ))}
        </FilterSelect>

        <div className="sm:col-span-2 lg:col-span-1">
          <span className="block text-[13.5px] font-medium text-[#6C777C]">
            Budget
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
            {BUDGET_PRESETS.map(({ amount, label }) => {
              const active = values.maxBudgetRaw === String(amount);
              return (
                <button
                  key={amount}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...values,
                      maxBudgetRaw: active ? "" : String(amount),
                    })
                  }
                  className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[11px] border px-3 py-2 text-[13.5px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px ${
                    active
                      ? "border-[#3979A5] bg-[#3979A5] text-white"
                      : "border-[#AEB7BB] bg-white text-[#263238] hover:border-[#3979A5] hover:text-[#3979A5]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
