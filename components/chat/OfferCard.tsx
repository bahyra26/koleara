"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking, Course, Payment } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";

type OfferCardProps = {
  booking: Booking;
  course?: Course;
  payment?: Payment;
  tutorName: string;
  isLearner: boolean;
  onAccept: (bookingId: string) => { ok: boolean; error?: string };
  onDecline: (bookingId: string) => { ok: boolean; error?: string };
};

function getOfferStatusBadge(
  booking: Booking,
  payment?: Payment
): { label: string; variant: "default" | "solid" | "outline" | "muted" } {
  if (booking.status === "paid" || payment?.status === "paid") {
    return { label: "Sudah Dibayar (Demo)", variant: "solid" };
  }
  if (booking.status === "declined") {
    return { label: "Tawaran Ditolak", variant: "muted" };
  }
  if (booking.status === "accepted") {
    if (payment?.status === "pending_verification") {
      return {
        label: "Menunggu Verifikasi Pembayaran",
        variant: "outline",
      };
    }
    if (payment?.status === "rejected") {
      return {
        label: "Verifikasi Pembayaran Ditolak",
        variant: "outline",
      };
    }
    return { label: "Diterima — Siap Dibayar", variant: "outline" };
  }
  return { label: "Menunggu Konfirmasi Mahasiswa", variant: "default" };
}

export function OfferCard({
  booking,
  course,
  payment,
  tutorName,
  isLearner,
  onAccept,
  onDecline,
}: OfferCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badge = getOfferStatusBadge(booking, payment);

  const handleAccept = () => {
    if (busy || booking.status !== "offered") return;
    setBusy(true);
    setError(null);
    const res = onAccept(booking.id);
    if (!res.ok) {
      setError(res.error ?? "Gagal menerima tawaran.");
    }
    setBusy(false);
  };

  const handleDecline = () => {
    if (busy || booking.status !== "offered") return;
    setBusy(true);
    setError(null);
    const res = onDecline(booking.id);
    if (!res.ok) {
      setError(res.error ?? "Gagal menolak tawaran.");
    }
    setBusy(false);
  };

  return (
    <div className="my-1 rounded-lg border-2 border-neutral-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 pb-2.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Tawaran Sesi Tutor • {tutorName}
          </p>
          <h3 className="text-sm font-semibold text-neutral-900">
            {course?.name ?? booking.courseId} — {booking.topic}
          </h3>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Jadwal (WIB)</dt>
          <dd className="font-medium text-neutral-900">
            {formatWibDateTime(booking.startAt)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Durasi &amp; Mode</dt>
          <dd className="font-medium text-neutral-900">
            {booking.durationMinutes} menit •{" "}
            {booking.meetingMode === "offline_its"
              ? "Tatap Muka (Kampus ITS)"
              : "Online"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Total Biaya</dt>
          <dd className="text-sm font-bold text-neutral-900">
            {formatIdr(booking.price)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">ID Booking</dt>
          <dd className="font-mono text-neutral-700">{booking.id}</dd>
        </div>
      </dl>

      {booking.brief ? (
        <p className="mt-2.5 rounded bg-neutral-50 px-2.5 py-2 text-xs text-neutral-700">
          Catatan: {booking.brief}
        </p>
      ) : null}

      {error ? (
        <Notice tone="emphasis" role="alert" className="mt-3 text-xs">
          {error}
        </Notice>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
        {booking.status === "offered" ? (
          isLearner ? (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAccept}
                disabled={busy}
              >
                Terima Tawaran
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecline}
                disabled={busy}
              >
                Tolak Tawaran
              </Button>
            </>
          ) : (
            <p className="text-xs text-neutral-600">
              Hanya mahasiswa penerima tawaran yang dapat menerima atau menolak.
              Ganti ke peran Mahasiswa Demo untuk merespons.
            </p>
          )
        ) : null}

        {booking.status === "accepted" ? (
          isLearner ? (
            <Link
              href={`/pembayaran/${booking.id}`}
              className={buttonClasses({ size: "sm" })}
            >
              {payment?.status === "pending_verification"
                ? "Lihat Status Verifikasi Pembayaran"
                : payment?.status === "rejected"
                  ? "Coba Bayar Ulang (QRIS Demo)"
                  : "Lanjut ke Pembayaran"}
            </Link>
          ) : (
            <p className="text-xs text-neutral-600">
              Tawaran diterima mahasiswa.{" "}
              {payment?.status === "pending_verification"
                ? "Bukti demo sedang menunggu verifikasi."
                : "Menunggu mahasiswa menyelesaikan pembayaran demo."}
            </p>
          )
        ) : null}

        {booking.status === "paid" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-neutral-800">
              Pembayaran telah diverifikasi (Mode Demo).
            </span>
            <Link
              href={`/pembayaran/${booking.id}`}
              className="text-xs font-medium text-neutral-900 underline underline-offset-4"
            >
              Lihat Ringkasan Pembayaran
            </Link>
          </div>
        ) : null}

        {booking.status === "declined" ? (
          <p className="text-xs text-neutral-500">
            Tawaran ditolak dan tidak dapat dilanjutkan ke pembayaran.
          </p>
        ) : null}
      </div>
    </div>
  );
}
