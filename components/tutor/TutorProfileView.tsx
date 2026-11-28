"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  TutorChatModal,
  TutorPaymentConfirmModal,
  TutorPaymentSuccessModal,
  TutorQrisModal,
} from "@/components/tutor/TutorModals";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth } from "@/features/auth/useAuth";
import { useConversations } from "@/features/chat/useChat";
import { usePaymentConfig } from "@/features/payment/usePayment";
import { useTutorProfile } from "@/features/tutors/useTutors";
import type { DifficultyTier } from "@/lib/contracts";
import { formatIdr, resolveNextSlotTimestampWib } from "@/lib/formatters";
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
  const { user, sessionToken, hydrated } = useAuth();
  const { tutor, courses, reviews, busySlots, hydrated: tutorHydrated } =
    useTutorProfile(tutorId);
  const { getOrCreateConversation } = useConversations();
  const { config: paymentConfig } = usePaymentConfig();

  const createDirectBookingMutation = useMutation(
    api.bookings.createDirectBooking
  );
  const submitProofMutation = useMutation(api.payments.submitDemoProof);

  const [sessionCount, setSessionCount] = useState<1 | 4>(1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [diagnosticNotes, setDiagnosticNotes] = useState("");
  const [difficultyTier, setDifficultyTier] =
    useState<DifficultyTier>("basic");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<
    "chat" | "payment" | "qris" | "success" | null
  >(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const firstAvailableBtnRef = useRef<HTMLButtonElement | null>(null);

  const scheduleColumns = useMemo(() => {
    if (!tutor) return [];
    const base = buildTutorScheduleMatrix(tutor);
    return base.map((col) => ({
      ...col,
      cells: col.cells.map((cell) => {
        if (!cell.available) return cell;
        const startAt = resolveNextSlotTimestampWib(cell.id);
        if (!startAt) return cell;
        const endAt = startAt + 60 * 60_000;
        const isBooked = busySlots.some(
          (slot) => startAt < slot.endAt && slot.startAt < endAt
        );
        return { ...cell, available: !isBooked };
      }),
    }));
  }, [tutor, busySlots]);

  if (!hydrated || !tutorHydrated) {
    return (
      <div className="py-12 text-[15px] font-medium text-[#9AA4A9]">
        Loading verified tutor profile...
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

  const handleChatFirst = async () => {
    setFeedback(null);
    if (!user || !sessionToken) {
      router.push(`/login?next=${encodeURIComponent(`/tutor/${tutor.id}`)}`);
      return;
    }
    const result = await getOrCreateConversation(tutor.id);
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
    if (!user || !sessionToken) {
      router.push(`/login?next=${encodeURIComponent(`/tutor/${tutor.id}`)}`);
      return;
    }
    setFeedback(null);
    setPaymentError(null);
    setActiveModal("payment");
  };

  const handlePayNow = async () => {
    if (!user || !sessionToken || !selectedSlotId || !primaryCourse) return;
    setPaymentError(null);

    const startAt = resolveNextSlotTimestampWib(selectedSlotId);
    if (!startAt) {
      setPaymentError("Selected time slot is invalid.");
      return;
    }

    setSubmittingBooking(true);
    const created = await createDirectBookingMutation({
      sessionToken,
      actorUserId: user.id,
      tutorId: tutor.id,
      courseId: primaryCourse.id,
      topic: tutor.topics[0] ?? primaryCourse.topics[0] ?? primaryCourse.name,
      startAt,
      sessionCount,
      brief: diagnosticNotes.trim() || undefined,
      difficultyTier,
      diagnosticNotes: diagnosticNotes.trim() || undefined,
    });
    setSubmittingBooking(false);

    if (!created.ok) {
      setPaymentError(created.error);
      return;
    }
    setActiveBookingId(created.data.id);
    setActiveModal("qris");
  };

  const handleSubmitQrisProof = async (args: {
    proofName: string;
    proofStorageId: Id<"_storage">;
  }) => {
    if (!user || !sessionToken || !activeBookingId) {
      return { ok: false as const, error: "Sesi login tidak valid." };
    }
    const submitted = await submitProofMutation({
      sessionToken,
      bookingId: activeBookingId,
      actorUserId: user.id,
      proofName: args.proofName,
      proofStorageId: args.proofStorageId,
    });
    if (!submitted.ok) {
      return { ok: false as const, error: submitted.error };
    }
    setActiveModal("success");
    return { ok: true as const };
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
          <div className="-mt-12 inline-flex shrink-0 flex-col items-center sm:-mt-14 lg:-mt-16">
            <div className="rounded-full border border-[#3979A5] bg-white p-1.5">
              {tutor.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tutor.avatarUrl}
                  alt={tutor.name}
                  className="h-32 w-32 rounded-full object-cover sm:h-[152px] sm:w-[152px]"
                />
              ) : (
                <UserAvatar tone={physicsTheme ? "rose" : "blue"} size="xl" />
              )}
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

          <div className="min-w-0">
            <h1 className="text-[clamp(1.5rem,3.2vw,2.125rem)] font-semibold leading-tight text-[#263238]">
              {tutor.name}
            </h1>
            <p className="mt-1.5 text-[14.5px] font-normal text-[#6C777C] sm:text-[17px]">
              {formatDepartmentLabel(tutor.department)} | Class of{" "}
              {tutor.cohort}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#E8D5D5] px-4 py-1 text-[12px] font-medium text-[#263238] sm:text-[12.5px]">
                {formatVerificationBadge(tutor.badge)}
              </span>
              {tutor.languages && tutor.languages.length > 0 ? (
                <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[12px] font-medium text-[#285B7B]">
                  {tutor.languages.map((l) => l.toUpperCase()).join(" / ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div className="mt-7 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_356px] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_384px] xl:gap-7">
        {/* Left Soft-Blush Container */}
        <div className="flex flex-col justify-between gap-5 rounded-[30px] bg-[#F8EEEE] p-4 sm:p-6">
          <article className="rounded-[22px] border border-[#C98E8E] bg-white p-5 sm:p-6">
            <h2 className="text-[18px] font-semibold text-[#263238] sm:text-[19px]">
              About <span className="text-[#3979A5]">Tutor</span>
            </h2>
            <p className="mt-3 text-[14px] font-medium leading-[1.68] text-[#6C777C] sm:text-[14.5px]">
              {bioSegments.map((seg, idx) =>
                seg.highlight ? (
                  <strong key={idx} className="font-semibold text-[#3979A5]">
                    {seg.text}
                  </strong>
                ) : (
                  <span key={idx}>{seg.text}</span>
                )
              )}
            </p>
          </article>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <article className="rounded-[22px] border border-[#C98E8E] bg-white p-5 sm:p-6 md:col-span-5">
              <h2 className="text-[18px] font-semibold text-[#263238] sm:text-[19px]">
                Sub <span className="text-[#3979A5]">Topics</span>
              </h2>
              <ol className="mt-4 space-y-3.5">
                {tutor.topics.slice(0, 5).map((topic, index) => (
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
                                ? "border-2 border-[#285B7B] bg-[#3979A5] text-white shadow-xs"
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
            <p className="text-[28px] font-bold tracking-tight text-white sm:text-[32px]">
              {formatIdr(tutor.hourlyRate)}{" "}
              <span className="text-[18px] font-normal text-white/85 sm:text-[20px]">
                / hour
              </span>
            </p>

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
                    <span className="font-semibold">{formatIdr(price)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7">
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
                <p>Ini adalah profil tutor Anda sendiri.</p>
                <Link
                  href="/dashboard-tutor"
                  className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center rounded-[11px] bg-white px-4 text-[13px] font-semibold text-[#215273] transition-colors hover:bg-[#EAF2F7]"
                >
                  Buka Dashboard Tutor
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleBookSession}
                  className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[13px] bg-[#3979A5] px-5 py-2.5 text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#4387B6] active:translate-y-px"
                >
                  <span>Book Session</span>
                </button>

                <button
                  type="button"
                  onClick={handleChatFirst}
                  className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[13px] border border-[#7AA2BD] bg-transparent px-5 py-2.5 text-[14px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-white/8 active:translate-y-px"
                >
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

            <div className="mt-5 flex items-start gap-2.5 text-[11.5px] leading-relaxed text-white/80">
              <p>
                Payment is held safely by KOLEARA and released to the tutor only
                after the session is confirmed complete.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Real Learner Reviews */}
      {reviews.length > 0 ? (
        <section className="mt-8 rounded-[26px] border border-[#CBD6DE] bg-white p-6">
          <h2 className="text-[19px] font-semibold text-[#263238]">
            Student <span className="text-[#3979A5]">Reviews</span> (
            {reviews.length})
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {reviews.map((rev) => (
              <article
                key={rev.id}
                className="rounded-2xl border border-[#EAEAEA] bg-[#F8FAFB] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#263238]">
                    {rev.learnerDisplayName}
                  </p>
                  <p className="text-xs font-medium text-[#285B7B]">
                    Clarity {rev.clarityRating}/5 • Pacing {rev.pacingRating}/5
                  </p>
                </div>
                {rev.reviewText ? (
                  <p className="mt-2 text-xs leading-relaxed text-[#5B686D]">
                    &ldquo;{rev.reviewText}&rdquo;
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
        difficultyTier={difficultyTier}
        diagnosticNotes={diagnosticNotes}
        submitting={submittingBooking}
        error={paymentError}
        onChangeDifficulty={setDifficultyTier}
        onChangeDiagnosticNotes={setDiagnosticNotes}
        onPayNow={handlePayNow}
        onClose={() => setActiveModal(null)}
      />

      {activeBookingId ? (
        <TutorQrisModal
          open={activeModal === "qris"}
          bookingId={activeBookingId}
          totalPrice={totalPrice}
          paymentConfig={paymentConfig}
          onBack={() => setActiveModal("payment")}
          onSubmitProof={handleSubmitQrisProof}
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
            setFeedback(
              `Payment proof submitted for ${bookedLabel}. Admin will verify shortly.`
            );
          }
        }}
      />
    </section>
  );
}
