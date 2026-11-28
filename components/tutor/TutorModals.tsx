"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth } from "@/features/auth/useAuth";
import { useConversationDetail } from "@/features/chat/useChat";
import type {
  Course,
  DifficultyTier,
  PaymentConfig,
  Tutor,
} from "@/lib/contracts";
import { formatIdr, formatWibClockTime } from "@/lib/formatters";
import {
  formatCourseOptionLabel,
  formatVerificationBadge,
  isPhysicsCourse,
} from "@/lib/tutorDisplay";
import { MAX_BRIEF_LENGTH, MAX_MESSAGE_LENGTH } from "@/lib/validators";

function DialogShell({
  open,
  label,
  maxWidthClass,
  onClose,
  children,
}: {
  open: boolean;
  label: string;
  maxWidthClass: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const container = dialogRef.current;
    if (container) {
      const preferred =
        container.querySelector<HTMLElement>("[data-autofocus]") ??
        container.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
      (preferred ?? container).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClass} rounded-[28px] border border-[#4B85AD] bg-[#EAF2F7] text-[#263238] shadow-[0_24px_60px_rgba(18,45,64,0.28)] focus:outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function TutorChatModal({
  open,
  conversationId,
  activeUserId,
  tutor,
  primaryCourse,
  onClose,
}: {
  open: boolean;
  conversationId: string;
  activeUserId: string;
  tutor: Tutor;
  primaryCourse?: Course;
  onClose: () => void;
}) {
  const { messages, bookingsById, markRead, sendMessage } =
    useConversationDetail(conversationId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const physicsTheme = isPhysicsCourse(primaryCourse?.id);

  useEffect(() => {
    if (!open || !conversationId) return;
    markRead();
  }, [open, conversationId, messages.length, markRead]);

  useEffect(() => {
    if (!open) return;
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSendError(null);
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const res = await sendMessage(trimmed);
    setSending(false);
    if (!res.ok) {
      setSendError(res.error);
      return;
    }
    setDraft("");
  };

  return (
    <DialogShell
      open={open}
      label={`Chat with ${tutor.name}`}
      maxWidthClass="max-w-[780px]"
      onClose={onClose}
    >
      <div className="flex max-h-[min(88dvh,640px)] min-h-[min(76dvh,540px)] flex-col">
        <div className="px-5 pt-5 sm:px-9 sm:pt-7">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#DCE4E9] bg-[#FAF7F7] text-[#263238] transition-colors hover:bg-white"
            >
              &larr;
            </button>

            <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:gap-3.5">
              <h2 className="truncate text-[20px] font-semibold text-[#263238] sm:text-[26px]">
                {tutor.name}
              </h2>
              <span className="inline-flex items-center rounded-full bg-[#DA9A9A] px-3.5 py-1 text-[11.5px] font-medium text-white sm:px-4 sm:text-[12px]">
                Tutor | {formatVerificationBadge(tutor.badge)}
              </span>
            </div>
          </div>

          <div className="mt-4 border-b border-[#B8CAD6] sm:mt-5" />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-9 sm:py-6">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center text-center">
              <p className="max-w-sm text-[14px] leading-relaxed text-[#6C777C]">
                Ask {tutor.name} about topics, pacing, or available schedule
                before booking your session.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.senderId === activeUserId;
              const timeLabel = formatWibClockTime(msg.createdAt);
              const linkedBooking = msg.bookingId
                ? bookingsById.get(msg.bookingId)
                : undefined;
              const bodyText =
                msg.type === "offer"
                  ? `Session offer${linkedBooking ? ` · ${linkedBooking.topic} (${formatIdr(linkedBooking.price)})` : ""}`
                  : (msg.content ?? "");

              if (isOwn) {
                return (
                  <div key={msg.id} className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13.5px] font-medium text-[#263238]">
                        You
                      </span>
                      <UserAvatar tone="neutral" size="sm" />
                    </div>
                    <div className="flex max-w-full items-end justify-end gap-2 sm:max-w-[84%]">
                      <span className="shrink-0 pb-0.5 text-[11.5px] text-[#8E9BA2]">
                        {timeLabel}
                      </span>
                      <div className="rounded-[16px] rounded-tr-[4px] border border-[#285B7B] bg-[#8BB2CC] px-4 py-3 text-[14.5px] font-medium leading-relaxed text-[#1E2B33] wrap-break-word sm:px-5 sm:py-3.5 sm:text-[15.5px]">
                        {bodyText}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex flex-col items-start gap-1.5">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      tone={physicsTheme ? "rose" : "blue"}
                      size="sm"
                    />
                    <span className="text-[13.5px] font-medium text-[#263238]">
                      {tutor.name}
                    </span>
                  </div>
                  <div className="flex max-w-full items-end justify-start gap-2 sm:max-w-[84%]">
                    <div className="rounded-[16px] rounded-tl-[4px] border border-[#EFE6E6] bg-[#FAF8F8] px-4 py-3 text-[14.5px] font-medium leading-relaxed text-[#263238] wrap-break-word sm:px-5 sm:py-3.5 sm:text-[15.5px]">
                      {bodyText}
                    </div>
                    <span className="shrink-0 pb-0.5 text-[11.5px] text-[#8E9BA2]">
                      {timeLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={listEndRef} />
        </div>

        <div className="px-5 pt-1 pb-5 sm:px-9 sm:pb-7">
          {sendError ? (
            <p
              role="alert"
              className="mb-2 text-center text-[12.5px] font-medium text-[#B44343]"
            >
              {sendError}
            </p>
          ) : null}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-[18px] bg-white px-4 py-1.5 shadow-[0_2px_10px_rgba(33,82,115,0.05)] sm:px-5 sm:py-2"
          >
            <input
              data-autofocus=""
              type="text"
              maxLength={MAX_MESSAGE_LENGTH}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (sendError) setSendError(null);
              }}
              placeholder="Message your tutor..."
              aria-label="Message your tutor"
              className="min-h-11 flex-1 bg-transparent text-[14.5px] text-[#263238] placeholder:text-[#9AA4A9] focus:outline-none sm:text-[15px]"
            />
            <button
              type="submit"
              disabled={draft.trim().length === 0 || sending}
              aria-label="Send message"
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#263238] transition-colors hover:bg-[#EAF2F7] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kirim
            </button>
          </form>
        </div>
      </div>
    </DialogShell>
  );
}

export function TutorPaymentConfirmModal({
  open,
  tutor,
  primaryCourse,
  sessionCount,
  slotDisplay,
  totalPrice,
  difficultyTier,
  diagnosticNotes,
  submitting,
  error,
  onChangeDifficulty,
  onChangeDiagnosticNotes,
  onPayNow,
  onClose,
}: {
  open: boolean;
  tutor: Tutor;
  primaryCourse?: Course;
  sessionCount: 1 | 4;
  slotDisplay: string;
  totalPrice: number;
  difficultyTier: DifficultyTier;
  diagnosticNotes: string;
  submitting: boolean;
  error: string | null;
  onChangeDifficulty: (next: DifficultyTier) => void;
  onChangeDiagnosticNotes: (next: string) => void;
  onPayNow: () => void;
  onClose: () => void;
}) {
  const courseLabel = primaryCourse
    ? formatCourseOptionLabel(primaryCourse)
    : "Calculus 1";

  return (
    <DialogShell
      open={open}
      label="Confirm & Payment"
      maxWidthClass="max-w-[460px]"
      onClose={onClose}
    >
      <div className="max-h-[90dvh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="pt-1">
            <h2 className="text-[23px] font-semibold leading-tight text-[#263238] sm:text-[26px]">
              Confirm &amp; <span className="text-[#3979A5]">Payment</span>
            </h2>
            <p className="mt-1.5 text-[14px] text-[#9AA4A9]">
              Review your booking and share a short Pre-Session Brief.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment confirmation"
            className="-mt-1 -mr-2 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#263238] transition-colors hover:bg-black/6"
          >
            ✕
          </button>
        </div>

        <dl className="mt-5 rounded-[22px] bg-[#EFF5F9] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4 py-2.5 text-[14.5px]">
            <dt className="text-[#6C777C]">Tutor</dt>
            <dd className="text-right font-medium text-[#263238]">
              {tutor.name}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] py-2.5 text-[14.5px]">
            <dt className="text-[#6C777C]">Course</dt>
            <dd className="text-right font-medium text-[#263238]">
              {courseLabel}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] py-2.5 text-[14.5px]">
            <dt className="text-[#6C777C]">Package</dt>
            <dd className="text-right font-medium text-[#263238]">
              {sessionCount} session
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] py-2.5 text-[14.5px]">
            <dt className="text-[#6C777C]">First session</dt>
            <dd className="text-right font-medium text-[#263238]">
              {slotDisplay}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] pt-3 pb-1">
            <dt className="text-[14.5px] text-[#6C777C]">Total</dt>
            <dd className="text-right text-[22px] font-bold tracking-tight text-[#263238]">
              {formatIdr(totalPrice).replace(/^Rp/, "RP")}
            </dd>
          </div>
        </dl>

        {/* Pre-Session Brief (Brief v2 F6) */}
        <div className="mt-4 space-y-2.5 rounded-[18px] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="modal-difficulty"
              className="text-xs font-semibold text-[#263238]"
            >
              Pre-Session Brief (opsional)
            </label>
            <select
              id="modal-difficulty"
              value={difficultyTier}
              onChange={(e) =>
                onChangeDifficulty(e.target.value as DifficultyTier)
              }
              className="rounded-lg border border-[#CBD6DE] bg-[#F8FAFB] px-2 py-1 text-xs text-[#263238]"
            >
              <option value="basic">Konsep Dasar</option>
              <option value="intermediate">Latihan Soal</option>
              <option value="exam_prep">Persiapan Kuis / ETS</option>
            </select>
          </div>
          <textarea
            rows={2}
            maxLength={MAX_BRIEF_LENGTH}
            value={diagnosticNotes}
            onChange={(e) => onChangeDiagnosticNotes(e.target.value)}
            placeholder="Bagian konsep apa yang masih membingungkan?"
            className="w-full rounded-xl border border-[#CBD6DE] px-3 py-2 text-xs text-[#263238] placeholder:text-[#9AA4A9] focus:border-[#3979A5] focus:outline-none"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[#D98E8E] bg-[#FDF1F1] px-3.5 py-2.5 text-[13px] font-medium text-[#9F3333]"
          >
            {error}
          </p>
        ) : null}

        <button
          data-autofocus=""
          type="button"
          disabled={submitting}
          onClick={onPayNow}
          className="mt-5 inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[15px] bg-[#3979A5] px-6 text-[15.5px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#2E668D] active:translate-y-px disabled:opacity-60"
        >
          {submitting ? "Creating Booking..." : "Pay Now"}
        </button>

        <p className="mt-3.5 text-center text-[12px] leading-relaxed text-[#6C777C]">
          Payment is held safely by KOLEARA and released to the tutor only after
          the session ends.
        </p>
      </div>
    </DialogShell>
  );
}

