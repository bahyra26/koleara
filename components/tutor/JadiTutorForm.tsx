"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import { useTutorApplications } from "@/features/tutors/useTutors";
import type { LanguageCode, TutorLocation } from "@/lib/contracts";
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
  const { user, hydrated, uploadFile } = useAuth();
  const { courses, applications, submitApplication } = useTutorApplications();

  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [departmentOverride, setDepartment] = useState<string | null>(null);
  const [cohortOverride, setCohort] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([
    "course-kalkulus-1",
  ]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRateRaw, setHourlyRateRaw] = useState("35000");
  const [teachingMode, setTeachingMode] = useState<TutorLocation>("hybrid");
  const [languages, setLanguages] = useState<LanguageCode[]>(["id"]);
  const [campusSpots, setCampusSpots] = useState("Perpustakaan ITS");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([
    "Senin 18:30 WIB",
  ]);
  const [customSlot, setCustomSlot] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [payoutBank, setPayoutBank] = useState("");
  const [payoutName, setPayoutName] = useState("");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
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
  const department = departmentOverride ?? user?.department ?? "";
  const cohort =
    cohortOverride ?? (user?.cohortYear ? String(user.cohortYear) : "2023");

  if (!hydrated) {
    return (
      <Card>
        <p className="text-sm text-[#5B686D]">Memuat formulir Jadi Tutor...</p>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="mx-auto max-w-lg space-y-3">
        <h1 className="text-lg font-semibold text-[#263238]">
          Login ITS Diperlukan
        </h1>
        <p className="text-sm text-[#5B686D]">
          Masuk dengan akun mahasiswa ITS Anda untuk mendaftar sebagai tutor
          sebaya KOLEARA.
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

  const toggleLanguage = (lang: LanguageCode) => {
    setLanguages((prev) => {
      if (prev.includes(lang)) {
        return prev.length > 1 ? prev.filter((l) => l !== lang) : prev;
      }
      return [...prev, lang];
    });
  };

  const toggleSlot = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const handleProofChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProofFile(event.target.files?.[0] ?? null);
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
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

    if (!validation.valid || !validation.hourlyRate) {
      setErrors(validation.errors);
      return;
    }

    if (!proofFile) {
      setSubmitError(
        "Unggah bukti transkrip nilai (≥ AB) atau SK/bukti asisten dosen untuk verifikasi admin."
      );
      return;
    }

    setErrors({});
    setSubmitting(true);

    const uploaded = await uploadFile(proofFile);
    if (!uploaded.ok) {
      setSubmitting(false);
      setSubmitError(uploaded.error);
      return;
    }

    const parsedCohort = Number.parseInt(cohort.trim(), 10);
    const result = await submitApplication({
      name: effectiveName,
      department: department.trim() || undefined,
      cohort: Number.isInteger(parsedCohort) ? parsedCohort : undefined,
      courseIds: selectedCourseIds,
      topics: mergedTopics,
      bio,
      hourlyRate: validation.hourlyRate,
      teachingMode,
      campusSpots: campusSpots
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      languages,
      slots: mergedSlots,
      proofStorageId: uploaded.data.storageId,
      proofFileName: uploaded.data.fileName,
      payoutBankOrWallet: payoutBank.trim() || undefined,
      payoutAccountName: payoutName.trim() || undefined,
      payoutAccountNumber: payoutNumber.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    setSubmittedId(result.data.id);
    setBio("");
    setCustomTopics("");
    setCustomSlot("");
    setProofFile(null);
  };

  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div className="space-y-1">
        <Badge variant="outline">Verifikasi Kompetensi Tutor ITS</Badge>
        <h1 className="text-2xl font-bold tracking-tight text-[#263238]">
          Daftar Jadi Tutor KOLEARA
        </h1>
        <p className="text-sm text-[#5B686D]">
          Ajukan profil mengajar, unggah screenshot transkrip nilai (≥ AB) atau
          bukti asisten dosen, serta lengkapi data pencairan honor. Berkas bukti
          akan <strong>dihapus otomatis</strong> segera setelah diverifikasi
          admin.
        </p>
      </div>

      {submittedId ? (
        <Notice
          title="Pengajuan Tutor Terkirim (Menunggu Verifikasi Admin)"
          tone="emphasis"
          role="status"
        >
          <p>
            Terima kasih! Pengajuan Anda dengan ID{" "}
            <code className="rounded bg-[#E5EFF4] px-1.5 py-0.5 font-mono text-xs">
              {submittedId}
            </code>{" "}
            sedang ditinjau oleh admin KOLEARA. Anda akan menerima email
            notifikasi begitu profil Anda aktif.
          </p>
        </Notice>
      ) : null}

      <Card className="rounded-[24px] border-[#CBD6DE] p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                id="tutor-app-name"
                label="Nama Lengkap"
                value={effectiveName}
                onChange={(e) => setNameOverride(e.target.value)}
                error={errors.name}
                required
              />
            </div>
            <Input
              id="tutor-app-cohort"
              label="Angkatan"
              type="number"
              min={2018}
              max={2030}
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="tutor-app-dept"
              label="Departemen ITS"
              placeholder="Contoh: Matematika / Fisika / Informatika"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
            <div className="space-y-1.5">
              <label
                htmlFor="tutor-app-mode"
                className="block text-sm font-medium text-[#263238]"
              >
                Mode Mengajar
              </label>
              <select
                id="tutor-app-mode"
                value={teachingMode}
                onChange={(e) =>
                  setTeachingMode(e.target.value as TutorLocation)
                }
                className="min-h-11 w-full rounded-xl border border-[#CBD6DE] bg-white px-3.5 text-sm text-[#263238]"
              >
                <option value="hybrid">Hybrid (Online &amp; Kampus ITS)</option>
                <option value="online">Online (Zoom / Meet)</option>
                <option value="offline">Offline (Kampus ITS Sukolilo)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[#263238]">
                Bahasa Pengantar
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { code: "id", label: "Bahasa Indonesia" },
                    { code: "en", label: "English (IUP)" },
                  ] as const
                ).map((item) => {
                  const active = languages.includes(item.code);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => toggleLanguage(item.code)}
                      className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-medium ${
                        active
                          ? "border-[#3979A5] bg-[#3979A5] text-white"
                          : "border-[#CBD6DE] bg-white text-[#263238]"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Input
              id="tutor-app-spots"
              label="Lokasi Kampus Favorit (opsional, pisahkan koma)"
              placeholder="Perpustakaan ITS, Kantin Pusat"
              value={campusSpots}
              onChange={(e) => setCampusSpots(e.target.value)}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#263238]">
              Mata Kuliah yang Diajarkan
            </legend>
            <div className="flex flex-wrap gap-3">
              {courses.map((course) => {
                const checked = selectedCourseIds.includes(course.id);
                return (
                  <label
                    key={course.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm ${
                      checked
                        ? "border-[#3979A5] bg-[#EAF2F7] font-semibold text-[#285B7B]"
                        : "border-[#CBD6DE] bg-white text-[#263238]"
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
              <p role="alert" className="text-xs font-medium text-red-700">
                {errors.courseIds}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#263238]">
              Subtopik yang Dikuasai
            </legend>
            {availableTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((topic) => {
                  const checked = selectedTopics.includes(topic);
                  return (
                    <label
                      key={topic}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs ${
                        checked
                          ? "border-[#3979A5] bg-[#3979A5] text-white"
                          : "border-[#CBD6DE] bg-white text-[#263238]"
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
              <p className="text-xs text-[#5B686D]">
                Pilih minimal satu mata kuliah untuk menampilkan subtopik.
              </p>
            )}
            <Input
              id="tutor-app-custom-topics"
              label="Subtopik Tambahan (opsional, pisahkan dengan koma)"
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
            placeholder="Jelaskan nilai mata kuliah / pengalaman asdos dan gaya mengajar Anda (minimal 15 karakter)..."
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
            placeholder="35000"
            value={hourlyRateRaw}
            onChange={(e) => setHourlyRateRaw(e.target.value)}
            helperText="Rekomendasi daya beli maba ITS: Rp15.000 – Rp45.000."
            error={errors.hourlyRate}
            required
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#263238]">
              Jadwal Tersedia Mingguan (WIB)
            </legend>
            <div className="flex flex-wrap gap-2">
              {PRESET_SLOTS.map((slot) => {
                const checked = selectedSlots.includes(slot);
                return (
                  <label
                    key={slot}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs ${
                      checked
                        ? "border-[#3979A5] bg-[#EAF2F7] font-medium text-[#285B7B]"
                        : "border-[#CBD6DE] bg-white text-[#5B686D]"
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
              label="Jadwal Lainnya (opsional, pisahkan koma)"
              placeholder="Contoh: Rabu 15:00 WIB, Sabtu 19:00 WIB"
              value={customSlot}
              onChange={(e) => setCustomSlot(e.target.value)}
              error={errors.slots}
            />
          </fieldset>

          <div className="space-y-2 rounded-2xl border border-[#CBD6DE] bg-[#F5F9FC] p-4">
            <label
              htmlFor="tutor-proof-file"
              className="block text-sm font-semibold text-[#263238]"
            >
              Unggah Bukti Transkrip Nilai (≥ AB) atau SK Asdos (Wajib)
            </label>
            <p className="text-xs text-[#5B686D]">
              Pastikan NRP pada tangkapan layar sesuai dengan email ITS akun
              Anda. Berkas disimpan privat dan dihapus otomatis setelah
              diverifikasi.
            </p>
            <input
              id="tutor-proof-file"
              type="file"
              accept="image/*,.pdf"
              onChange={handleProofChange}
              required
              className="block w-full rounded-xl border border-[#CBD6DE] bg-white px-3 py-2 text-xs text-[#263238]"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-[#CBD6DE] bg-white p-4">
            <p className="text-sm font-semibold text-[#263238]">
              Data Rekening / E-Wallet Pencairan Honor
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                id="payout-bank"
                label="Bank / E-Wallet"
                placeholder="BCA / Mandiri / GoPay"
                value={payoutBank}
                onChange={(e) => setPayoutBank(e.target.value)}
              />
              <Input
                id="payout-name"
                label="Nama Pemilik"
                placeholder="Sesuai rekening"
                value={payoutName}
                onChange={(e) => setPayoutName(e.target.value)}
              />
              <Input
                id="payout-number"
                label="Nomor Rekening / HP"
                placeholder="0812xxxxxxxx"
                value={payoutNumber}
                onChange={(e) => setPayoutNumber(e.target.value)}
              />
            </div>
          </div>

          {submitError ? (
            <Notice tone="emphasis" role="alert">
              {submitError}
            </Notice>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Mengunggah & Mengirim Pengajuan..."
              : "Kirim Pengajuan Tutor"}
          </Button>
        </form>
      </Card>

      {applications.length > 0 ? (
        <section className="space-y-3" aria-labelledby="riwayat-pengajuan-heading">
          <h2
            id="riwayat-pengajuan-heading"
            className="text-base font-semibold text-[#263238]"
          >
            Riwayat Pengajuan Tutor Anda ({applications.length})
          </h2>
          <div className="space-y-3">
            {applications.map((app) => (
              <Card key={app.id} className="space-y-2 rounded-2xl border-[#CBD6DE]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#263238]">
                      {app.name}
                    </h3>
                    <p className="text-xs text-[#5B686D]">
                      Diajukan {formatWibDateTime(app.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      app.status === "approved"
                        ? "solid"
                        : app.status === "rejected"
                          ? "muted"
                          : "outline"
                    }
                  >
                    {app.status === "approved"
                      ? "Disetujui & Aktif"
                      : app.status === "rejected"
                        ? "Ditolak"
                        : "Menunggu Verifikasi"}
                  </Badge>
                </div>
                <p className="text-sm text-[#5B686D]">{app.bio}</p>
                {app.rejectionReason ? (
                  <Notice tone="emphasis">
                    Alasan penolakan: {app.rejectionReason}
                  </Notice>
                ) : null}
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
                <p className="text-xs text-[#5B686D]">
                  Tarif: <strong>{formatIdr(app.hourlyRate)}</strong> / 60 menit
                  • Jadwal: {app.slots.join(", ")}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
