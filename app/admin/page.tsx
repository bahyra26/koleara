"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import type { PaymentMode, VerificationBadge } from "@/lib/contracts";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";

type AdminTab = "tutors" | "payments" | "qris" | "payouts";

export default function AdminConsolePage() {
  const { user, sessionToken, hydrated, isAdmin, uploadFile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("payments");

  const authArgs =
    hydrated && isAdmin && sessionToken ? { sessionToken } : "skip";

  const pendingApps = useQuery(api.admin.listPendingApplications, authArgs);
  const pendingPayments = useQuery(api.admin.listPendingPayments, authArgs);
  const readyPayouts = useQuery(api.admin.listReadyPayouts, authArgs);
  const payoutHistory = useQuery(api.admin.listPayouts, authArgs);
  const pilotMetrics = useQuery(api.metrics.getPilotMetrics, authArgs);
  const paymentConfig = useQuery(api.payments.getPaymentConfig, {});

  const approveTutor = useMutation(api.admin.approveTutorApplication);
  const rejectTutor = useMutation(api.admin.rejectTutorApplication);
  const verifyPayment = useMutation(api.payments.simulateVerification);
  const updatePaymentConfig = useMutation(api.payments.updatePaymentConfig);
  const createPayoutBatch = useMutation(api.admin.createPayoutBatch);

  const [badgeDrafts, setBadgeDrafts] = useState<
    Record<string, VerificationBadge>
  >({});
  const [rejectReasonDrafts, setRejectReasonDrafts] = useState<
    Record<string, string>
  >({});
  const [paymentRejectDrafts, setPaymentRejectDrafts] = useState<
    Record<string, string>
  >({});

  // Static QRIS config state (overrides over live Convex paymentConfig)
  const [qrisModeOverride, setQrisMode] = useState<PaymentMode | null>(null);
  const [merchantNameOverride, setMerchantName] = useState<string | null>(null);
  const [accountInfoOverride, setAccountInfo] = useState<string | null>(null);
  const [instructionsOverride, setInstructions] = useState<string | null>(null);
  const [uploadedQrisStorageId, setUploadedQrisStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [uploadedQrisPreview, setUploadedQrisPreview] = useState<string | null>(
    null
  );

  // Payout proof upload per tutor
  const [payoutProofs, setPayoutProofs] = useState<
    Record<string, { storageId: Id<"_storage">; fileName: string }>
  >({});

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "neutral" | "emphasis";
    text: string;
  } | null>(null);

  const qrisMode: PaymentMode =
    qrisModeOverride ?? paymentConfig?.mode ?? "static_qris";
  const merchantName =
    merchantNameOverride ?? paymentConfig?.merchantName ?? "";
  const accountInfo =
    accountInfoOverride ?? paymentConfig?.accountInfo ?? "";
  const instructions =
    instructionsOverride ?? paymentConfig?.instructions ?? "";

  if (!hydrated) {
    return (
      <div className="py-12 text-center text-sm text-[#5B686D]">
        Memuat Konsol Admin KOLEARA...
      </div>
    );
  }

  if (!user || !sessionToken) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="space-y-4 rounded-[26px] border-[#CBD6DE] p-6 text-center">
          <h1 className="text-xl font-semibold text-[#263238]">
            Login Admin Diperlukan
          </h1>
          <p className="text-sm text-[#5B686D]">
            Silakan login menggunakan akun admin KOLEARA untuk mengakses panel
            verifikasi dan pencairan honor.
          </p>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#285B7B] px-6 text-sm font-semibold text-white"
          >
            Ke Halaman Login
          </Link>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="space-y-4 rounded-[26px] border-[#E7C6C6] bg-[#FFF9F9] p-6 text-center">
          <Badge variant="outline">Akses Terbatas</Badge>
          <h1 className="text-xl font-semibold text-[#263238]">
            Halaman Khusus Tim Admin KOLEARA
          </h1>
          <p className="text-sm text-[#5B686D]">
            Akun Anda ({user.email}) tidak memiliki hak akses administrator.
          </p>
          <Link
            href="/cari"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3979A5] px-5 text-sm font-semibold text-white"
          >
            Kembali ke Cari Tutor
          </Link>
        </Card>
      </div>
    );
  }

  const handleApproveTutor = async (applicationId: string) => {
    setBusyKey(`approve-tutor-${applicationId}`);
    setFeedback(null);
    const badge = badgeDrafts[applicationId] ?? "grade";
    const res = await approveTutor({
      applicationId,
      badge,
      sessionToken,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? {
            tone: "neutral",
            text: `Tutor ${res.data.name} disetujui (${badge}) dan berkas bukti telah dihapus otomatis dari Storage.`,
          }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleRejectTutor = async (applicationId: string) => {
    setBusyKey(`reject-tutor-${applicationId}`);
    setFeedback(null);
    const res = await rejectTutor({
      applicationId,
      rejectionReason: rejectReasonDrafts[applicationId]?.trim() || undefined,
      sessionToken,
    });
    setBusyKey(null);
    setFeedback(
      res.rejected
        ? {
            tone: "neutral",
            text: "Pengajuan tutor ditolak dan berkas bukti telah dihapus otomatis dari Storage.",
          }
        : { tone: "emphasis", text: "Gagal menolak pengajuan tutor." }
    );
  };

  const handleVerifyPayment = async (
    bookingId: string,
    decision: "approve" | "reject"
  ) => {
    setBusyKey(`pay-${decision}-${bookingId}`);
    setFeedback(null);
    const res = await verifyPayment({
      bookingId,
      decision,
      rejectionReason:
        decision === "reject"
          ? paymentRejectDrafts[bookingId]?.trim() || undefined
          : undefined,
      sessionToken,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? {
            tone: "neutral",
            text:
              decision === "approve"
                ? `Pembayaran booking ${bookingId} diverifikasi LUNAS. Kontak & link meeting kini terbuka.`
                : `Bukti pembayaran booking ${bookingId} ditolak. Learner dapat mengunggah ulang bukti.`,
          }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleQrisFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusyKey("upload-qris");
    setFeedback(null);
    const uploaded = await uploadFile(file);
    setBusyKey(null);
    if (!uploaded.ok) {
      setFeedback({ tone: "emphasis", text: uploaded.error });
      return;
    }
    setUploadedQrisStorageId(uploaded.data.storageId);
    setUploadedQrisPreview(URL.createObjectURL(file));
    setFeedback({
      tone: "neutral",
      text: `Foto QRIS "${uploaded.data.fileName}" siap disimpan. Klik "Simpan Konfigurasi QRIS" untuk mengaktifkan di seluruh transaksi.`,
    });
  };

  const handleSavePaymentConfig = async (e: FormEvent) => {
    e.preventDefault();
    setBusyKey("save-qris");
    setFeedback(null);
    const res = await updatePaymentConfig({
      sessionToken,
      mode: qrisMode,
      merchantName: merchantName.trim(),
      accountInfo: accountInfo.trim() || undefined,
      instructions: instructions.trim(),
      ...(uploadedQrisStorageId
        ? { qrisStorageId: uploadedQrisStorageId }
        : {}),
    });
    setBusyKey(null);
    if (!res.ok) {
      setFeedback({ tone: "emphasis", text: res.error });
      return;
    }
    setUploadedQrisStorageId(null);
    setUploadedQrisPreview(null);
    setFeedback({
      tone: "neutral",
      text: "Konfigurasi QRIS Statis berhasil diperbarui dan langsung aktif di semua halaman checkout.",
    });
  };

  const handlePayoutProofUpload = async (
    tutorId: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusyKey(`upload-payout-${tutorId}`);
    const uploaded = await uploadFile(file);
    setBusyKey(null);
    if (!uploaded.ok) {
      setFeedback({ tone: "emphasis", text: uploaded.error });
      return;
    }
    setPayoutProofs((prev) => ({
      ...prev,
      [tutorId]: uploaded.data,
    }));
  };

  const handleCreatePayout = async (tutorId: string, bookingIds: string[]) => {
    setBusyKey(`payout-${tutorId}`);
    setFeedback(null);
    const proof = payoutProofs[tutorId];
    const res = await createPayoutBatch({
      tutorId,
      bookingIds,
      proofStorageId: proof?.storageId,
      proofFileName: proof?.fileName,
      sessionToken,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? {
            tone: "neutral",
            text: `Pencairan batch ${formatIdr(res.data.amount)} untuk ${bookingIds.length} sesi berhasil dicatat!`,
          }
        : { tone: "emphasis", text: res.error }
    );
  };

  const activeQrisSrc =
    uploadedQrisPreview ?? paymentConfig?.qrisImageUrl ?? "/qris-koleara.png";

  return (
    <section className="space-y-6 pb-12 pt-2">
      {/* Admin Header */}
      <div className="rounded-[28px] border border-[#CBD6DE] bg-[#215273] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B6D4E7]">
              KOLEARA Operations Console
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              Konsol Admin &amp; Verifikasi
            </h1>
            <p className="mt-1 text-sm text-white/80">
              Verifikasi bukti QRIS statis, kurasi pengajuan tutor ITS, kelola
              foto QRIS tim, dan cairkan honor tutor.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Bukti QRIS Menunggu</p>
            <p className="mt-1 text-2xl font-bold">
              {pendingPayments?.length ?? 0}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Pengajuan Tutor</p>
            <p className="mt-1 text-2xl font-bold">{pendingApps?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Antrean Payout Tutor</p>
            <p className="mt-1 text-2xl font-bold">
              {readyPayouts?.length ?? 0}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Total Revenue Terverifikasi</p>
            <p className="mt-1 text-xl font-bold text-[#A7F3D0]">
              {formatIdr(pilotMetrics?.totalRevenueIdr ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {feedback ? (
        <Notice tone={feedback.tone} role="status">
          {feedback.text}
        </Notice>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            {
              id: "payments",
              label: `Verifikasi QRIS (${pendingPayments?.length ?? 0})`,
            },
            {
              id: "tutors",
              label: `Verifikasi Tutor (${pendingApps?.length ?? 0})`,
            },
            { id: "qris", label: "Pengaturan QRIS Statis" },
            {
              id: "payouts",
              label: `Payout & Metrik Pilot (${readyPayouts?.length ?? 0})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "border-[#285B7B] bg-[#285B7B] text-white"
                : "border-[#CBD6DE] bg-white text-[#5B686D] hover:bg-[#F3F7FA]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Pending QRIS Payments */}
      {activeTab === "payments" ? (
        !pendingPayments || pendingPayments.length === 0 ? (
          <Card className="rounded-[24px] border-[#CBD6DE] py-12 text-center">
            <p className="font-semibold text-[#263238]">
              Tidak ada bukti pembayaran yang menunggu verifikasi
            </p>
            <p className="mt-1 text-sm text-[#5B686D]">
              Setiap bukti transfer QRIS statis yang diunggah mahasiswa akan
              muncul otomatis di sini.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingPayments.map((pay) => (
              <Card
                key={pay.id}
                className="space-y-4 rounded-[24px] border-[#CBD6DE] p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline">Menunggu Verifikasi</Badge>
                    <h2 className="mt-1.5 text-lg font-bold text-[#263238]">
                      {formatIdr(pay.amount)}
                    </h2>
                    <p className="font-mono text-xs text-[#5B686D]">
                      Booking: {pay.bookingId}
                    </p>
                    {pay.submittedAt ? (
                      <p className="text-xs text-[#5B686D]">
                        Diunggah: {formatWibDateTime(pay.submittedAt)}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/pembayaran/${pay.bookingId}`}
                    className="text-xs font-semibold text-[#3979A5] hover:underline"
                  >
                    Buka Checkout ↗
                  </Link>
                </div>

                {pay.proofUrl ? (
                  <div className="overflow-hidden rounded-xl border border-[#CBD6DE] bg-[#F8FAFB] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pay.proofUrl}
                      alt={`Bukti pembayaran ${pay.bookingId}`}
                      className="max-h-64 w-full rounded-lg object-contain"
                    />
                    <div className="mt-2 flex items-center justify-between px-1 text-xs">
                      <span className="truncate text-[#5B686D]">
                        {pay.proofName ?? "bukti-qris"}
                      </span>
                      <a
                        href={pay.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#3979A5] hover:underline"
                      >
                        Buka Ukuran Penuh ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <Notice tone="neutral" className="text-xs">
                    Nama berkas: {pay.proofName ?? "Tidak ada lampiran gambar"}
                  </Notice>
                )}

                <Input
                  id={`pay-rej-${pay.bookingId}`}
                  label="Alasan Penolakan (isi jika menolak)"
                  placeholder="Contoh: Nominal transfer tidak sesuai atau gambar buram"
                  value={paymentRejectDrafts[pay.bookingId] ?? ""}
                  onChange={(e) =>
                    setPaymentRejectDrafts((prev) => ({
                      ...prev,
                      [pay.bookingId]: e.target.value,
                    }))
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleVerifyPayment(pay.bookingId, "approve")}
                    disabled={busyKey !== null}
                    className="bg-[#166534] border-[#166534] hover:bg-[#14532D]"
                  >
                    {busyKey === `pay-approve-${pay.bookingId}`
                      ? "Memverifikasi..."
                      : "Setujui Lunas"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleVerifyPayment(pay.bookingId, "reject")}
                    disabled={busyKey !== null}
                  >
                    {busyKey === `pay-reject-${pay.bookingId}`
                      ? "Menolak..."
                      : "Tolak Bukti"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {/* TAB 2: Pending Tutor Applications */}
      {activeTab === "tutors" ? (
        !pendingApps || pendingApps.length === 0 ? (
          <Card className="rounded-[24px] border-[#CBD6DE] py-12 text-center">
            <p className="font-semibold text-[#263238]">
              Tidak ada pengajuan tutor yang menunggu kurasi
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingApps.map((app) => (
              <Card
                key={app.id}
                className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge variant="outline">Menunggu Verifikasi</Badge>
                    <h2 className="mt-1.5 text-lg font-semibold text-[#263238]">
                      {app.name}
                    </h2>
                    <p className="text-sm text-[#5B686D]">
                      {app.department ?? "ITS"} • Angkatan {app.cohort ?? "-"}{" "}
                      • Tarif <strong>{formatIdr(app.hourlyRate)}/sesi</strong>
                    </p>
                  </div>
                  <p className="text-xs text-[#5B686D]">
                    Diajukan: {formatWibDateTime(app.createdAt)}
                  </p>
                </div>

                <p className="rounded-xl bg-[#F8FAFB] p-3.5 text-sm text-[#263238]">
                  {app.bio}
                </p>

                <div className="grid gap-3 text-xs text-[#5B686D] sm:grid-cols-3">
                  <div>
                    <p className="font-semibold text-[#263238]">Mata Kuliah</p>
                    <p>{app.courseIds.join(", ")}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#263238]">Topik</p>
                    <p>{app.topics.join(", ")}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#263238]">
                      Mode &amp; Bahasa
                    </p>
                    <p>
                      {app.teachingMode ?? "hybrid"} •{" "}
                      {(app.languages ?? ["id"]).join("/").toUpperCase()}
                    </p>
                  </div>
                </div>

                {app.payoutBankOrWallet ? (
                  <p className="text-xs text-[#5B686D]">
                    Rekening Payout:{" "}
                    <strong>
                      {app.payoutBankOrWallet} — {app.payoutAccountNumber} (a.n.{" "}
                      {app.payoutAccountName})
                    </strong>
                  </p>
                ) : null}

                {app.proofUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#CBD6DE] bg-[#EAF2F7] px-4 py-3 text-xs">
                    <span className="font-medium text-[#285B7B]">
                      Bukti Kompetensi: {app.proofFileName ?? "lampiran-bukti"}
                    </span>
                    <a
                      href={app.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#285B7B] underline"
                    >
                      Buka Bukti Transkrip / Asdos ↗
                    </a>
                  </div>
                ) : (
                  <Notice tone="neutral" className="text-xs">
                    Belum melampirkan berkas bukti di Storage.
                  </Notice>
                )}

                <div className="grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#263238]">
                      Lencana Verifikasi (jika disetujui)
                    </label>
                    <select
                      value={badgeDrafts[app.id] ?? "grade"}
                      onChange={(e) =>
                        setBadgeDrafts((prev) => ({
                          ...prev,
                          [app.id]:
                            e.target.value === "asdos" ? "asdos" : "grade",
                        }))
                      }
                      className="min-h-10 w-full rounded-lg border border-[#CBD6DE] bg-white px-3 text-sm text-[#263238]"
                    >
                      <option value="grade">Verified Grade (Nilai A/AB)</option>
                      <option value="asdos">
                        Verified Asdos (Asisten Dosen/Lab)
                      </option>
                    </select>
                  </div>
                  <Input
                    id={`app-rej-${app.id}`}
                    label="Alasan Penolakan (jika ditolak)"
                    placeholder="Contoh: Transkrip nilai mata kuliah belum terlihat jelas"
                    value={rejectReasonDrafts[app.id] ?? ""}
                    onChange={(e) =>
                      setRejectReasonDrafts((prev) => ({
                        ...prev,
                        [app.id]: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleApproveTutor(app.id)}
                      disabled={busyKey !== null}
                      className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
                    >
                      {busyKey === `approve-tutor-${app.id}`
                        ? "Menyetujui..."
                        : "Setujui & Publikasikan Tutor"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRejectTutor(app.id)}
                      disabled={busyKey !== null}
                    >
                      {busyKey === `reject-tutor-${app.id}`
                        ? "Menolak..."
                        : "Tolak Pengajuan"}
                    </Button>
                  </div>
                  <span className="text-[11px] text-[#5B686D]">
                    Privasi Bab 4.8: Berkas bukti otomatis dihapus dari Storage
                    setelah keputusan.
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {/* TAB 3: Static QRIS Configuration */}
      {activeTab === "qris" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
            <div>
              <Badge variant="outline">1 Foto QRIS untuk Semua Transaksi</Badge>
              <h2 className="mt-1.5 text-lg font-semibold text-[#263238]">
                Pengaturan QRIS Statis &amp; Gateway
              </h2>
              <p className="text-xs text-[#5B686D]">
                Unggah satu foto QRIS resmi tim KOLEARA di sini. Semua halaman
                checkout dan booking langsung menampilkan foto QRIS terbaru ini.
              </p>
            </div>

            <form onSubmit={handleSavePaymentConfig} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-[#263238]">
                  Mode Pembayaran Aktif
                </label>
                <select
                  value={qrisMode}
                  onChange={(e) =>
                    setQrisMode(
                      e.target.value === "midtrans" ? "midtrans" : "static_qris"
                    )
                  }
                  className="min-h-11 w-full rounded-xl border border-[#CBD6DE] bg-white px-3 text-sm text-[#263238]"
                >
                  <option value="static_qris">
                    QRIS Statis KOLEARA + Verifikasi Admin (Utama)
                  </option>
                  <option
                    value="midtrans"
                    disabled={!paymentConfig?.midtransEnabled}
                  >
                    Midtrans Snap{" "}
                    {paymentConfig?.midtransEnabled
                      ? "(Aktif)"
                      : "(Set MIDTRANS_SERVER_KEY di Convex Env terlebih dahulu)"}
                  </option>
                </select>
              </div>

              <Input
                id="qris-merchant"
                label="Nama Merchant QRIS"
                placeholder="KOLEARA ITS"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                required
              />

              <Input
                id="qris-account"
                label="Info Rekening / NMID Tambahan (Opsional)"
                placeholder="Contoh: BCA 1234567890 a.n. Bendahara KOLEARA"
                value={accountInfo}
                onChange={(e) => setAccountInfo(e.target.value)}
              />

              <Textarea
                id="qris-instructions"
                label="Instruksi Pembayaran untuk Mahasiswa"
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="qris-photo-upload"
                  className="block text-sm font-medium text-[#263238]"
                >
                  Unggah Foto QRIS Statis Tim (PNG / JPG)
                </label>
                <input
                  id="qris-photo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleQrisFileChange}
                  disabled={busyKey === "upload-qris"}
                  className="block w-full rounded-xl border border-[#CBD6DE] bg-[#F8FAFB] px-3 py-2.5 text-sm text-[#263238] file:mr-3 file:rounded-lg file:border-0 file:bg-[#285B7B] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
                {busyKey === "upload-qris" ? (
                  <p className="text-xs text-[#3979A5]">
                    Mengunggah gambar QRIS ke Convex Storage...
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={busyKey !== null}
                className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
              >
                {busyKey === "save-qris"
                  ? "Menyimpan..."
                  : "Simpan Konfigurasi QRIS"}
              </Button>
            </form>
          </Card>

          <Card className="flex flex-col items-center justify-center space-y-4 rounded-[24px] border-[#CBD6DE] bg-[#F8FAFB] p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5B686D]">
              Pratinjau QRIS yang Tampil ke Mahasiswa
            </p>
            <div className="overflow-hidden rounded-2xl border border-[#CBD6DE] bg-white p-4 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeQrisSrc}
                alt={`QRIS ${merchantName || "KOLEARA"}`}
                className="mx-auto max-h-80 w-auto rounded-lg object-contain"
              />
            </div>
            <p className="text-sm font-semibold text-[#263238]">
              {merchantName || "KOLEARA ITS"}
            </p>
            {accountInfo ? (
              <p className="text-xs text-[#5B686D]">{accountInfo}</p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* TAB 4: Payouts & Bab 6.1 Pilot Metrics */}
      {activeTab === "payouts" ? (
        <div className="space-y-6">
          {/* Ready Payout Queue */}
          <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
            <h2 className="text-lg font-semibold text-[#263238]">
              Antrean Pencairan Honor Tutor (Siap Cair)
            </h2>
            {!readyPayouts || readyPayouts.length === 0 ? (
              <p className="text-sm text-[#5B686D]">
                Semua honor sesi selesai sudah dicairkan atau belum ada sesi
                berstatus ready_for_payout.
              </p>
            ) : (
              <div className="space-y-3">
                {readyPayouts.map((item) => {
                  const uploadedProof = payoutProofs[item.tutorId];
                  return (
                    <div
                      key={item.tutorId}
                      className="space-y-3 rounded-2xl border border-[#CBD6DE] bg-[#F8FAFB] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#263238]">
                            {item.tutorName}
                          </p>
                          <p className="text-xs text-[#5B686D]">
                            {item.bookingIds.length} sesi selesai •{" "}
                            {item.payoutAccount
                              ? `${item.payoutAccount.bankOrWallet} ${item.payoutAccount.accountNumber} (a.n. ${item.payoutAccount.accountName})`
                              : "Tutor belum mengisi rekening pencairan"}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-[#166534]">
                          {formatIdr(item.totalAmount)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) =>
                            handlePayoutProofUpload(item.tutorId, e)
                          }
                          className="text-xs text-[#5B686D]"
                        />
                        {uploadedProof ? (
                          <span className="text-xs font-medium text-[#166534]">
                            ✓ {uploadedProof.fileName}
                          </span>
                        ) : null}
                        <Button
                          size="sm"
                          onClick={() =>
                            handleCreatePayout(item.tutorId, item.bookingIds)
                          }
                          disabled={busyKey !== null}
                          className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
                        >
                          {busyKey === `payout-${item.tutorId}`
                            ? "Mencatat..."
                            : "Tandai Sudah Ditransfer (Cairkan)"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Payout History */}
          {payoutHistory && payoutHistory.length > 0 ? (
            <Card className="space-y-3 rounded-[24px] border-[#CBD6DE] p-6">
              <h2 className="text-base font-semibold text-[#263238]">
                Riwayat Batch Payout Terakhir
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {payoutHistory.slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-[#E3E7E9] bg-[#F8FAFB] p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#263238]">
                        {p.tutorId} — {formatIdr(p.amount)}
                      </span>
                      <Badge variant="solid">Cair</Badge>
                    </div>
                    <p className="mt-1 text-[#5B686D]">
                      {p.bookingIds.length} sesi •{" "}
                      {p.paidOutAt ? formatWibDateTime(p.paidOutAt) : "-"}
                    </p>
                    {p.proofUrl ? (
                      <a
                        href={p.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block font-semibold text-[#3979A5] hover:underline"
                      >
                        Bukti Transfer ↗
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* Bab 6.1 Pilot Metrics */}
          {pilotMetrics ? (
            <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
              <div>
                <Badge variant="outline">Brief Bab 6.1 — Pilot Metrics</Badge>
                <h2 className="mt-1.5 text-lg font-semibold text-[#263238]">
                  Metrik Performa Pilot KOLEARA
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <MetricBox label="Total Pengguna" value={String(pilotMetrics.totalUsers)} />
                <MetricBox
                  label="Tutor Terverifikasi"
                  value={String(pilotMetrics.totalVerifiedTutors)}
                />
                <MetricBox
                  label="Total Booking"
                  value={String(pilotMetrics.totalBookings)}
                />
                <MetricBox
                  label="Sesi Selesai"
                  value={String(pilotMetrics.completedBookings)}
                />
                <MetricBox
                  label="Acceptance Rate"
                  value={`${pilotMetrics.acceptanceRatePercent}%`}
                />
                <MetricBox
                  label="Payment Completion"
                  value={`${pilotMetrics.paymentCompletionRatePercent}%`}
                />
                <MetricBox
                  label="Session Completion"
                  value={`${pilotMetrics.sessionCompletionRatePercent}%`}
                />
                <MetricBox
                  label="Median Time to Accept"
                  value={
                    pilotMetrics.medianTimeToAcceptMinutes !== null
                      ? `${pilotMetrics.medianTimeToAcceptMinutes} mnt`
                      : "-"
                  }
                />
                <MetricBox
                  label="Median Time to 1st Request"
                  value={
                    pilotMetrics.medianTimeToFirstRequestMinutes !== null
                      ? `${pilotMetrics.medianTimeToFirstRequestMinutes} mnt`
                      : "-"
                  }
                />
                <MetricBox
                  label="Avg Clarity Rating"
                  value={`${pilotMetrics.averageClarityRating}/5`}
                />
                <MetricBox
                  label="Avg Pacing Rating"
                  value={`${pilotMetrics.averagePacingRating}/5`}
                />
                <MetricBox
                  label="Total Ulasan"
                  value={String(pilotMetrics.totalReviews)}
                />
                <MetricBox
                  label="Total Revenue"
                  value={formatIdr(pilotMetrics.totalRevenueIdr)}
                />
                <MetricBox
                  label="Escrow Ditahan"
                  value={formatIdr(pilotMetrics.totalEscrowHeldIdr)}
                />
                <MetricBox
                  label="Honor Sudah Cair"
                  value={formatIdr(pilotMetrics.totalPaidOutIdr)}
                />
                <MetricBox
                  label="Dibatalkan / Expired"
                  value={`${pilotMetrics.cancelledBookings} / ${pilotMetrics.expiredBookings}`}
                />
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7E9] bg-[#F8FAFB] p-3.5">
      <p className="text-[11px] font-medium text-[#5B686D]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#263238]">{value}</p>
    </div>
  );
}
