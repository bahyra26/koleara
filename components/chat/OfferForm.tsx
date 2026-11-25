"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { Course, MeetingMode, Tutor } from "@/lib/contracts";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import {
  parseWibDateTimeLocal,
  toWibDateTimeLocalValue,
} from "@/lib/formatters";
import { validateOfferInput } from "@/lib/validators";

type OfferFormProps = {
  tutor: Tutor;
  courses: Course[];
  onSubmitOffer: (input: {
    courseId: string;
    topic: string;
    startAt: number;
    priceRaw: string;
    meetingMode: MeetingMode;
    brief?: string;
  }) => { ok: boolean; error?: string };
  onCancel: () => void;
};

function getFutureWibPreset(daysAhead: number, hourWib: number): string {
  const now = new Date();
  const targetMs = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;
  const baseDate = toWibDateTimeLocalValue(targetMs).slice(0, 10);
  const hh = String(hourWib).padStart(2, "0");
  return `${baseDate}T${hh}:00`;
}

export function OfferForm({
  tutor,
  courses,
  onSubmitOffer,
  onCancel,
}: OfferFormProps) {
  const tutorCourses = useMemo(
    () => courses.filter((c) => tutor.courseIds.includes(c.id)),
    [courses, tutor.courseIds]
  );

  const initialCourseId = tutorCourses[0]?.id ?? courses[0]?.id ?? "";
  const initialTopic =
    tutorCourses[0]?.topics.find((t) => tutor.topics.includes(t)) ??
    tutorCourses[0]?.topics[0] ??
    "";

  const [courseId, setCourseId] = useState(initialCourseId);
  const [topic, setTopic] = useState(initialTopic);
  const [scheduleLocal, setScheduleLocal] = useState(() =>
    getFutureWibPreset(1, 19)
  );
  const [priceRaw, setPriceRaw] = useState(String(tutor.hourlyRate));
  const [meetingMode, setMeetingMode] = useState<MeetingMode>("online");
  const [brief, setBrief] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? null,
    [courses, courseId]
  );

  const handleCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    const nextCourse = courses.find((c) => c.id === nextCourseId);
    if (nextCourse && nextCourse.topics.length > 0) {
      const preferred =
        nextCourse.topics.find((t) => tutor.topics.includes(t)) ??
        nextCourse.topics[0];
      setTopic(preferred);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const parsedStartAt = parseWibDateTimeLocal(scheduleLocal);
    const validation = validateOfferInput({
      courseId,
      topic,
      startAt: parsedStartAt,
      priceRaw,
      meetingMode,
      brief,
    });

    if (!validation.valid || !parsedStartAt) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    const result = onSubmitOffer({
      courseId,
      topic,
      startAt: parsedStartAt,
      priceRaw,
      meetingMode,
      brief,
    });

    if (!result.ok) {
      setSubmitError(result.error ?? "Gagal membuat tawaran sesi.");
      return;
    }

    onCancel();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 border-t border-neutral-200 bg-neutral-50 p-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">
          Buat Tawaran Sesi 60 Menit (Peran Tutor)
        </h3>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Tutup
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          id="offer-course"
          label="Mata Kuliah"
          value={courseId}
          onChange={(e) => handleCourseChange(e.target.value)}
          error={errors.courseId}
        >
          {(tutorCourses.length > 0 ? tutorCourses : courses).map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Select>

        <Select
          id="offer-topic"
          label="Topik Bahasan"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          error={errors.topic}
        >
          {(selectedCourse?.topics ?? []).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>

        <div className="space-y-1.5">
          <Input
            id="offer-schedule"
            label="Tanggal &amp; Jam Mulai (WIB)"
            type="datetime-local"
            value={scheduleLocal}
            onChange={(e) => setScheduleLocal(e.target.value)}
            error={errors.startAt}
            required
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setScheduleLocal(getFutureWibPreset(1, 19))}
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            >
              Besok 19:00 WIB
            </button>
            <button
              type="button"
              onClick={() => setScheduleLocal(getFutureWibPreset(2, 18))}
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            >
              +2 Hari 18:00 WIB
            </button>
          </div>
        </div>

        <Input
          id="offer-price"
          label="Tarif Sesi 60 Menit (IDR)"
          type="text"
          inputMode="numeric"
          value={priceRaw}
          onChange={(e) => setPriceRaw(e.target.value)}
          helperText="Durasi tetap 60 menit. Masukkan angka bulat IDR."
          error={errors.price}
          required
        />

        <Select
          id="offer-mode"
          label="Mode Pertemuan (Opsional)"
          value={meetingMode}
          onChange={(e) => setMeetingMode(e.target.value as MeetingMode)}
        >
          <option value="online">Online (Meet/Zoom)</option>
          <option value="offline_its">Tatap Muka (Kampus ITS)</option>
        </Select>

        <div className="flex flex-col justify-center rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
          <span className="font-medium text-neutral-900">Durasi Sesi</span>
          <span>60 menit (standar MVP)</span>
        </div>
      </div>

      <Textarea
        id="offer-brief"
        label="Catatan Singkat (Opsional)"
        rows={2}
        placeholder="Misal: Fokus bahas soal latihan Integral Tentu & substitusi."
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
      />

      {submitError ? (
        <Notice tone="emphasis" role="alert">
          {submitError}
        </Notice>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button size="sm" type="submit">
          Kirim Tawaran ke Chat
        </Button>
      </div>
    </form>
  );
}
