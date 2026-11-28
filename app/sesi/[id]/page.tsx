"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import type { BookingStatus, DifficultyTier } from "@/lib/contracts";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";

const TIMELINE_STEPS: Array<{ key: string; label: string }> = [
  { key: "requested", label: "Diajukan" },
  { key: "accepted", label: "Diterima Tutor" },
  { key: "paid", label: "Pembayaran Lunas" },
  { key: "tutor_marked_done", label: "Sesi Selesai" },
  { key: "completed", label: "Terkonfirmasi" },
];

function getStepIndex(status: BookingStatus): number {
  switch (status) {
    case "requested":
    case "offered":
      return 0;
    case "accepted":
      return 1;
    case "paid":
      return 2;
    case "tutor_marked_done":
      return 3;
    case "completed":
      return 4;
    default:
      return -1;
  }
}

function difficultyLabel(tier?: DifficultyTier): string {
  switch (tier) {
    case "basic":
      return "Dasar (Butuh penjelasan dari awal)";
    case "intermediate":
      return "Menengah (Sudah paham dasar, macet di latihan)";
    case "exam_prep":
      return "Persiapan ETS/EAS (Bedah soal & strategi)";
    default:
      return "Standar";
  }
}

function formatWhatsappHref(wa: string, message: string): string {
  const digits = wa.replace(/\D/g, "");
  const normalized = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits.startsWith("62")
      ? digits
      : `62${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "Waktu pembayaran habis";
  const totalMinutes = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} jam ${minutes} menit tersisa`;
}