export function TutorQrisModal({
  open,
  bookingId,
  totalPrice,
  paymentConfig,
  onBack,
  onSubmitProof,
}: {
  open: boolean;
  bookingId: string;
  totalPrice: number;
  paymentConfig: PaymentConfig | null;
  onBack: () => void;
  onSubmitProof: (args: {
    proofName: string;
    proofStorageId: Id<"_storage">;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { uploadFile } = useAuth();
  const [imgFailed, setImgFailed] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const qrisUrl = paymentConfig?.qrisImageUrl || "/qris-koleara.png";
  const merchantName = paymentConfig?.merchantName || "KOLEARA ITS";

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProofFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const handleConfirmUpload = async () => {
    if (!proofFile) {
      setError("Unggah screenshot bukti transfer QRIS terlebih dahulu.");
      return;
    }
    setError(null);
    setUploading(true);
    const uploaded = await uploadFile(proofFile);
    if (!uploaded.ok) {
      setUploading(false);
      setError(uploaded.error);
      return;
    }
    const res = await onSubmitProof({
      proofName: uploaded.data.fileName,
      proofStorageId: uploaded.data.storageId,
    });
    setUploading(false);
    if (!res.ok) {
      setError(res.error ?? "Gagal mengirim bukti pembayaran.");
    }
  };

  return (
    <DialogShell
      open={open}
      label="Scan to Pay"
      maxWidthClass="max-w-[450px]"
      onClose={onBack}
    >
      <div className="max-h-[90dvh] overflow-y-auto p-6 text-center sm:p-8">
        <h2 className="text-[22px] font-semibold text-[#263238] sm:text-[24px]">
          Scan to Pay — {merchantName}
        </h2>

        <div className="mx-auto mt-4 flex aspect-square w-full max-w-[250px] items-center justify-center overflow-hidden rounded-[24px] border border-[#5B8FB3] bg-white p-3">
          {!imgFailed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrisUrl}
              alt={`QRIS ${merchantName}`}
              onError={() => setImgFailed(true)}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="p-3 text-xs text-[#5B686D]">
              Gambar QRIS belum diunggah di <strong>/admin</strong> atau{" "}
              <code>public/qris-koleara.png</code>.
            </div>
          )}
        </div>

        <p className="mt-4 text-[28px] font-bold tracking-tight text-[#263238]">
          {formatIdr(totalPrice)}
        </p>

        <p className="mx-auto mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-[#5C6970]">
          Scan menggunakan e-wallet/m-banking dengan nominal tepat, lalu unggah
          bukti transfer di bawah (Booking:{" "}
          <span className="font-mono">{bookingId}</span>).
        </p>

        <div className="mt-4 rounded-2xl bg-white p-3.5 text-left">
          <label
            htmlFor="modal-qris-proof"
            className="block text-xs font-semibold text-[#263238]"
          >
            Unggah Bukti Transfer (JPG/PNG/PDF)
          </label>
          <input
            id="modal-qris-proof"
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="mt-2 block w-full text-xs text-[#263238]"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-[#D98E8E] bg-[#FDF1F1] px-3 py-2 text-xs font-medium text-[#9F3333]"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 space-y-2.5">
          <button
            data-autofocus=""
            type="button"
            disabled={!proofFile || uploading}
            onClick={handleConfirmUpload}
            className="inline-flex min-h-[50px] w-full cursor-pointer items-center justify-center rounded-[15px] bg-[#3979A5] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#2E668D] disabled:opacity-50"
          >
            {uploading ? "Mengunggah Bukti..." : "Saya Sudah Bayar & Kirim Bukti"}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center rounded-[15px] border border-[#5B8FB3] bg-[#F6FAFC] px-6 text-[14px] font-semibold text-[#263238] hover:bg-white"
          >
            Back
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

export function TutorPaymentSuccessModal({
  open,
  onViewBooking,
  onBack,
}: {
  open: boolean;
  onViewBooking: () => void;
  onBack: () => void;
}) {
  return (
    <DialogShell
      open={open}
      label="Payment Proof Submitted"
      maxWidthClass="max-w-[432px]"
      onClose={onBack}
    >
      <div className="max-h-[90dvh] overflow-y-auto px-6 py-8 text-center sm:px-9 sm:py-10">
        <div
          aria-hidden="true"
          className="mx-auto flex h-[116px] w-[116px] items-center justify-center rounded-full border border-[#E3B4B4]"
        >
          <div className="flex h-[98px] w-[98px] items-center justify-center rounded-full bg-[#E3A3A3]">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#C47A7A]">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="mt-6 text-[24px] font-bold text-[#263238] sm:text-[26px]">
          Bukti Pembayaran Terkirim!
        </h2>

        <p className="mx-auto mt-3 max-w-[310px] text-[14px] leading-relaxed text-[#6C777C]">
          Admin KOLEARA sedang memverifikasi bukti QRIS Anda. Status sesi akan
          otomatis terkonfirmasi setelah diverifikasi.
        </p>

        <div className="mt-7 space-y-3.5">
          <button
            data-autofocus=""
            type="button"
            onClick={onViewBooking}
            className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[15px] bg-[#3979A5] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#2E668D]"
          >
            View My Booking
          </button>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[15px] border border-[#5B8FB3] bg-[#F6FAFC] px-6 text-[15px] font-semibold text-[#263238] hover:bg-white"
          >
            Back
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
