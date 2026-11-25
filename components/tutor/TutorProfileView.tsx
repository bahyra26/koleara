"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import { useConversations } from "@/features/chat/useChat";
import { useTutorProfile } from "@/features/tutors/useTutors";
import { formatIdr, getInitials } from "@/lib/formatters";

function verificationBadgeLabel(badge?: "grade" | "asdos"): string {
  if (badge === "asdos") return "Terverifikasi (Demo) — Asisten Dosen/Lab";
  if (badge === "grade") return "Terverifikasi (Demo) — Nilai A Mata Kuliah";
  return "Terverifikasi (Demo)";
}

export function TutorProfileView() {
  const params = useParams<{ id: string }>();
  const tutorId = typeof params.id === "string" ? params.id : "";
  return <TutorProfileContent key={tutorId} tutorId={tutorId} />;
}

function TutorProfileContent({ tutorId }: { tutorId: string }) {
  const router = useRouter();
  const { user, hydrated, lastLearner, switchDemoRole } = useAuth();
  const { tutor, courses } = useTutorProfile(tutorId);
  const { getOrCreateConversation } = useConversations(user?.id ?? null);

  const [actionError, setActionError] = useState<string | null>(null);

  const isViewingOwnTutorAccount = Boolean(
    user && tutor && tutor.userId === user.id
  );

  if (!hydrated) {
    return (
      <Card>
        <p className="text-sm text-neutral-600">Memuat profil tutor...</p>
      </Card>
    );
  }

  if (!tutor) {
    return (
      <EmptyState
        title="Profil Tutor Tidak Ditemukan"
        description={`Tutor dengan ID "${tutorId}" tidak tersedia di data demo.`}
        action={
          <Link href="/cari" className={buttonClasses()}>
            Kembali ke Cari Tutor
          </Link>
        }
      />
    );
  }

  const handleContactTutor = () => {
    setActionError(null);
    if (!user) {
      router.push(
        `/login?next=${encodeURIComponent(`/tutor/${tutor.id}`)}`
      );
      return;
    }

    const result = getOrCreateConversation(user.id, tutor.id);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    router.push(`/chat/${result.data.id}`);
  };

  const handleSwitchToLearner = () => {
    setActionError(null);
    if (lastLearner) {
      switchDemoRole({ targetUserId: lastLearner.id });
    } else {
      switchDemoRole("learner");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/cari"
          className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
        >
          &larr; Kembali ke Cari Tutor
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start gap-4">
              <div
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-lg font-bold text-neutral-900"
              >
                {getInitials(tutor.name)}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                  {tutor.name}
                </h1>
                <p className="text-sm text-neutral-600">
                  Departemen {tutor.department} ITS • Angkatan {tutor.cohort}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline">
                    {verificationBadgeLabel(tutor.badge)}
                  </Badge>
                  {typeof tutor.rating === "number" ? (
                    <Badge variant="muted">
                      Rating Contoh: {tutor.rating.toFixed(1)}/5
                    </Badge>
                  ) : null}
                  {typeof tutor.completedSessionsDemo === "number" ? (
                    <Badge variant="muted">
                      {tutor.completedSessionsDemo} sesi (data contoh)
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4">
              <h2 className="text-sm font-semibold text-neutral-900">
                Tentang Tutor
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
                {tutor.bio}
              </p>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Mata Kuliah &amp; Topik yang Diajarkan
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {courses.map((course) => (
                  <Badge key={course.id} variant="solid">
                    {course.name} ({course.code})
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Subtopik
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tutor.topics.map((topic) => (
                  <Badge key={topic} variant="default">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900">
              Jadwal Ketersediaan Umum (WIB — Data Contoh)
            </h2>
            <ul className="space-y-1.5 text-sm text-neutral-700">
              {tutor.slots.map((slot) => (
                <li
                  key={slot}
                  className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
                >
                  {slot}
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-500">
              Jadwal final sesi 60 menit disepakati melalui kartu tawaran di
              dalam chat KOLEARA. Tidak menampilkan nomor telepon pribadi.
            </p>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                Tarif Sesi
              </p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">
                {formatIdr(tutor.hourlyRate)}
              </p>
              <p className="text-xs text-neutral-600">
                per 60 menit (pembayaran simulasi QRIS demo setelah tawaran
                diterima)
              </p>
            </div>

            {isViewingOwnTutorAccount ? (
              <Notice title="Anda sedang memakai akun tutor ini">
                <p>
                  Untuk menguji alur menghubungi tutor ini, beralihlah ke akun
                  mahasiswa demo terlebih dahulu.
                </p>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSwitchToLearner}
                  >
                    Beralih ke Mahasiswa Demo
                  </Button>
                </div>
              </Notice>
            ) : (
              <Button fullWidth onClick={handleContactTutor}>
                Hubungi Tutor
              </Button>
            )}

            {!user ? (
              <p className="text-xs text-neutral-600">
                Belum login? Mengklik <strong>Hubungi Tutor</strong> akan
                mengarahkan Anda ke halaman Login/Daftar Demo dan kembali ke
                profil ini.
              </p>
            ) : null}

            {actionError ? (
              <Notice tone="emphasis" role="alert">
                {actionError}
              </Notice>
            ) : null}
          </Card>

          <Notice>
            Komunikasi dan kesepakatan sesi dilakukan melalui fitur Chat
            internal KOLEARA (mode simulasi lokal).
          </Notice>
        </aside>
      </div>
    </div>
  );
}
