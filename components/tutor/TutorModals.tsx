"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useConversationDetail } from "@/features/chat/useChat";
import type { Course, Tutor } from "@/lib/contracts";
import { formatIdr, formatWibClockTime } from "@/lib/formatters";
import {
  formatCourseOptionLabel,
  formatVerificationBadge,
  isPhysicsCourse,
} from "@/lib/tutorDisplay";
import { MAX_MESSAGE_LENGTH } from "@/lib/validators";

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
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
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
    useConversationDetail(conversationId, activeUserId);
  const [draft, setDraft] = useState("");
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSendError(null);
    const trimmed = draft.trim();
    if (!trimmed) return;

    const res = sendMessage({
      conversationId,
      senderId: activeUserId,
      content: trimmed,
    });
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
        {/* Header */}
        <div className="px-5 pt-5 sm:px-9 sm:pt-7">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#DCE4E9] bg-[#FAF7F7] text-[#263238] transition-colors hover:bg-white"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m11 18-6-6 6-6" />
              </svg>
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

        {/* Messages */}
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

        {/* Composer */}
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
              disabled={draft.trim().length === 0}
              aria-label="Send message"
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#263238] transition-colors hover:bg-[#EAF2F7] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 2 11 13" />
                <path d="m22 2-7 20-4-9-9-4 20-7z" />
              </svg>
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
  error,
  onPayNow,
  onClose,
}: {
  open: boolean;
  tutor: Tutor;
  primaryCourse?: Course;
  sessionCount: 1 | 4;
  slotDisplay: string;
  totalPrice: number;
  error: string | null;
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
      maxWidthClass="max-w-[432px]"
      onClose={onClose}
    >
      <div className="max-h-[90dvh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="pt-1">
            <h2 className="text-[23px] font-semibold leading-tight text-[#263238] sm:text-[26px]">
              Confirm &amp; <span className="text-[#3979A5]">Payment</span>
            </h2>
            <p className="mt-1.5 text-[14px] text-[#9AA4A9]">
              Review your booking before paying.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment confirmation"
            className="-mt-1 -mr-2 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#263238] transition-colors hover:bg-black/6"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Summary Card */}
        <dl className="mt-5 rounded-[22px] bg-[#EFF5F9] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4 py-3 text-[14.5px] sm:text-[15px]">
            <dt className="text-[#6C777C]">Tutor</dt>
            <dd className="text-right font-medium text-[#263238]">
              {tutor.name}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] py-3 text-[14.5px] sm:text-[15px]">
            <dt className="text-[#6C777C]">Course</dt>
            <dd className="text-right font-medium text-[#263238]">
              {courseLabel}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] py-3 text-[14.5px] sm:text-[15px]">
            <dt className="text-[#6C777C]">Package</dt>
            <dd className="text-right font-medium text-[#263238]">
              {sessionCount} session
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] py-3 text-[14.5px] sm:text-[15px]">
            <dt className="text-[#6C777C]">First session</dt>
            <dd className="text-right font-medium text-[#263238]">
              {slotDisplay}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#CBD6DE] pt-3.5 pb-1">
            <dt className="text-[14.5px] text-[#6C777C] sm:text-[15px]">
              Total
            </dt>
            <dd className="text-right text-[22px] font-bold tracking-tight text-[#263238] sm:text-[24px]">
              {formatIdr(totalPrice).replace(/^Rp/, "RP")}
            </dd>
          </div>
        </dl>

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
          onClick={onPayNow}
          className="mt-6 inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[15px] bg-[#3979A5] px-6 text-[15.5px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#2E668D] active:translate-y-px"
        >
          Pay Now
        </button>

        <div className="mt-4 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[#6C777C]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4CA887"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <p>Payment is released to the tutor only after the session ends.</p>
        </div>
      </div>
    </DialogShell>
  );
}

