"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import { useTutorApplications } from "@/features/tutors/useTutors";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";
import { validateTutorApplicationInput } from "@/lib/validators";

const PRESET_SLOTS = [
  "Senin 18:30 WIB",
  "Selasa 19:00 WIB",
  "Rabu 19:00 WIB",
  "Kamis 18:30 WIB",
  "Jumat 19:00 WIB",
  "Sabtu 10:00 WIB",
  "Minggu 14:00 WIB",
];

export function JadiTutorForm() {
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const { courses, applications, submitApplication } = useTutorApplications(
    user?.id ?? null
  );

  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([
    "course-kalkulus-1",
  ]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRateRaw, setHourlyRateRaw] = useState("45000");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([
    "Senin 18:30 WIB",
  ]);
  const [customSlot, setCustomSlot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const hadUserRef = useRef(false);

  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
      return;
    }
    if (hydrated && !hadUserRef.current) {
      router.replace("/login?next=%2Fjadi-tutor");
    }
  }, [hydrated, user, router]);

  const availableTopics = useMemo(() => {
    const result: string[] = [];
    for (const course of courses) {
      if (selectedCourseIds.includes(course.id)) {
        for (const topic of course.topics) {
          if (!result.includes(topic)) {
            result.push(topic);
          }
        }
      }
    }
    return result;
  }, [courses, selectedCourseIds]);

  const effectiveName = nameOverride ?? user?.name ?? "";

  if (!hydrated) {
    return (
      <Card>
        <p className="text-sm text-neutral-600">Memuat formulir Jadi Tutor...</p>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="mx-auto max-w-lg space-y-3">
        <h1 className="text-lg font-semibold text-neutral-900">
          Login Demo Diperlukan
        </h1>
        <p className="text-sm text-neutral-600">
          Silakan masuk dengan akun ITS demo terlebih dahulu untuk mengajukan
          pendaftaran sebagai tutor sebaya.
        </p>
        <div>
          <Link href="/login?next=%2Fjadi-tutor" className={buttonClasses()}>
            Ke Halaman Login
          </Link>
        </div>
      </Card>
    );
  }

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  };

  const toggleSlot = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const extraTopics = customTopics
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const mergedTopics = Array.from(
      new Set([
        ...selectedTopics.filter((t) => availableTopics.includes(t)),
        ...extraTopics,
      ])
    );

    const extraSlots = customSlot
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const mergedSlots = Array.from(new Set([...selectedSlots, ...extraSlots]));

    const validation = validateTutorApplicationInput({
      name: effectiveName,
      courseIds: selectedCourseIds,
      topics: mergedTopics,
      bio,
      hourlyRateRaw,
      slots: mergedSlots,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    const result = submitApplication({
      userId: user.id,
      name: effectiveName,
      courseIds: selectedCourseIds,
      topics: mergedTopics,
      bio,
      hourlyRateRaw,
      slots: mergedSlots,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    setSubmittedId(result.data.id);
    setBio("");
    setCustomTopics("");
    setCustomSlot("");
  };

  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Badge variant="outline">Pendaftaran Tutor — Mode Demo</Badge>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Daftar Jadi Tutor KOLEARA
        </h1>
        <p className="text-sm text-neutral-600">
          Isi data singkat di bawah ini untuk mengajukan profil tutor. Pengajuan
          tersimpan secara lokal dengan status <strong>pending</strong> dan
          tidak langsung tampil di pencarian sebelum verifikasi admin.
        </p>
      </div>

      {submittedId ? (
        <Notice
          title="Pengajuan Tutor Demo Tersimpan (Menunggu Verifikasi)"
          tone="emphasis"
          role="status"
        >
          <p>
            Terima kasih! Pengajuan dengan ID{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-xs">
              {submittedId}
            </code>{" "}
            berstatus <strong>Menunggu Verifikasi (pending)</strong>. Pada
            prototipe ini, pendaftar tidak dapat memverifikasi diri sendiri —
            daftar tutor di halaman Cari Tutor tetap menampilkan tutor demo
            terverifikasi.
          </p>
          <div className="mt-3">
            <Link
              href="/cari"
              className="text-sm font-semibold underline underline-offset-4"
            >
              Lihat Daftar Tutor Terverifikasi
            </Link>
          </div>
        </Notice>
      ) : null}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            id="tutor-app-name"
            label="Nama Lengkap"
            value={effectiveName}
            onChange={(e) => setNameOverride(e.target.value)}
            error={errors.name}
            required
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-neutral-900">
              Mata Kuliah yang Diajarkan
            </legend>
            <div className="flex flex-wrap gap-3">
              {courses.map((course) => {
                const checked = selectedCourseIds.includes(course.id);
                return (
                  <label
                    key={course.id}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                      checked
                        ? "border-neutral-900 bg-neutral-100 font-medium"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCourse(course.id)}
                    />
                    {course.name}
                  </label>
                );
              })}
            </div>
            {errors.courseIds ? (
              <p role="alert" className="text-xs font-medium text-neutral-900">
                {errors.courseIds}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-neutral-900">
              Topik yang Dikuasai
            </legend>
            {availableTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((topic) => {
                  const checked = selectedTopics.includes(topic);
                  return (
                    <label
                      key={topic}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer ${
                        checked
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 bg-white text-neutral-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleTopic(topic)}
                      />
                      {topic}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                Pilih minimal satu mata kuliah untuk menampilkan daftar topik.
              </p>
            )}
            <Input
              id="tutor-app-custom-topics"
              label="Topik Tambahan (opsional, pisahkan dengan koma)"
              placeholder="Contoh: Persiapan ETS, Soal Cerita Newton"
              value={customTopics}
              onChange={(e) => setCustomTopics(e.target.value)}
              error={errors.topics}
            />
          </fieldset>

          <Textarea
            id="tutor-app-bio"
            label="Bio &amp; Pengalaman Mengajar Singkat"
            rows={3}
            placeholder="Jelaskan latar belakang nilai/asdos dan gaya mengajar Anda (minimal 15 karakter)..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            error={errors.bio}
            required
          />

          <Input
            id="tutor-app-rate"
            label="Tarif per Sesi 60 Menit (IDR)"
            type="text"
            inputMode="numeric"
            placeholder="45000"
            value={hourlyRateRaw}
            onChange={(e) => setHourlyRateRaw(e.target.value)}
            helperText="Masukkan bilangan bulat positif tanpa titik/koma (contoh: 45000)."
            error={errors.hourlyRate}
            required
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-neutral-900">
              Jadwal Tersedia (WIB)
            </legend>
            <div className="flex flex-wrap gap-2">
              {PRESET_SLOTS.map((slot) => {
                const checked = selectedSlots.includes(slot);
                return (
                  <label
                    key={slot}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer ${
                      checked
                        ? "border-neutral-900 bg-neutral-100 font-medium text-neutral-900"
                        : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSlot(slot)}
                    />
                    {slot}
                  </label>
                );
              })}
            </div>
            <Input
              id="tutor-app-custom-slot"
              label="Jadwal Lainnya (opsional, pisahkan dengan koma)"
              placeholder="Contoh: Rabu 15:00 WIB, Sabtu 19:00 WIB"
              value={customSlot}
              onChange={(e) => setCustomSlot(e.target.value)}
              error={errors.slots}
            />
          </fieldset>

          {submitError ? (
            <Notice tone="emphasis" role="alert">
              {submitError}
            </Notice>
          ) : null}

          <Button type="submit">Kirim Pengajuan Tutor (Demo)</Button>
        </form>
      </Card>

      {applications.length > 0 ? (
        <section className="space-y-3" aria-labelledby="riwayat-pengajuan-heading">
          <h2
            id="riwayat-pengajuan-heading"
            className="text-base font-semibold text-neutral-900"
          >
            Riwayat Pengajuan Tutor Anda ({applications.length})
          </h2>
          <div className="space-y-3">
            {applications.map((app) => (
              <Card key={app.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">
                      {app.name}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Diajukan {formatWibDateTime(app.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline">Menunggu Verifikasi (Pending)</Badge>
                </div>
                <p className="text-sm text-neutral-700">{app.bio}</p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {app.courseIds.map((cid) => (
                    <Badge key={cid} variant="solid">
                      {courseNameById.get(cid) ?? cid}
                    </Badge>
                  ))}
                  {app.topics.map((topic) => (
                    <Badge key={topic}>{topic}</Badge>
                  ))}
                </div>
                <p className="text-xs text-neutral-600">
                  Tarif diajukan: <strong>{formatIdr(app.hourlyRate)}</strong> /
                  60 menit • Jadwal: {app.slots.join(", ")}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
