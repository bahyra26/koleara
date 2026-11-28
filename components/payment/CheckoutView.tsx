"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { OrderSummary } from "@/components/payment/OrderSummary";
import { ProofForm } from "@/components/payment/ProofForm";
import { QrisPanel } from "@/components/payment/QrisPanel";
import { SuccessModal } from "@/components/payment/SuccessModal";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import { useCheckout } from "@/features/payment/usePayment";
import { formatWibDateTime } from "@/lib/formatters";

export function CheckoutView() {
  const params = useParams<{ id: string }>();
  const bookingId = typeof params.id === "string" ? params.id : "";
  return <CheckoutContent key={bookingId} bookingId={bookingId} />;
}

function CheckoutContent({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { user, isAdmin, hydrated } = useAuth();
  const {
    data,
    startPayment,
    submitProof,
    adminVerifyPayment,
    createMidtransSnap,
  } = useCheckout(bookingId);

  const [qrisOpen, setQrisOpen] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const hadUserRef = useRef(false);

  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
      return;
    }
    if (hydrated && !hadUserRef.current) {
      router.replace(
        `/login?next=${encodeURIComponent(`/pembayaran/${bookingId}`)}`
      );
    }
  }, [hydrated, user, bookingId, router]);

  if (!hydrated) {
    return (
      <Card>
        <p className="text-sm text-[#5B686D]">Memuat halaman pembayaran...</p>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="mx-auto max-w-md space-y-3">
        <h1 className="text-lg font-semibold text-[#263238]">
          Login ITS Diperlukan
        </h1>
        <p className="text-sm text-[#5B686D]">
          Masuk dengan akun mahasiswa ITS Anda untuk melanjutkan pembayaran.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/pembayaran/${bookingId}`)}`}
          className={buttonClasses()}
        >
          Ke Halaman Login
        </Link>
      </Card>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Data Pembayaran Tidak Ditemukan"
        description={`Booking "${bookingId}" tidak ditemukan atau bukan milik akun Anda.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/sesi" className={buttonClasses()}>
              Lihat Sesi Saya
            </Link>
            <Link href="/cari" className={buttonClasses({ variant: "outline" })}>
              Cari Tutor
            </Link>
          </div>
        }
      />
    );
  }

  const { booking, payment, paymentConfig } = data;
  const isOwnerLearner = user.id === booking.learnerId;

  if (
    booking.status === "offered" ||
    booking.status === "requested" ||
    booking.status === "declined" ||
    booking.status === "cancelled" ||
    booking.status === "expired"
  ) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <EmptyState
          title="Checkout Tidak Tersedia"
          description={
            booking.status === "requested"
              ? "Permintaan sesi masih menunggu persetujuan tutor. Pembayaran dibuka segera setelah tutor menerima."
              : booking.status === "offered"
                ? "Tawaran sesi ini belum diterima. Terima tawaran terlebih dahulu di ruang chat."
                : `Sesi ini berstatus "${booking.status}" sehingga tidak dapat dibayar.`
          }
          action={
            <Link href={`/sesi/${booking.id}`} className={buttonClasses()}>
              Lihat Detail Sesi
            </Link>
          }
        />
      </div>
    );
  }

  const handleOpenQris = async () => {
    setActionError(null);
    setBusy(true);
    const res = await startPayment();
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setQrisOpen(true);
  };

  const handleMidtransSnap = async () => {
    setActionError(null);
    setBusy(true);
    const res = await createMidtransSnap();
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    window.open(res.data.redirectUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmitProof = async (args: {
    proofName: string;
    proofStorageId: Id<"_storage">;
  }) => {
    setActionError(null);
    const res = await submitProof(args);
    if (res.ok) {
      setQrisOpen(false);
    }
    return res;
  };

  const handleAdminDecision = async (decision: "approve" | "reject") => {
    setActionError(null);
    setBusy(true);
    const res = await adminVerifyPayment(decision);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    if (decision === "approve") {
      setSuccessModalOpen(true);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Badge variant="outline">Pembayaran Aman (Escrow KOLEARA)</Badge>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#263238]">
            Pembayaran Sesi Tutoring
          </h1>
        </div>
        <Link
          href={`/sesi/${booking.id}`}
          className="text-sm font-medium text-[#3979A5] underline underline-offset-4 hover:text-[#285B7B]"
        >
          &larr; Detail Sesi
        </Link>
      </div>

      <OrderSummary data={data} />

      {booking.paymentDeadlineAt && payment.status === "unpaid" ? (
        <Notice title="Batas Waktu Pembayaran">
          Selesaikan pembayaran sebelum{" "}
          <strong>{formatWibDateTime(booking.paymentDeadlineAt)}</strong> agar
          slot jadwal tidak dilepas otomatis.
        </Notice>
      ) : null}

      {actionError ? (
        <Notice tone="emphasis" role="alert">
          {actionError}
        </Notice>
      ) : null}

      {isOwnerLearner &&
      (payment.status === "unpaid" || payment.status === "rejected") ? (
        <div className="space-y-4">
          {payment.status === "rejected" ? (
            <Notice title="Bukti Pembayaran Ditolak" tone="emphasis" role="alert">
              {payment.rejectionReason ??
                "Bukti pembayaran sebelumnya ditolak admin. Silakan unggah ulang bukti transfer yang jelas."}
            </Notice>
          ) : null}

          {paymentConfig?.midtransEnabled ? (
            <Card className="space-y-3 rounded-[22px] border-[#8EB4CE] bg-[#F5F9FC]">
              <p className="text-sm font-semibold text-[#263238]">
                Pembayaran Otomatis (Midtrans Snap)
              </p>
              <Button fullWidth disabled={busy} onClick={handleMidtransSnap}>
                {busy ? "Menyiapkan Midtrans..." : "Bayar via Midtrans Snap"}
              </Button>
            </Card>
          ) : null}

          {!qrisOpen ? (
            <Button fullWidth disabled={busy} onClick={handleOpenQris}>
              Tampilkan QRIS KOLEARA
            </Button>
          ) : (
            <>
              <QrisPanel amount={payment.amount} config={paymentConfig} />
              <ProofForm onSubmitProof={handleSubmitProof} />
            </>
          )}
        </div>
      ) : null}

      {payment.status === "pending_verification" ? (
        <div className="space-y-4">
          <Card className="space-y-3 rounded-[22px] border-[#8EB4CE]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#263238]">
                Menunggu Verifikasi Admin KOLEARA
              </h2>
              <Badge variant="outline">Menunggu Verifikasi</Badge>
            </div>
            <p className="text-sm text-[#5B686D]">
              Bukti transfer{" "}
              <code className="rounded bg-[#F5F9FC] px-1.5 py-0.5 font-mono text-xs text-[#263238]">
                {payment.proofName ?? "bukti-qris"}
              </code>
              {payment.submittedAt
                ? ` telah diterima pada ${formatWibDateTime(payment.submittedAt)}`
                : " telah diterima"}
              . Halaman ini akan terbarui otomatis segera setelah admin
              memverifikasi pembayaran Anda.
            </p>
            {payment.proofUrl ? (
              <div className="overflow-hidden rounded-xl border border-[#CBD6DE] bg-[#F8FAFB] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={payment.proofUrl}
                  alt="Bukti transfer terunggah"
                  className="mx-auto max-h-60 rounded-lg object-contain"
                />
              </div>
            ) : null}
          </Card>

          {isAdmin ? (
            <Card className="space-y-3 rounded-[22px] border-2 border-[#285B7B] bg-[#F5F9FC]">
              <div className="space-y-1">
                <Badge variant="solid">Panel Cepat Admin</Badge>
                <h3 className="text-sm font-semibold text-[#263238]">
                  Verifikasi Pembayaran QRIS Statis
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => handleAdminDecision("approve")}
                >
                  Setujui &amp; Tandai Lunas
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleAdminDecision("reject")}
                >
                  Tolak Bukti
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {payment.status === "paid" ? (
        <Card className="space-y-3 rounded-[22px] border-[#3979A5] bg-[#F5F9FC]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#263238]">
              Pembayaran Terverifikasi &amp; Lunas
            </h2>
            <Badge variant="solid">Lunas</Badge>
          </div>
          <p className="text-sm text-[#5B686D]">
            Pembayaran selesai diverifikasi
            {payment.verifiedAt
              ? ` pada ${formatWibDateTime(payment.verifiedAt)}`
              : ""}
            . Dana ditahan aman oleh KOLEARA sampai sesi selesai dikonfirmasi.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/sesi/${booking.id}`}
              className={buttonClasses({ size: "sm" })}
            >
              Buka Detail Sesi (Link &amp; WA)
            </Link>
            <Link
              href={`/chat/${booking.conversationId}`}
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              Buka Chat Tutor
            </Link>
          </div>
        </Card>
      ) : null}

      <SuccessModal
        open={successModalOpen && payment.status === "paid"}
        data={data}
        onClose={() => setSuccessModalOpen(false)}
      />
    </div>
  );
}