function DemoQrCodeSvg({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const size = 25;
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const inFinder = (r: number, c: number, fr: number, fc: number) =>
      r >= fr && r < fr + 7 && c >= fc && c < fc + 7;

    const finderDark = (r: number, c: number, fr: number, fc: number) => {
      const lr = r - fr;
      const lc = c - fc;
      if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
      if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
      return false;
    };

    const rects: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        // Quiet separator around the 3 finder patterns
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= size - 8) ||
          (r >= size - 8 && c < 8)
        ) {
          if (inFinder(r, c, 0, 0) && finderDark(r, c, 0, 0)) {
            rects.push({ r, c });
          } else if (
            inFinder(r, c, 0, size - 7) &&
            finderDark(r, c, 0, size - 7)
          ) {
            rects.push({ r, c });
          } else if (
            inFinder(r, c, size - 7, 0) &&
            finderDark(r, c, size - 7, 0)
          ) {
            rects.push({ r, c });
          }
          continue;
        }

        // Bottom-right 5x5 alignment pattern at (16..20, 16..20)
        if (r >= 16 && r <= 20 && c >= 16 && c <= 20) {
          const ar = r - 16;
          const ac = c - 16;
          if (
            ar === 0 ||
            ar === 4 ||
            ac === 0 ||
            ac === 4 ||
            (ar === 2 && ac === 2)
          ) {
            rects.push({ r, c });
          }
          continue;
        }

        // Timing patterns
        if (r === 6 || c === 6) {
          if ((r + c) % 2 === 0) rects.push({ r, c });
          continue;
        }

        hash ^= (r * 31 + c * 17) & 0xff;
        hash = Math.imul(hash, 16777619);
        if ((hash >>> 3) % 11 < 5) {
          rects.push({ r, c });
        }
      }
    }
    return rects;
  }, [seed]);

  return (
    <svg
      viewBox="0 0 25 25"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Simulated demo QRIS code"
      className="h-full w-full"
    >
      <rect width="25" height="25" fill="#FFFFFF" />
      {cells.map(({ r, c }) => (
        <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000000" />
      ))}
    </svg>
  );
}

export function TutorQrisModal({
  open,
  bookingId,
  totalPrice,
  onBack,
  onAutoPaid,
}: {
  open: boolean;
  bookingId: string;
  totalPrice: number;
  onBack: () => void;
  onAutoPaid: () => void;
}) {
  if (!open) return null;

  return (
    <DialogShell
      open={open}
      label="Scan to Pay"
      maxWidthClass="max-w-[432px]"
      onClose={onBack}
    >
      <QrisCountdownContent
        key={bookingId}
        bookingId={bookingId}
        totalPrice={totalPrice}
        onBack={onBack}
        onAutoPaid={onAutoPaid}
      />
    </DialogShell>
  );
}

function QrisCountdownContent({
  bookingId,
  totalPrice,
  onBack,
  onAutoPaid,
}: {
  bookingId: string;
  totalPrice: number;
  onBack: () => void;
  onAutoPaid: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(565);
  const onAutoPaidRef = useRef(onAutoPaid);

  useEffect(() => {
    onAutoPaidRef.current = onAutoPaid;
  });

  useEffect(() => {
    const tickId = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const autoAdvanceId = window.setTimeout(() => {
      onAutoPaidRef.current();
    }, 4500);

    return () => {
      window.clearInterval(tickId);
      window.clearTimeout(autoAdvanceId);
    };
  }, [bookingId]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="max-h-[90dvh] overflow-y-auto p-6 text-center sm:p-8">
      <h2 className="text-[22px] font-semibold text-[#263238] sm:text-[24px]">
        Scan to Pay
      </h2>

      <div className="mx-auto mt-5 flex aspect-square w-full max-w-[244px] items-center justify-center rounded-[24px] border border-[#5B8FB3] bg-white p-5 sm:p-6">
        <DemoQrCodeSvg seed={bookingId} />
      </div>

      <p className="mt-5 text-[28px] font-bold tracking-tight text-[#263238] sm:text-[32px]">
        {formatIdr(totalPrice)}
      </p>

      <p className="mx-auto mt-2.5 max-w-[320px] text-[13.5px] leading-relaxed text-[#5C6970] sm:text-[14.5px]">
        Open any e-wallet or mobile banking app and scan the code
      </p>

      <p
        aria-live="off"
        className="mt-3.5 text-[14px] text-[#5C6970] sm:text-[14.5px]"
      >
        Pay within{" "}
        <strong className="font-bold text-[#263238]">
          {minutes}:{seconds}
        </strong>
      </p>

      <button
        data-autofocus=""
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[15px] bg-[#3979A5] px-6 text-[15.5px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#2E668D] active:translate-y-px"
      >
        Back
      </button>
    </div>
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
      label="Payment Successful"
      maxWidthClass="max-w-[432px]"
      onClose={onBack}
    >
      <div className="max-h-[90dvh] overflow-y-auto px-6 py-8 text-center sm:px-9 sm:py-10">
        {/* Double-ring dusty-rose checkmark */}
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

        <h2 className="mt-6 text-[24px] font-bold text-[#263238] sm:text-[28px]">
          Payment Successful!
        </h2>

        <p className="mx-auto mt-3 max-w-[310px] text-[14.5px] leading-relaxed text-[#6C777C] sm:text-[16px]">
          Yay! Your payment has been received. Your learning session is now
          confirmed.
        </p>

        <div className="mt-7 space-y-3.5">
          <button
            data-autofocus=""
            type="button"
            onClick={onViewBooking}
            className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[15px] bg-[#3979A5] px-6 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#2E668D] active:translate-y-px"
          >
            View My Booking
          </button>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[15px] border border-[#5B8FB3] bg-[#F6FAFC] px-6 text-[15px] font-semibold text-[#263238] transition-colors hover:bg-white"
          >
            Back
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
