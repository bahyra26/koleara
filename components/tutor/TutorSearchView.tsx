"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TutorCard } from "@/components/tutor/TutorCard";
import {
  TutorFilters,
  type TutorFilterValues,
} from "@/components/tutor/TutorFilters";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Notice";
import { useTutorSearch } from "@/features/tutors/useTutors";

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
  });

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
  });

  const hasActiveFilters = Boolean(
    filters.query.trim() ||
      filters.courseId ||
      filters.topic ||
      filters.maxBudgetRaw.trim() ||
      filters.scheduleQuery
  );

  const handleReset = () => {
    setFilters({
      query: "",
      courseId: "",
      topic: "",
      maxBudgetRaw: "",
      scheduleQuery: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Cari Tutor Sebaya ITS
        </h1>
        <p className="text-sm text-neutral-600">
          Menampilkan tutor demo terverifikasi untuk Kalkulus 1 dan Fisika Dasar
          1. Semua data profil, badge, dan rating bersifat contoh untuk
          prototipe.
        </p>
      </div>

      <TutorFilters
        values={filters}
        courses={courses}
        topics={topics}
        hasActiveFilters={hasActiveFilters}
        onChange={setFilters}
        onReset={handleReset}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
        <p>
          Menampilkan <strong>{results.length}</strong> tutor terverifikasi
          (data demo).
        </p>
        {hasActiveFilters ? (
          <p className="text-xs text-neutral-500">
            Diurutkan berdasarkan skor kecocokan demo (heuristik lokal
            deterministik, bukan AI).
          </p>
        ) : null}
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="Tidak ada tutor yang sesuai filter"
          description="Coba longgarkan batas anggaran, ubah kata kunci pencarian, atau reset semua filter untuk melihat seluruh tutor demo."
          action={
            <Button variant="primary" onClick={handleReset}>
              Reset Filter
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((item) => (
            <TutorCard key={item.tutor.id} result={item} />
          ))}
        </div>
      )}
    </div>
  );
}
