"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import { useCourses } from "@/features/tutors/useTutors";
import type { Booking, BookingStatus } from "@/lib/contracts";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";

type SessionTab =
  | "all"
  | "pending"
  | "payment"
  | "scheduled"
  | "completed"
  | "closed";

const TABS: Array<{ id: SessionTab; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Menunggu" },
  { id: "payment", label: "Perlu Dibayar" },
  { id: "scheduled", label: "Terjadwal" },
  { id: "completed", label: "Selesai" },
  { id: "closed", label: "Dibatalkan" },
];

function getStatusMeta(status: BookingStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "requested":
      return {
        label: "Menunggu Tutor",
        badgeClass: "bg-[#EAF2F7] text-[#285B7B] border-[#B9D2E2]",
      };
    case "offered":
      return {
        label: "Penawaran Chat",
        badgeClass: "bg-[#EAF2F7] text-[#285B7B] border-[#B9D2E2]",
      };
    case "accepted":
      return {
        label: "Menunggu Pembayaran",
        badgeClass: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      };
    case "paid":
      return {
        label: "Terjadwal (Lunas)",
        badgeClass: "bg-[#DCFCE7] text-[#166534] border-[#86EFAC]",
      };
    case "tutor_marked_done":
      return {
        label: "Menunggu Konfirmasi",
        badgeClass: "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
      };
    case "completed":
      return {
        label: "Selesai",
        badgeClass: "bg-[#215273] text-white border-[#215273]",
      };
    case "declined":
      return {
        label: "Ditolak Tutor",
        badgeClass: "bg-[#F8EEEE] text-[#9A4A4A] border-[#E7C6C6]",
      };
    case "cancelled":
      return {
        label: "Dibatalkan",
        badgeClass: "bg-neutral-100 text-neutral-600 border-neutral-300",
      };
    case "expired":
      return {
        label: "Kedaluwarsa",
        badgeClass: "bg-neutral-100 text-neutral-600 border-neutral-300",
      };
    case "disputed":
      return {
        label: "Dalam Investigasi",
        badgeClass: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
      };
  }
}

function matchesTab(booking: Booking, tab: SessionTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "pending":
      return booking.status === "requested" || booking.status === "offered";
    case "payment":
      return booking.status === "accepted";
    case "scheduled":
      return (
        booking.status === "paid" || booking.status === "tutor_marked_done"
      );
    case "completed":
      return booking.status === "completed";
    case "closed":
      return (
        booking.status === "declined" ||
        booking.status === "cancelled" ||
        booking.status === "expired" ||
        booking.status === "disputed"
      );
  }
}

