"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  TutorChatModal,
  TutorPaymentConfirmModal,
  TutorPaymentSuccessModal,
  TutorQrisModal,
} from "@/components/tutor/TutorModals";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth } from "@/features/auth/useAuth";
import { useConversations } from "@/features/chat/useChat";
import { useTutorProfile } from "@/features/tutors/useTutors";
import { formatIdr } from "@/lib/formatters";
import { bookingService, paymentService } from "@/lib/mock";
import {
  buildTutorScheduleMatrix,
  formatCoursePillLabel,
  formatDepartmentLabel,
  formatTopicLabel,
  formatVerificationBadge,
  getTutorBioSegments,
  isPhysicsCourse,
  resolvePrimaryCourse,
} from "@/lib/tutorDisplay";

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

  const [sessionCount, setSessionCount] = useState<1 | 4>(1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<
    "chat" | "payment" | "qris" | "success" | null
  >(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const firstAvailableBtnRef = useRef<HTMLButtonElement | null>(null);

  const scheduleColumns = useMemo(
    () => (tutor ? buildTutorScheduleMatrix(tutor) : []),
    [tutor]
  );

  if (!hydrated) {
    return (
      <div className="py-12 text-[15px] font-medium text-[#9AA4A9]">
        Loading tutor profile...
      </div>
    );
  }

  if (!tutor) {
    return (
      <section className="py-10">
        <div className="mx-auto max-w-lg rounded-[26px] border border-[#CBD2D6] bg-[#F8FAFB] px-6 py-12 text-center">
          <h1 className="text-[20px] font-semibold text-[#263238]">
            Tutor Profile Not Found
          </h1>
          <p className="mt-2 text-[14px] text-[#7D898F]">
            We could not find a verified tutor matching ID &ldquo;{tutorId}
            &rdquo;.
          </p>
          <Link
            href="/cari"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-[#3979A5] px-6 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#2E668D]"
          >
            Back to Find Tutor
          </Link>
        </div>
      </section>
    );
  }

  const primaryCourse = resolvePrimaryCourse(tutor, courses);
  const physicsTheme = isPhysicsCourse(primaryCourse?.id);
  const bioSegments = getTutorBioSegments(tutor);
  const totalPrice = tutor.hourlyRate * sessionCount;
  const isViewingOwnTutorAccount = Boolean(user && tutor.userId === user.id);

  const handleSelectSlot = (slotId: string) => {
    setFeedback(null);
    setSelectedSlotId((prev) => (prev === slotId ? null : slotId));
  };

  const handleSwitchToLearner = () => {
    setFeedback(null);
    if (lastLearner) {
      switchDemoRole({ targetUserId: lastLearner.id });
    } else {
      switchDemoRole("learner");
    }
  };

  const handleChatFirst = () => {
    setFeedback(null);
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/tutor/${tutor.id}`)}`);
      return;
    }
    const result = getOrCreateConversation(user.id, tutor.id);
    if (!result.ok) {
      setFeedback(result.error);
      return;
    }
    setActiveConversationId(result.data.id);
    setActiveModal("chat");
  };

  const handleBookSession = () => {
    if (!selectedSlotId) {
      setFeedback("Pick an available time slot on the left first.");
      firstAvailableBtnRef.current?.focus();
      return;
    }
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/tutor/${tutor.id}`)}`);
      return;
    }
    setFeedback(null);
    setPaymentError(null);
    setActiveModal("payment");
  };

  const handlePayNow = () => {
    if (!user || !selectedSlotId || !primaryCourse) return;
    setPaymentError(null);
    const created = bookingService.createDirectBooking({
      actorUserId: user.id,
      tutorId: tutor.id,
      courseId: primaryCourse.id,
      slotLabel: selectedSlotId,
      sessionCount,
    });
    if (!created.ok) {
      setPaymentError(created.error);
      return;
    }
    setActiveBookingId(created.data.id);
    setActiveModal("qris");
  };

  const handleQrisAutoPaid = () => {
    if (!user || !activeBookingId) return;
    const paid = paymentService.completeDemoQris({
      bookingId: activeBookingId,
      actorUserId: user.id,
    });
    if (!paid.ok) {
      setPaymentError(paid.error);
      setActiveModal("payment");
      return;
    }
    setActiveModal("success");
  };

  const selectedCell = selectedSlotId
    ? scheduleColumns
        .flatMap((col) => col.cells)
        .find((item) => item.id === selectedSlotId)
    : undefined;
  const selectedSlotDisplay = selectedCell
    ? `${selectedCell.day} ${selectedCell.displayTime}`
    : (selectedSlotId ?? "");

  const firstAvailableId = scheduleColumns
    .flatMap((col) => col.cells)
    .find((cell) => cell.available)?.id;

  return (
    <section className="koleara-enter pb-10 pt-1 sm:pt-2">
      {/* Top Back Navigation */}
      <div>
        <Link
          href="/cari"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-xl pr-3 text-[18px] font-medium text-[#263238] transition-colors hover:text-[#3979A5] sm:text-[21px]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Back</span>
        </Link>
      </div>

      {/* Hero Tutor Identity Banner */}
      <div className="relative mt-8 rounded-[28px] border border-[#3979A5] bg-[#EAF2F7] px-5 pt-4 pb-6 sm:mt-11 sm:px-9 sm:py-7 lg:px-12">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8 lg:gap-10">
          {/* Breakout Silhouette Avatar + Course Pill */}
          <div className="-mt-12 inline-flex shrink-0 flex-col items-center sm:-mt-14 lg:-mt-16">
            <div className="rounded-full border border-[#3979A5] bg-white p-1.5">
              <UserAvatar
                tone={physicsTheme ? "rose" : "blue"}
                size="xl"
              />
            </div>
            <span
              className={`relative z-10 -mt-3.5 inline-flex items-center justify-center rounded-full border border-[#3979A5] px-5 py-1 text-[12.5px] font-medium tracking-tight ${
                physicsTheme
                  ? "bg-[#E2CECE] text-[#263238]"
                  : "bg-[#8EB3CE] text-white"
              }`}
            >
              {formatCoursePillLabel(primaryCourse)}
            </span>
          </div>

          {/* Tutor Name, Department | Cohort, Verification Pill */}
          <div className="min-w-0">
            <h1 className="text-[clamp(1.5rem,3.2vw,2.125rem)] font-semibold leading-tight text-[#263238]">
              {tutor.name}
            </h1>
            <p className="mt-1.5 text-[14.5px] font-normal text-[#6C777C] sm:text-[17px]">
              {formatDepartmentLabel(tutor.department)} | Class of{" "}
              {tutor.cohort}
            </p>
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full bg-[#E8D5D5] px-4 py-1 text-[12px] font-medium text-[#263238] sm:text-[12.5px]">
                {formatVerificationBadge(tutor.badge)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Blush Info Cards + Dark Navy Booking Sidebar */}
      <div className="mt-7 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_356px] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_384px] xl:gap-7">
        {/* Left Soft-Blush Container */}
        <div className="flex flex-col justify-between gap-5 rounded-[30px] bg-[#F8EEEE] p-4 sm:p-6">
          {/* Card 1: About Tutor */}
          <article className="rounded-[22px] border border-[#C98E8E] bg-white p-5 sm:p-6">
            <h2 className="text-[18px] font-semibold text-[#263238] sm:text-[19px]">
              About <span className="text-[#3979A5]">Tutor</span>
            </h2>
            <p className="mt-3 text-[14px] font-medium leading-[1.68] text-[#6C777C] sm:text-[14.5px]">
              {bioSegments.map((seg, idx) =>
                seg.highlight ? (
                  <strong
                    key={idx}
                    className="font-semibold text-[#3979A5]"
                  >
                    {seg.text}
                  </strong>
                ) : (
                  <span key={idx}>{seg.text}</span>
                )
              )}
            </p>
          </article>

          {/* Bottom Pair: Sub Topics + Available Times */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            {/* Card 2: Sub Topics */}
            <article className="rounded-[22px] border border-[#C98E8E] bg-white p-5 sm:p-6 md:col-span-5">
              <h2 className="text-[18px] font-semibold text-[#263238] sm:text-[19px]">
                Sub <span className="text-[#3979A5]">Topics</span>
              </h2>
              <ol className="mt-4 space-y-3.5">
                {tutor.topics.slice(0, 4).map((topic, index) => (
                  <li key={topic} className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#C98E8E] bg-[#FCF6F6] text-[12px] font-semibold text-[#263238]">
                      {index + 1}
                    </span>
                    <span className="text-[13.5px] font-medium text-[#263238] sm:text-[14px]">
                      {formatTopicLabel(topic)}
                    </span>
                  </li>
                ))}
              </ol>
            </article>

            {/* Card 3: Available Times */}
            <article className="rounded-[22px] border border-[#C98E8E] bg-white p-5 sm:p-6 md:col-span-7">
              <h2 className="text-[18px] font-semibold text-[#263238] sm:text-[19px]">
                Available <span className="text-[#3979A5]">Times</span>
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3 min-[430px]:grid-cols-4 sm:gap-3.5">
                {scheduleColumns.map((col) => (
                  <div key={col.day}>
                    <p className="text-[12.5px] font-medium text-[#6C777C]">
                      {col.day}
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2.5">
                      {col.cells.map((cell) => {
                        const selected = selectedSlotId === cell.id;
                        if (!cell.available) {
                          return (
                            <button
                              key={cell.id}
                              type="button"
                              disabled
                              aria-label={`${cell.day} ${cell.time} unavailable`}
                              className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-[11px] bg-[#DCA3A3] px-2 text-[12.5px] font-medium text-white"
                            >
                              {cell.displayTime}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={cell.id}
                            ref={
                              cell.id === firstAvailableId
                                ? firstAvailableBtnRef
                                : undefined
                            }
                            type="button"
                            aria-pressed={selected}
                            aria-label={`Select ${cell.day} ${cell.time}`}
                            onClick={() => handleSelectSlot(cell.id)}
                            className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[11px] px-2 text-[12.5px] font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:translate-y-px ${
                              selected
                                ? "border-2 border-[#285B7B] bg-[#D99C9C] text-white shadow-xs"
                                : "border border-[#3979A5] bg-white text-[#1E4E70] hover:bg-[#EAF2F7]"
                            }`}
                          >
                            {cell.displayTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>

        {/* Right Dark-Navy Booking Card */}
        <aside
          aria-label="Book or message tutor"
          className="flex flex-col justify-between rounded-[30px] bg-[#215273] p-6 text-white sm:p-7"
        >
          <div>
            {/* Rate */}
            <p className="text-[28px] font-bold tracking-tight text-white sm:text-[32px]">
              {formatIdr(tutor.hourlyRate)}{" "}
              <span className="text-[18px] font-normal text-white/85 sm:text-[20px]">
                / hour
              </span>
            </p>

            {/* Session Package Buttons */}
            <div
              role="group"
              aria-label="Session package"
              className="mt-6 space-y-3.5"
            >
              {([1, 4] as const).map((count) => {
                const active = sessionCount === count;
                const price = tutor.hourlyRate * count;
                return (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSessionCount(count)}
                    className={`flex min-h-[56px] w-full cursor-pointer items-center justify-between rounded-[17px] border px-5 py-3 text-[14.5px] transition-[background-color,border-color,transform] duration-150 active:translate-y-px ${
                      active
                        ? "border-[#5C96BD] bg-[#3979A5] text-white"
                        : "border-[#7AA2BD] bg-transparent text-white/95 hover:bg-white/6"
                    }`}
                  >
                    <span className="font-normal">{count} session</span>
                    <span className="font-semibold">
                      {formatIdr(price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7">
            {/* Dynamic Status / Selection Summary Pill */}
            <div
              role="status"
              aria-live="polite"
              className="mx-auto flex min-h-11 w-full max-w-[276px] items-center justify-center rounded-[13px] bg-[#8EB0C6] px-4 py-2 text-center text-[11.5px]"
            >
              {selectedSlotId ? (
                <p className="truncate text-[#162733]">
                  <strong className="font-semibold">{selectedSlotId}</strong>
                  <span className="mx-1.5 text-[#3B596E]">|</span>
                  <span className="font-medium text-[#3B596E]">
                    {sessionCount} session
                  </span>
                  <span className="mx-1.5 text-[#3B596E]">|</span>
                  <strong className="font-semibold">
                    {formatIdr(totalPrice)}
                  </strong>
                </p>
              ) : (
                <p className="font-medium text-[#39586E]">
                  Pick a time slot to continue.
                </p>
              )}
            </div>

            {isViewingOwnTutorAccount ? (
              <div className="mt-4 rounded-[14px] border border-white/25 bg-white/10 p-3.5 text-[12.5px] leading-relaxed text-white">
                <p>
                  You are signed in as this tutor. Switch to a learner demo
                  account to test booking or chat.
                </p>
                <button
                  type="button"
                  onClick={handleSwitchToLearner}
                  className="mt-2.5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[11px] bg-white px-4 text-[13px] font-semibold text-[#215273] transition-colors hover:bg-[#EAF2F7]"
                >
                  Switch to Demo Learner
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleBookSession}
                  className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[13px] bg-[#3979A5] px-5 py-2.5 text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#4387B6] active:translate-y-px"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
                    <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
                  </svg>
                  <span>Book Session</span>
                </button>

                <button
                  type="button"
                  onClick={handleChatFirst}
                  className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[13px] border border-[#7AA2BD] bg-transparent px-5 py-2.5 text-[14px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-white/8 active:translate-y-px"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>Chat First</span>
                </button>
              </div>
            )}

            {feedback ? (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-white/12 px-3.5 py-2 text-center text-[12px] font-medium text-white"
              >
                {feedback}
              </p>
            ) : null}

            {/* Escrow Guarantee Footer */}
            <div className="mt-5 flex items-start gap-2.5 text-[11.5px] leading-relaxed text-white/80">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <p>
                Payment is released to the tutor only after the session ends.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {user && activeConversationId ? (
        <TutorChatModal
          open={activeModal === "chat"}
          conversationId={activeConversationId}
          activeUserId={user.id}
          tutor={tutor}
          primaryCourse={primaryCourse}
          onClose={() => setActiveModal(null)}
        />
      ) : null}

      <TutorPaymentConfirmModal
        open={activeModal === "payment"}
        tutor={tutor}
        primaryCourse={primaryCourse}
        sessionCount={sessionCount}
        slotDisplay={selectedSlotDisplay}
        totalPrice={totalPrice}
        error={paymentError}
        onPayNow={handlePayNow}
        onClose={() => setActiveModal(null)}
      />

      {activeBookingId ? (
        <TutorQrisModal
          open={activeModal === "qris"}
          bookingId={activeBookingId}
          totalPrice={totalPrice}
          onBack={() => setActiveModal("payment")}
          onAutoPaid={handleQrisAutoPaid}
        />
      ) : null}

      <TutorPaymentSuccessModal
        open={activeModal === "success"}
        onViewBooking={() => {
          const targetId = activeBookingId;
          setActiveModal(null);
          if (targetId) {
            router.push(`/pembayaran/${targetId}`);
          }
        }}
        onBack={() => {
          const bookedLabel = selectedSlotId;
          setActiveModal(null);
          setSelectedSlotId(null);
          if (bookedLabel) {
            setFeedback(`Session confirmed for ${bookedLabel}.`);
          }
        }}
      />
    </section>
  );
}
