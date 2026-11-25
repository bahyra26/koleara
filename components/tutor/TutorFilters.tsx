"use client";

import type { Course } from "@/lib/contracts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";

export type TutorFilterValues = {
  query: string;
  courseId: string;
  topic: string;
  maxBudgetRaw: string;
  scheduleQuery: string;
};

type TutorFiltersProps = {
  values: TutorFilterValues;
  courses: Course[];
  topics: string[];
  hasActiveFilters: boolean;
  onChange: (next: TutorFilterValues) => void;
  onReset: () => void;
};

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const BUDGET_PRESETS = [40000, 45000, 50000, 60000];

export function TutorFilters({
  values,
  courses,
  topics,
  hasActiveFilters,
  onChange,
  onReset,
}: TutorFiltersProps) {
  return (
    <Card className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-2">
          <Input
            id="cari-query"
            label="Cari Nama, Mata Kuliah, atau Topik"
            type="search"
            placeholder="Contoh: Integral, Newton, Nadia..."
            value={values.query}
            onChange={(e) => onChange({ ...values, query: e.target.value })}
          />
        </div>

        <Select
          id="cari-course"
          label="Mata Kuliah"
          value={values.courseId}
          onChange={(e) =>
            onChange({
              ...values,
              courseId: e.target.value,
              topic: "",
            })
          }
        >
          <option value="">Semua Mata Kuliah</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Select>

        <Select
          id="cari-topic"
          label="Topik"
          value={values.topic}
          onChange={(e) => onChange({ ...values, topic: e.target.value })}
        >
          <option value="">Semua Topik</option>
          {topics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </Select>

        <Select
          id="cari-schedule"
          label="Hari Jadwal (WIB)"
          value={values.scheduleQuery}
          onChange={(e) =>
            onChange({ ...values, scheduleQuery: e.target.value })
          }
        >
          <option value="">Semua Hari</option>
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-neutral-200 pt-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Input
              id="cari-budget"
              label="Anggaran Maksimal / 60 Menit (IDR)"
              type="number"
              min={0}
              step={5000}
              inputMode="numeric"
              placeholder="Contoh: 50000"
              value={values.maxBudgetRaw}
              onChange={(e) =>
                onChange({ ...values, maxBudgetRaw: e.target.value })
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {BUDGET_PRESETS.map((amount) => {
              const active = values.maxBudgetRaw === String(amount);
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...values,
                      maxBudgetRaw: active ? "" : String(amount),
                    })
                  }
                  className={`rounded border px-2 py-1 text-xs cursor-pointer ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  &le; Rp{(amount / 1000).toFixed(0)}rb
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={!hasActiveFilters}
        >
          Reset Filter
        </Button>
      </div>
    </Card>
  );
}
