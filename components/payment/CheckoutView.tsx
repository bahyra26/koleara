"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  const { user, hydrated, switchDemoRole } = useAuth();
  const { data, startPayment, submitDemoProof, simulateVerification } =
    useCheckout(bookingId);

  const [qrisOpen, setQrisOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
        <p className="text-sm text-neutral-600">
          Memuat halaman pembayaran...
        </p>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="mx-auto max-w-md space-y-3">
        <h1 className="text-lg font-semibold text-neutral-900">
          Login Demo Diperlukan
        </h1>
        <p className="text-sm text-neutral-600">
          Masuk dengan akun mahasiswa demo untuk melihat dan melanjutkan
          checkout.
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
        description={`Booking dengan ID "${bookingId}" tidak ditemukan di data demo.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/chat" className={buttonClasses()}>
              Buka Chat
            </Link>
            <Link href="/cari" className={buttonClasses({ variant: "outline" })}>
              Cari Tutor
            </Link>
          </div>
        }
      />
    );
  }

  const { booking, payment, learner } = data;
  const isOwnerLearner = user.id === booking.learnerId;

  if (booking.status === "offered" || booking.status === "declined") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <EmptyState
          title="Checkout Tidak Tersedia"
          description={
            booking.status === "declined"
              ? "Tawaran sesi ini telah ditolak dan tidak dapat dibayar."
              : "Tawaran sesi ini belum diterima oleh mahasiswa. Terima tawaran terlebih dahulu di ruang chat."
          }
          action={
            <Link
              href={`/chat/${booking.conversationId}`}
              className={buttonClasses()}
            >
              Kembali ke Chat
            </Link>
          }
        />
      </div>
    );
  }

  const handleOpenQris = () => {
    setActionError(null);
    const res = startPayment({ bookingId: booking.id, actorUserId: user.id });
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setQrisOpen(true);
  };

  const handleSubmitProof = (proofName: string) => {
    setActionError(null);
    const res = submitDemoProof({
      bookingId: booking.id,
      actorUserId: user.id,
      proofName,
    });
    if (res.ok) {
      setQrisOpen(false);
    }
    return res;
  };

  const handleSimulateVerification = (decision: "approve" | "reject") => {
    setActionError(null);
    const res = simulateVerification({
      bookingId: booking.id,
      decision,
    });
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    if (decision === "approve") {
      setSuccessModalOpen(true);
    } else {
      setQrisOpen(true);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Badge variant="outline">Checkout QRIS Statis — Mode Demo</Badge>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            Pembayaran Sesi Tutoring
          </h1>
        </div>
        <Link
          href={`/chat/${booking.conversationId}`}
          className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
        >
          &larr; Kembali ke Chat
        </Link>
      </div>

      <OrderSummary data={data} />

      {!isOwnerLearner ? (
        <Card className="space-y-3">
          <Notice title="Anda sedang berada di akun demo lain" tone="emphasis">
            Pemesanan ini milik mahasiswa{" "}
            <strong>{learner.name}</strong>. Beralih ke akun mahasiswa pemesan
            untuk melakukan aksi pembayaran demo.
          </Notice>
          <Button
            size="sm"
            onClick={() => switchDemoRole({ targetUserId: learner.id })}
          >
            Beralih ke Mahasiswa ({learner.name})
          </Button>
        </Card>
      ) : null}

      {actionError ? (
        <Notice tone="emphasis" role="alert">
          {actionError}
        </Notice>
      ) : null}

      {isOwnerLearner && payment.status === "unpaid" ? (
        !qrisOpen ? (
          <Card className="space-y-3">
            <p className="text-sm text-neutral-700">
              Periksa kembali detail tutor, jadwal WIB, dan total biaya di atas.
              Klik <strong>Bayar</strong> untuk menampilkan placeholder QRIS
              demo dan formulir bukti simulasi.
            </p>
            <Button fullWidth onClick={handleOpenQris}>
              Bayar
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <QrisPanel amount={payment.amount} />
            <ProofForm
              defaultFileName={payment.proofName}
              onSubmitProof={handleSubmitProof}
            />
          </div>
        )
      ) : null}

      {isOwnerLearner && payment.status === "rejected" ? (
        <div className="space-y-4">
          <Notice title="Verifikasi Demo Ditolak" tone="emphasis" role="alert">
            {payment.rejectionReason ??
              "Bukti pembayaran demo ditolak. Silakan kirim ulang bukti pembayaran demo."}
          </Notice>
          {!qrisOpen ? (
            <Card className="space-y-3">
              <p className="text-sm text-neutral-700">
                Anda dapat mencoba mengunggah ulang bukti pembayaran simulasi.
              </p>
              <Button fullWidth onClick={handleOpenQris}>
                Coba Bayar Ulang (Buka QRIS Demo)
              </Button>
            </Card>
          ) : (
            <>
              <QrisPanel amount={payment.amount} />
              <ProofForm
                defaultFileName={payment.proofName}
                onSubmitProof={handleSubmitProof}
              />
            </>
          )}
        </div>
      ) : null}

      {payment.status === "pending_verification" ? (
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">
                Menunggu Verifikasi Pembayaran
              </h2>
              <Badge variant="outline">pending_verification</Badge>
            </div>
            <p className="text-sm text-neutral-700">
              Bukti simulasi telah diterima dengan nama file{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">
                {payment.proofName ?? "bukti-qris-demo.jpg"}
              </code>
              {payment.submittedAt
                ? ` pada ${formatWibDateTime(payment.submittedAt)}`
                : ""}
              . Status belum lunas sampai verifikasi admin selesai.
            </p>
          </Card>

          <Card className="space-y-3 border-2 border-neutral-800 bg-neutral-50">
            <div className="space-y-1">
              <Badge variant="solid">Kontrol Simulasi Demo</Badge>
              <h3 className="text-sm font-semibold text-neutral-900">
                Simulasi Keputusan Verifikasi Admin
              </h3>
              <p className="text-xs text-neutral-600">
                Karena tidak ada backend atau dashboard admin pada prototipe
                ini, gunakan tombol di bawah untuk menguji skenario verifikasi
                berhasil atau ditolak.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => handleSimulateVerification("approve")}
              >
                Simulasikan verifikasi admin
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSimulateVerification("reject")}
              >
                Simulasikan verifikasi ditolak
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {payment.status === "paid" ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-900">
              Pembayaran Selesai (Terverifikasi Demo)
            </h2>
            <Badge variant="solid">paid</Badge>
          </div>
          <p className="text-sm text-neutral-700">
            Pemesanan ini sudah berstatus lunas pada Mode Demo
            {payment.verifiedAt
              ? ` (${formatWibDateTime(payment.verifiedAt)})`
              : ""}
            . Pembayaran ulang dinonaktifkan dan status tetap tersimpan saat
            halaman dimuat ulang.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuccessModalOpen(true)}
            >
              Lihat Popup Sukses
            </Button>
            <Link
              href={`/chat/${booking.conversationId}`}
              className={buttonClasses({ size: "sm" })}
            >
              Kembali ke Chat
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