function SessionTrackerContent() {
  const params = useParams<{ id: string }>();
  const bookingId = typeof params.id === "string" ? params.id : "";
  const { user, sessionToken, hydrated } = useAuth();

  const detail = useQuery(
    api.bookings.getSessionDetail,
    bookingId && sessionToken ? { bookingId, sessionToken } : "skip"
  );

  const acceptSession = useMutation(api.bookings.acceptSession);
  const declineSession = useMutation(api.bookings.declineSession);
  const updateMeetingLink = useMutation(api.bookings.updateMeetingLink);
  const markTutorDone = useMutation(api.bookings.markTutorDone);
  const cancelSession = useMutation(api.bookings.cancelSession);
  const confirmAndReview = useMutation(api.bookings.confirmAndReviewSession);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [meetingLinkDraft, setMeetingLinkInput] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelBox, setShowCancelBox] = useState(false);

  const [clarityRating, setClarityRating] = useState<number>(5);
  const [pacingRating, setPacingRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState("");

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "neutral" | "emphasis";
    text: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const meetingLinkInput =
    meetingLinkDraft ?? detail?.booking.meetingLink ?? "";

  if (!hydrated) {
    return (
      <div className="py-12 text-center text-sm text-[#5B686D]">
        Memuat detail sesi...
      </div>
    );
  }

  if (!user || !sessionToken) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="space-y-4 rounded-[26px] border-[#CBD6DE] p-6 text-center">
          <h1 className="text-xl font-semibold text-[#263238]">
            Login Diperlukan
          </h1>
          <p className="text-sm text-[#5B686D]">
            Silakan login menggunakan email ITS Anda untuk membuka pelacak sesi
            ini.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/sesi/${bookingId}`)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#285B7B] px-6 text-sm font-semibold text-white"
          >
            Login Sekarang
          </Link>
        </Card>
      </div>
    );
  }

  if (detail === undefined) {
    return (
      <div className="py-12 text-center text-sm text-[#5B686D]">
        Memuat data sesi dari Convex...
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="space-y-4 rounded-[26px] border-[#CBD6DE] p-6 text-center">
          <h1 className="text-xl font-semibold text-[#263238]">
            Sesi Tidak Ditemukan
          </h1>
          <p className="text-sm text-[#5B686D]">
            Sesi tidak tersedia atau akun Anda tidak terdaftar sebagai peserta
            sesi ini.
          </p>
          <Link
            href="/sesi"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3979A5] px-5 text-sm font-semibold text-white"
          >
            Kembali ke Daftar Sesi
          </Link>
        </Card>
      </div>
    );
  }

  const { booking, payment, tutor, learner, course, review, tutorWhatsapp, learnerWhatsapp } =
    detail;
  const isLearner = booking.learnerId === user.id;
  const isTutor = tutor.userId === user.id;
  const stepIndex = getStepIndex(booking.status);
  const canRevealContact =
    booking.status === "paid" ||
    booking.status === "tutor_marked_done" ||
    booking.status === "completed";
  const canCancel =
    booking.status === "requested" ||
    booking.status === "offered" ||
    booking.status === "accepted" ||
    booking.status === "paid";
  const canLearnerReview =
    isLearner &&
    !review &&
    (booking.status === "paid" ||
      booking.status === "tutor_marked_done" ||
      booking.status === "completed");

  const handleAccept = async () => {
    setBusyAction("accept");
    setFeedback(null);
    const res = await acceptSession({
      bookingId: booking.id,
      sessionToken,
      meetingLink: meetingLinkInput.trim() || undefined,
    });
    setBusyAction(null);
    if (!res.ok) {
      setFeedback({ tone: "emphasis", text: res.error });
      return;
    }
    setFeedback({
      tone: "neutral",
      text: "Permintaan sesi diterima! Menunggu pembayaran dari learner.",
    });
  };

  const handleDecline = async () => {
    setBusyAction("decline");
    setFeedback(null);
    const res = await declineSession({
      bookingId: booking.id,
      sessionToken,
      declineReason: declineReason.trim() || undefined,
    });
    setBusyAction(null);
    if (!res.ok) {
      setFeedback({ tone: "emphasis", text: res.error });
      return;
    }
    setFeedback({ tone: "neutral", text: "Permintaan sesi telah ditolak." });
  };

  const handleSaveMeetingLink = async (e: FormEvent) => {
    e.preventDefault();
    setBusyAction("link");
    setFeedback(null);
    const res = await updateMeetingLink({
      bookingId: booking.id,
      sessionToken,
      meetingLink: meetingLinkInput.trim(),
    });
    setBusyAction(null);
    if (!res.ok) {
      setFeedback({ tone: "emphasis", text: res.error });
      return;
    }
    setFeedback({
      tone: "neutral",
      text: "Link meeting / lokasi temu berhasil diperbarui.",
    });
  };

  const handleMarkDone = async () => {
    setBusyAction("done");
    setFeedback(null);
    const res = await markTutorDone({
      bookingId: booking.id,
      sessionToken,
    });
    setBusyAction(null);
    if (!res.ok) {
      setFeedback({ tone: "emphasis", text: res.error });
      return;
    }
    setFeedback({
      tone: "neutral",
      text: "Sesi ditandai selesai. Jika learner tidak merespons dalam 24 jam, sesi akan otomatis selesai dan honor siap dicairkan.",
    });
  };

  const handleCancel = async () => {
    setBusyAction("cancel");
    setFeedback(null);
    const res = await cancelSession({
      bookingId: booking.id,
      sessionToken,
      reason: cancelReason.trim() || undefined,
    });
    setBusyAction(null);
    if (!res.ok) {
      setFeedback({ tone: "emphasis", text: res.error });
      return;
    }
    setShowCancelBox(false);
    setFeedback({
      tone: "neutral",
      text: `Sesi dibatalkan. ${res.data.refundReason}`,
    });
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    setBusyAction("review");
    setFeedback(null);
    const res = await confirmAndReview({
      bookingId: booking.id,
      sessionToken,
      clarityRating,
      pacingRating,
      reviewText: reviewText.trim() || undefined,
    });
    setBusyAction(null);
    if (!res.ok) {
      setFeedback({ tone: "emphasis", text: res.error });
      return;
    }
    setFeedback({
      tone: "neutral",
      text: "Terima kasih! Sesi terkonfirmasi selesai, ulasan dipublikasikan, dan honor tutor siap dicairkan.",
    });
  };

  return (
    <section className="space-y-6 pb-12 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/sesi"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#285B7B] hover:underline"
        >
          ← Kembali ke Sesi Saya
        </Link>
        {booking.conversationId ? (
          <Link
            href={`/chat/${booking.conversationId}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#CBD6DE] bg-white px-4 text-xs font-semibold text-[#285B7B] hover:bg-[#EAF2F7]"
          >
            Buka Chat dengan {isLearner ? tutor.name : learner.name}
          </Link>
        ) : null}
      </div>

      {feedback ? (
        <Notice tone={feedback.tone} role="status">
          {feedback.text}
        </Notice>
      ) : null}

      {/* Header & Progress Timeline */}
      <Card className="space-y-5 rounded-[26px] border-[#CBD6DE] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="solid" className="bg-[#285B7B] border-[#285B7B]">
                {booking.status.replace(/_/g, " ").toUpperCase()}
              </Badge>
              <Badge variant="outline">
                Escrow: {booking.escrowStatus ?? "none"}
              </Badge>
              <span className="font-mono text-xs text-[#5B686D]">
                {booking.id}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-[#263238] sm:text-2xl">
              {course.name} — {booking.topic}
            </h1>
            <p className="text-sm text-[#5B686D]">
              Jadwal: <strong>{formatWibDateTime(booking.startAt)}</strong> •{" "}
              {booking.sessionCount ?? 1} sesi × {booking.durationMinutes} menit •{" "}
              <strong>{formatIdr(booking.price)}</strong>
            </p>
          </div>
        </div>

        {stepIndex >= 0 ? (
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TIMELINE_STEPS.map((step, idx) => {
              const reached = idx <= stepIndex;
              return (
                <li
                  key={step.key}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                    reached
                      ? "border-[#3979A5] bg-[#EAF2F7] text-[#285B7B]"
                      : "border-[#E3E7E9] bg-[#F8FAFB] text-[#8E999E]"
                  }`}
                >
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold">
                    {idx + 1}
                  </span>
                  {step.label}
                </li>
              );
            })}
          </ol>
        ) : (
          <Notice tone="neutral">
            Sesi ini berakhir dengan status <strong>{booking.status}</strong>.
            {booking.declineReason ? ` Catatan: ${booking.declineReason}` : ""}
          </Notice>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Payment CTA when accepted */}
          {booking.status === "accepted" && isLearner ? (
            <Card className="space-y-4 rounded-[24px] border-[#F59E0B] bg-[#FFFBEB] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#92400E]">
                    Selesaikan Pembayaran QRIS
                  </h2>
                  <p className="mt-1 text-sm text-[#78350F]">
                    {payment?.status === "pending_verification"
                      ? "Bukti pembayaran Anda sudah diterima dan sedang diverifikasi admin KOLEARA."
                      : payment?.status === "rejected"
                        ? `Bukti sebelumnya ditolak: ${payment.rejectionReason ?? "Silakan unggah ulang bukti transfer yang jelas."}`
                        : "Transfer sesuai nominal ke QRIS statis KOLEARA dan unggah bukti agar jadwal terkunci."}
                  </p>
                </div>
                {booking.paymentDeadlineAt ? (
                  <Badge variant="outline" className="border-[#D97706] text-[#92400E]">
                    {formatCountdown(booking.paymentDeadlineAt, nowMs)}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/pembayaran/${booking.id}`}>
                  <Button className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]">
                    {payment?.status === "pending_verification"
                      ? "Lihat Status Pembayaran"
                      : "Bayar Sekarang via QRIS"}
                  </Button>
                </Link>
                {booking.paymentDeadlineAt ? (
                  <span className="text-xs text-[#78350F]">
                    Batas akhir: {formatWibDateTime(booking.paymentDeadlineAt)}
                  </span>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Privacy-Gated Meeting Link & WhatsApp */}
          <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#263238]">
                Akses Pertemuan &amp; Kontak WhatsApp
              </h2>
              <Badge variant={canRevealContact ? "solid" : "muted"}>
                {canRevealContact ? "Terbuka" : "Terkunci hingga Lunas"}
              </Badge>
            </div>

            {canRevealContact ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#CBD6DE] bg-[#F8FAFB] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5B686D]">
                    {booking.meetingMode === "offline_its"
                      ? "Lokasi Pertemuan Kampus ITS"
                      : "Link Meeting Online"}
                  </p>
                  {booking.meetingLink ? (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="break-all text-sm font-semibold text-[#285B7B]">
                        {booking.meetingLink}
                      </p>
                      {booking.meetingLink.startsWith("http") ? (
                        <a
                          href={booking.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center rounded-lg bg-[#3979A5] px-3.5 text-xs font-semibold text-white hover:bg-[#285B7B]"
                        >
                          Buka Link ↗
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-[#5B686D]">
                      Tutor belum mengisi link meeting / lokasi temu. Anda dapat
                      menghubungi tutor via WhatsApp atau Chat.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {isLearner && tutorWhatsapp ? (
                    <a
                      href={formatWhatsappHref(
                        tutorWhatsapp,
                        `Halo Kak ${tutor.name}, saya ${learner.name} dari KOLEARA untuk sesi ${course.name} (${booking.topic}).`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#166534] px-5 text-sm font-semibold text-white hover:bg-[#14532D]"
                    >
                      Hubungi Tutor via WhatsApp ({tutorWhatsapp})
                    </a>
                  ) : null}

                  {isTutor && learnerWhatsapp ? (
                    <a
                      href={formatWhatsappHref(
                        learnerWhatsapp,
                        `Halo ${learner.name}, saya ${tutor.name} (Tutor KOLEARA) untuk sesi ${course.name} (${booking.topic}).`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#166534] px-5 text-sm font-semibold text-white hover:bg-[#14532D]"
                    >
                      Hubungi Learner via WhatsApp ({learnerWhatsapp})
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <Notice tone="neutral">
                Demi privasi (Kebijakan KOLEARA), nomor WhatsApp dan link
                meeting hanya dibuka otomatis setelah pembayaran diverifikasi
                lunas.
              </Notice>
            )}

            {/* Tutor can set or update meeting link */}
            {isTutor &&
            (booking.status === "accepted" || booking.status === "paid") ? (
              <form
                onSubmit={handleSaveMeetingLink}
                className="space-y-3 border-t border-neutral-200 pt-4"
              >
                <Input
                  id="session-meeting-link"
                  label="Atur Link Google Meet / Zoom atau Lokasi Kampus ITS"
                  placeholder="https://meet.google.com/xxx-yyyy-zzz atau Perpustakaan ITS Lt. 2"
                  value={meetingLinkInput}
                  onChange={(e) => setMeetingLinkInput(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={busyAction === "link"}
                >
                  {busyAction === "link"
                    ? "Menyimpan..."
                    : "Simpan Link / Lokasi"}
                </Button>
              </form>
            ) : null}
          </Card>

          {/* Tutor Request Controls */}
          {isTutor && booking.status === "requested" ? (
            <Card className="space-y-4 rounded-[24px] border-[#3979A5] bg-[#F5FAFD] p-6">
              <h2 className="text-lg font-semibold text-[#263238]">
                Keputusan Tutor
              </h2>
              <Input
                id="accept-meeting-link"
                label="Link Meeting / Lokasi Awal (Opsional)"
                placeholder="https://meet.google.com/..."
                value={meetingLinkInput}
                onChange={(e) => setMeetingLinkInput(e.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleAccept}
                  disabled={busyAction !== null}
                  className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
                >
                  {busyAction === "accept"
                    ? "Memproses..."
                    : "Terima Permintaan Sesi"}
                </Button>
              </div>
              <div className="space-y-2 border-t border-[#D3E3EE] pt-4">
                <Input
                  id="decline-reason"
                  label="Alasan Penolakan (jika menolak)"
                  placeholder="Contoh: Jadwal bentrok dengan praktikum lab"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDecline}
                  disabled={busyAction !== null}
                >
                  {busyAction === "decline" ? "Menolak..." : "Tolak Permintaan"}
                </Button>
              </div>
            </Card>
          ) : null}

          {/* Tutor Mark Session Done */}
          {isTutor && booking.status === "paid" ? (
            <Card className="space-y-3 rounded-[24px] border-[#CBD6DE] p-6">
              <h2 className="text-lg font-semibold text-[#263238]">
                Sesi Sudah Selesai Dilaksanakan?
              </h2>
              <p className="text-sm text-[#5B686D]">
                Tandai sesi selesai setelah pembelajaran berakhir. Learner akan
                diminta mengonfirmasi &amp; memberi ulasan; jika tidak merespons
                dalam 24 jam, sesi otomatis selesai dan honor masuk antrean
                pencairan.
              </p>
              <Button
                onClick={handleMarkDone}
                disabled={busyAction !== null}
                className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
              >
                {busyAction === "done"
                  ? "Menyimpan..."
                  : "Tandai Sesi Selesai"}
              </Button>
            </Card>
          ) : null}

          {/* Learner Confirm & Review Form (Brief F10) */}
          {canLearnerReview ? (
            <Card className="space-y-4 rounded-[24px] border-[#3979A5] bg-white p-6">
              <div>
                <Badge variant="outline" className="border-[#3979A5] text-[#285B7B]">
                  Konfirmasi &amp; Ulasan 1 Langkah
                </Badge>
                <h2 className="mt-2 text-lg font-semibold text-[#263238]">
                  Konfirmasi Sesi Selesai &amp; Nilai Tutor
                </h2>
                <p className="text-sm text-[#5B686D]">
                  Mengonfirmasi penyelesaian sesi akan membuka pencairan honor
                  escrow untuk {tutor.name}.
                </p>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#263238]">
                      Kejelasan Konsep (1–5)
                    </p>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setClarityRating(star)}
                          className={`h-10 w-10 cursor-pointer rounded-xl border text-sm font-semibold transition-colors ${
                            star <= clarityRating
                              ? "border-[#285B7B] bg-[#285B7B] text-white"
                              : "border-[#CBD6DE] bg-white text-[#5B686D]"
                          }`}
                        >
                          {star}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#263238]">
                      Ritme &amp; Kenyamanan Belajar (1–5)
                    </p>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setPacingRating(star)}
                          className={`h-10 w-10 cursor-pointer rounded-xl border text-sm font-semibold transition-colors ${
                            star <= pacingRating
                              ? "border-[#3979A5] bg-[#3979A5] text-white"
                              : "border-[#CBD6DE] bg-white text-[#5B686D]"
                          }`}
                        >
                          {star}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Textarea
                  id="session-review-text"
                  label="Ulasan Singkat (Opsional)"
                  placeholder="Apa yang paling membantu dari penjelasan tutor hari ini?"
                  rows={3}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />

                <Button
                  type="submit"
                  disabled={busyAction !== null}
                  className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
                >
                  {busyAction === "review"
                    ? "Mengirim Konfirmasi..."
                    : "Konfirmasi Selesai & Kirim Ulasan"}
                </Button>
              </form>
            </Card>
          ) : null}

          {/* Submitted Review Display */}
          {review ? (
            <Card className="space-y-2 rounded-[24px] border-[#CBD6DE] bg-[#F8FAFB] p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#263238]">
                  Ulasan Sesi Terkirim
                </h2>
                <span className="text-xs font-semibold text-[#285B7B]">
                  Kejelasan {review.clarityRating}/5 • Ritme {review.pacingRating}/5
                </span>
              </div>
              {review.reviewText ? (
                <p className="text-sm text-[#5B686D]">
                  &ldquo;{review.reviewText}&rdquo;
                </p>
              ) : (
                <p className="text-xs text-[#5B686D]">
                  Rating tercatat tanpa komentar tambahan.
                </p>
              )}
            </Card>
          ) : null}
        </div>

        {/* Right Sidebar: Pre-Session Brief & Cancellation */}
        <aside className="space-y-6">
          <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-5">
            <h2 className="text-base font-semibold text-[#263238]">
              Pre-Session Brief
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[#5B686D]">Tutor</dt>
                <dd className="font-semibold text-[#263238]">
                  <Link href={`/tutor/${tutor.id}`} className="hover:text-[#3979A5] hover:underline">
                    {tutor.name}
                  </Link>{" "}
                  ({tutor.department})
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5B686D]">Learner</dt>
                <dd className="font-medium text-[#263238]">
                  {learner.name}
                  {learner.department ? ` (${learner.department})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5B686D]">Tingkat Kesulitan</dt>
                <dd className="font-medium text-[#263238]">
                  {difficultyLabel(booking.difficultyTier)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5B686D]">Catatan Diagnostik</dt>
                <dd className="mt-1 rounded-xl bg-[#F8FAFB] p-3 text-xs leading-relaxed text-[#263238]">
                  {booking.diagnosticNotes ??
                    booking.brief ??
                    "Tidak ada catatan tambahan."}
                </dd>
              </div>
            </dl>
          </Card>

          {canCancel ? (
            <Card className="space-y-3 rounded-[24px] border-[#E7C6C6] bg-[#FFF9F9] p-5">
              <h2 className="text-sm font-semibold text-[#7F2D2D]">
                Kebijakan Pembatalan (12 Jam)
              </h2>
              <p className="text-xs leading-relaxed text-[#6E4444]">
                Pembatalan oleh learner minimal <strong>12 jam sebelum sesi</strong>{" "}
                berhak atas refund penuh. Pembatalan mendadak (&lt;12 jam) setelah
                bayar tetap membayarkan honor ke tutor. Jika tutor yang membatalkan,
                learner selalu mendapat refund penuh.
              </p>

              {!showCancelBox ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelBox(true)}
                >
                  Batalkan Sesi Ini
                </Button>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <Input
                    id="cancel-reason"
                    label="Alasan Pembatalan"
                    placeholder="Contoh: Ada jadwal ujian susulan"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCancel}
                      disabled={busyAction === "cancel"}
                      className="bg-[#991B1B] border-[#991B1B] hover:bg-[#7F1D1D]"
                    >
                      {busyAction === "cancel"
                        ? "Membatalkan..."
                        : "Konfirmasi Batal"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCancelBox(false)}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

export default function SessionTrackerPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[#5B686D]">
          Memuat detail sesi...
        </div>
      }
    >
      <SessionTrackerContent />
    </Suspense>
  );
}
