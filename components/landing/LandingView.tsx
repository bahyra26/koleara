"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import { useCourses } from "@/features/tutors/useTutors";

export function LandingView() {
  const { user } = useAuth();
  const courses = useCourses();
  const jadiTutorHref = user ? "/jadi-tutor" : "/login?next=%2Fjadi-tutor";

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-neutral-200 bg-white p-6 sm:p-10">
        <div className="max-w-2xl space-y-4">
          <Badge variant="outline">Peer Tutoring Mahasiswa ITS — Prototipe</Badge>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Belajar Kalkulus 1 dan Fisika Dasar 1 bersama Tutor Sebaya ITS
          </h1>
          <p className="text-sm leading-relaxed text-neutral-600 sm:text-base">
            Temukan mahasiswa ITS terverifikasi (data demo), diskusikan topik
            yang sulit lewat chat, sepakati jadwal sesi 60 menit, dan selesaikan
            simulasi pembayaran QRIS dalam satu alur sederhana.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/cari"
              className={buttonClasses({ className: "px-5 py-2.5" })}
            >
              Cari Tutor
            </Link>
            <Link
              href={jadiTutorHref}
              className={buttonClasses({
                variant: "outline",
                className: "px-5 py-2.5",
              })}
            >
              Jadi Tutor
            </Link>
          </div>
          <p className="text-xs text-neutral-500">
            Catatan: Tampilan grayscale sementara sebelum desain Figma final
            tersedia. Seluruh proses login, chat, dan pembayaran berjalan secara
            lokal di browser.
          </p>
        </div>
      </section>

      <section aria-labelledby="mata-kuliah-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="mata-kuliah-heading"
            className="text-lg font-semibold text-neutral-900"
          >
            Mata Kuliah Tersedia (Cakupan MVP)
          </h2>
          <Link
            href="/cari"
            className="text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
          >
            Lihat semua tutor
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-neutral-900">
                    {course.name}
                  </h3>
                  <Badge variant="muted">{course.code}</Badge>
                </div>
                <p className="text-sm text-neutral-600">{course.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {course.topics.map((topic) => (
                    <Badge key={topic} variant="default">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Link
                  href={`/cari?course=${encodeURIComponent(course.id)}`}
                  className={buttonClasses({ variant: "outline" })}
                >
                  Cari Tutor {course.name}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="alur-heading" className="space-y-4">
        <h2
          id="alur-heading"
          className="text-lg font-semibold text-neutral-900"
        >
          Alur Penggunaan Prototipe
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Langkah 1
            </p>
            <h3 className="mt-1 text-sm font-semibold text-neutral-900">
              Cari &amp; Bandingkan Tutor
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Filter berdasarkan mata kuliah, topik (misal Integral), anggaran
              per 60 menit, dan jadwal.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Langkah 2
            </p>
            <h3 className="mt-1 text-sm font-semibold text-neutral-900">
              Chat &amp; Terima Tawaran Sesi
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Hubungi tutor, diskusikan materi, lalu coba ganti peran ke tutor
              demo untuk mengirim tawaran sesi terstruktur.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Langkah 3
            </p>
            <h3 className="mt-1 text-sm font-semibold text-neutral-900">
              Checkout QRIS Demo
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Lihat placeholder QRIS non-payable, unggah nama bukti simulasi,
              dan uji simulasi verifikasi admin.
            </p>
          </Card>
        </div>
      </section>

      <Notice title="Informasi Mode Demo">
        Gunakan email ITS sintetik format{" "}
        <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-xs">
          0000000001@student.its.ac.id
        </code>{" "}
        dan OTP demo{" "}
        <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-xs">
          123456
        </code>
        . Jangan masukkan kredensial asli atau melakukan transfer uang nyata.
      </Notice>
    </div>
  );
}