export default function MySessionsPage() {
  const { user, sessionToken, hydrated, isTutor } = useAuth();
  const [activeTab, setActiveTab] = useState<SessionTab>("all");
  const [roleView, setRoleView] = useState<"all" | "learner" | "tutor">("all");

  const courses = useCourses();
  const tutorResults = useQuery(api.tutors.searchTutors, {});
  const sessions = useQuery(
    api.bookings.listMySessions,
    user && sessionToken ? { sessionToken, roleView } : "skip"
  );

  const courseMap = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses]
  );
  const tutorMap = useMemo(
    () => new Map((tutorResults ?? []).map((item) => [item.tutor.id, item.tutor])),
    [tutorResults]
  );

  const filteredSessions = useMemo(
    () => (sessions ?? []).filter((b) => matchesTab(b, activeTab)),
    [sessions, activeTab]
  );

  if (!hydrated) {
    return (
      <div className="py-12 text-center text-sm text-[#5B686D]">
        Memuat daftar sesi Anda...
      </div>
    );
  }

  if (!user || !sessionToken) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="space-y-4 rounded-[26px] border-[#CBD6DE] p-6 text-center sm:p-8">
          <h1 className="text-xl font-semibold text-[#263238]">
            Masuk untuk Melihat Sesi Anda
          </h1>
          <p className="text-sm text-[#5B686D]">
            Pantau permintaan sesi, status verifikasi pembayaran QRIS, link
            meeting, dan ulasan tutor secara realtime.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/login?next=%2Fsesi"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#285B7B] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1E4761]"
            >
              Login Email ITS
            </Link>
            <Link
              href="/cari"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#CBD6DE] px-5 text-sm font-medium text-[#263238] hover:bg-[#F5F8FA]"
            >
              Cari Tutor
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <section className="space-y-6 pb-12 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[28px] border border-[#CBD6DE] bg-[#EAF2F7] px-6 py-6 sm:px-8">
        <div className="space-y-1.5">
          <Badge variant="outline" className="border-[#3979A5] text-[#285B7B]">
            Pelacak Sesi Realtime
          </Badge>
          <h1 className="text-2xl font-semibold text-[#263238] sm:text-3xl">
            Sesi Belajar Saya
          </h1>
          <p className="text-sm text-[#5B686D]">
            Kelola jadwal sesi, selesaikan pembayaran QRIS statis, dan konfirmasi
            penyelesaian sesi dengan aman.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/cari"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3979A5] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#285B7B]"
          >
            Cari Tutor Baru
          </Link>
          {isTutor ? (
            <Link
              href="/dashboard-tutor"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#3979A5] bg-white px-5 text-sm font-semibold text-[#285B7B] transition-colors hover:bg-[#F5F9FC]"
            >
              Dashboard Tutor
            </Link>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter status sesi">
          {TABS.map((tab) => {
            const count = (sessions ?? []).filter((b) =>
              matchesTab(b, tab.id)
            ).length;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors sm:text-sm ${
                  active
                    ? "border-[#285B7B] bg-[#285B7B] text-white"
                    : "border-[#CBD6DE] bg-white text-[#5B686D] hover:bg-[#F3F7FA]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                    active ? "bg-white/20 text-white" : "bg-[#EAF2F7] text-[#285B7B]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {isTutor ? (
          <div className="flex items-center gap-1 rounded-xl border border-[#CBD6DE] bg-white p-1 text-xs">
            {(
              [
                { id: "all", label: "Semua Peran" },
                { id: "learner", label: "Sebagai Learner" },
                { id: "tutor", label: "Sebagai Tutor" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRoleView(opt.id)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  roleView === opt.id
                    ? "bg-[#EAF2F7] text-[#285B7B]"
                    : "text-[#5B686D] hover:text-[#263238]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Session List */}
      {sessions === undefined ? (
        <div className="py-10 text-center text-sm text-[#5B686D]">
          Mengambil data sesi dari server...
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card className="rounded-[24px] border-[#CBD6DE] py-12 text-center">
          <p className="text-base font-semibold text-[#263238]">
            Belum ada sesi pada kategori ini
          </p>
          <p className="mt-1 text-sm text-[#5B686D]">
            Mulai cari tutor terverifikasi ITS dan ajukan jadwal yang cocok.
          </p>
          <div className="mt-5">
            <Link
              href="/cari"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3979A5] px-5 text-sm font-semibold text-white hover:bg-[#285B7B]"
            >
              Jelajahi Tutor Terverifikasi
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSessions.map((booking) => {
            const course = courseMap.get(booking.courseId);
            const tutor = tutorMap.get(booking.tutorId);
            const statusMeta = getStatusMeta(booking.status);
            const isLearnerRole = booking.learnerId === user.id;

            return (
              <Card
                key={booking.id}
                className="flex flex-col justify-between gap-4 rounded-[22px] border-[#CBD6DE] p-5 transition-shadow hover:shadow-sm sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                    <Badge variant="muted">
                      {isLearnerRole ? "Learner" : "Tutor"}
                    </Badge>
                    <Badge variant="outline">
                      {booking.meetingMode === "offline_its"
                        ? "Tatap Muka ITS"
                        : "Online"}
                    </Badge>
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-[#263238] sm:text-lg">
                      {course ? `${course.name} — ` : ""}
                      {booking.topic}
                    </h2>
                    <p className="text-sm text-[#5B686D]">
                      {tutor
                        ? `Tutor: ${tutor.name} (${tutor.department})`
                        : `ID Tutor: ${booking.tutorId}`}{" "}
                      • {formatWibDateTime(booking.startAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B686D]">
                    <span>
                      Paket: <strong>{booking.sessionCount ?? 1} sesi × 60 mnt</strong>
                    </span>
                    <span>
                      Total: <strong className="text-[#263238]">{formatIdr(booking.price)}</strong>
                    </span>
                    <span className="font-mono">{booking.id}</span>
                  </div>

                  {booking.status === "accepted" && booking.paymentDeadlineAt ? (
                    <Notice tone="neutral" className="text-xs">
                      Batas pembayaran: <strong>{formatWibDateTime(booking.paymentDeadlineAt)}</strong>
                    </Notice>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <Link href={`/sesi/${booking.id}`} className="w-full sm:w-auto">
                    <Button variant="primary" size="sm" fullWidth className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]">
                      Buka Pelacak Sesi
                    </Button>
                  </Link>
                  {booking.status === "accepted" && isLearnerRole ? (
                    <Link
                      href={`/pembayaran/${booking.id}`}
                      className="w-full sm:w-auto"
                    >
                      <Button variant="outline" size="sm" fullWidth>
                        Bayar via QRIS
                      </Button>
                    </Link>
                  ) : null}
                  {booking.conversationId ? (
                    <Link
                      href={`/chat/${booking.conversationId}`}
                      className="text-xs font-medium text-[#3979A5] hover:underline"
                    >
                      Buka Ruang Chat
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
