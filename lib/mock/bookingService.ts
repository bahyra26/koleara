import type {
  Booking,
  Conversation,
  MeetingMode,
  Message,
  Payment,
  ServiceResult,
} from "@/lib/contracts";
import { resolveNextSlotTimestampWib } from "@/lib/formatters";
import {
  createSyntheticId,
  getConvexMutationHandlers,
  getDemoStateSnapshot,
  updateDemoState,
} from "@/lib/mock/store";
import { formatTopicLabel } from "@/lib/tutorDisplay";
import { MAX_HOURLY_RATE_IDR, validateOfferInput } from "@/lib/validators";

// shortcut: demo trusts caller-supplied actorUserId; derive identity from ctx.auth in Convex
export const bookingService = {
  getById(bookingId: string): Booking | null {
    return (
      getDemoStateSnapshot().bookings.find((b) => b.id === bookingId) ?? null
    );
  },

  createOffer(params: {
    conversationId: string;
    actorUserId: string;
    courseId: string;
    topic: string;
    startAt: number | null;
    priceRaw: string | number;
    meetingMode?: MeetingMode;
    brief?: string;
  }): ServiceResult<Booking> {
    const validation = validateOfferInput({
      courseId: params.courseId,
      topic: params.topic,
      startAt: params.startAt,
      priceRaw: params.priceRaw,
      meetingMode: params.meetingMode,
      brief: params.brief,
    });

    if (!validation.valid || !validation.price || !params.startAt) {
      const firstError =
        Object.values(validation.errors)[0] ?? "Data tawaran tidak valid.";
      return { ok: false, code: "INVALID_INPUT", error: firstError };
    }
    const price = validation.price;
    const startAt = params.startAt;

    let result: ServiceResult<Booking> = {
      ok: false,
      code: "CONVERSATION_NOT_FOUND",
      error: "Percakapan tidak ditemukan.",
    };
    let createdBooking: Booking | null = null;
    let createdOfferMessageId: string | null = null;

    updateDemoState((prev) => {
      const conversation = prev.conversations.find(
        (c) => c.id === params.conversationId
      );
      if (!conversation) return prev;

      const tutor = prev.tutors.find((t) => t.id === conversation.tutorId);
      if (!tutor || !tutor.verified || tutor.userId !== params.actorUserId) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error:
            "Hanya tutor terverifikasi pada percakapan ini yang dapat membuat tawaran sesi.",
        };
        return prev;
      }

      const course = prev.courses.find((c) => c.id === params.courseId);
      if (!course) {
        result = {
          ok: false,
          code: "COURSE_NOT_FOUND",
          error: "Mata kuliah tidak valid.",
        };
        return prev;
      }

      if (!tutor.courseIds.includes(course.id)) {
        result = {
          ok: false,
          code: "INVALID_COURSE_FOR_TUTOR",
          error: "Tutor tidak terdaftar mengampu mata kuliah tersebut.",
        };
        return prev;
      }

      const now = Date.now();
      const booking: Booking = {
        id: createSyntheticId("bk"),
        conversationId: conversation.id,
        learnerId: conversation.learnerId,
        tutorId: conversation.tutorId,
        courseId: course.id,
        topic: params.topic.trim(),
        startAt,
        durationMinutes: 60,
        price,
        meetingMode: params.meetingMode ?? "online",
        brief: params.brief?.trim() || undefined,
        status: "offered",
        createdAt: now,
      };

      const offerMessage: Message = {
        id: createSyntheticId("msg-offer"),
        conversationId: conversation.id,
        senderId: params.actorUserId,
        type: "offer",
        bookingId: booking.id,
        createdAt: now,
      };

      createdBooking = booking;
      createdOfferMessageId = offerMessage.id;
      result = { ok: true, data: booking };
      return {
        ...prev,
        bookings: [...prev.bookings, booking],
        messages: [...prev.messages, offerMessage],
        conversations: prev.conversations.map((c) =>
          c.id === conversation.id ? { ...c, lastMessageAt: now } : c
        ),
      };
    });

    if (createdBooking) {
      const b: Booking = createdBooking;
      getConvexMutationHandlers()?.createOffer({
        bookingAppId: b.id,
        messageAppId: createdOfferMessageId ?? `msg-offer-${b.id}`,
        conversationId: b.conversationId,
        actorUserId: params.actorUserId,
        courseId: b.courseId,
        topic: b.topic,
        startAt: b.startAt,
        price: b.price,
        meetingMode: b.meetingMode,
        brief: b.brief,
      });
    }

    return result;
  },

  createDirectBooking(params: {
    actorUserId: string;
    tutorId: string;
    courseId: string;
    slotLabel: string;
    sessionCount: 1 | 4;
    nowMs?: number;
  }): ServiceResult<Booking> {
    if (params.sessionCount !== 1 && params.sessionCount !== 4) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "Choose either a 1-session or 4-session package.",
      };
    }

    const now = params.nowMs ?? Date.now();
    const startAt = resolveNextSlotTimestampWib(params.slotLabel, now);
    if (startAt === null) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "Select a valid available time slot first.",
      };
    }

    let result: ServiceResult<Booking> = {
      ok: false,
      code: "USER_NOT_FOUND",
      error: "Sign in to continue booking.",
    };
    let createdBooking: Booking | null = null;

    updateDemoState((prev) => {
      const learner = prev.users.find((u) => u.id === params.actorUserId);
      if (!learner) return prev;

      const tutor = prev.tutors.find((t) => t.id === params.tutorId);
      if (!tutor || !tutor.verified) {
        result = {
          ok: false,
          code: "TUTOR_NOT_FOUND",
          error: "Verified tutor not found.",
        };
        return prev;
      }

      if (tutor.userId === learner.id) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error: "Switch to a learner account to book this tutor.",
        };
        return prev;
      }

      const course = prev.courses.find((c) => c.id === params.courseId);
      if (!course || !tutor.courseIds.includes(course.id)) {
        result = {
          ok: false,
          code: "INVALID_COURSE_FOR_TUTOR",
          error: "Selected course is not available for this tutor.",
        };
        return prev;
      }

      const price = tutor.hourlyRate * params.sessionCount;
      if (
        !Number.isSafeInteger(price) ||
        price <= 0 ||
        price > MAX_HOURLY_RATE_IDR
      ) {
        result = {
          ok: false,
          code: "INVALID_INPUT",
          error: "Session total exceeds allowed demo limit.",
        };
        return prev;
      }

      const newEnd = startAt + 60 * 60_000;
      const reusableUnpaid = prev.bookings.find(
        (other) =>
          other.tutorId === tutor.id &&
          other.learnerId === learner.id &&
          other.courseId === course.id &&
          other.startAt === startAt &&
          other.price === price &&
          other.status === "accepted"
      );
      if (reusableUnpaid) {
        result = { ok: true, data: reusableUnpaid };
        return prev;
      }

      const conflicting = prev.bookings.find((other) => {
        if (other.tutorId !== tutor.id) return false;
        if (other.status !== "accepted" && other.status !== "paid") return false;
        const otherEnd = other.startAt + other.durationMinutes * 60_000;
        return startAt < otherEnd && other.startAt < newEnd;
      });
      if (conflicting) {
        result = {
          ok: false,
          code: "SCHEDULE_CONFLICT",
          error: "This time slot is already booked. Pick another available slot.",
        };
        return prev;
      }

      const existingConversation = prev.conversations.find(
        (c) => c.learnerId === learner.id && c.tutorId === tutor.id
      );
      const conversation: Conversation = existingConversation ?? {
        id: createSyntheticId("conv"),
        learnerId: learner.id,
        tutorId: tutor.id,
        lastMessageAt: now,
      };

      const rawTopic = tutor.topics[0] ?? course.topics[0] ?? course.name;
      const booking: Booking = {
        id: createSyntheticId("bk"),
        conversationId: conversation.id,
        learnerId: learner.id,
        tutorId: tutor.id,
        courseId: course.id,
        topic: formatTopicLabel(rawTopic),
        startAt,
        durationMinutes: 60,
        price,
        meetingMode: tutor.location === "offline" ? "offline_its" : "online",
        brief: `${params.sessionCount} session (${params.slotLabel.trim()} WIB)`,
        status: "accepted",
        createdAt: now,
      };

      const payment: Payment = {
        id: `pay-${booking.id}`,
        bookingId: booking.id,
        amount: price,
        status: "unpaid",
      };

      createdBooking = booking;
      result = { ok: true, data: booking };
      return {
        ...prev,
        conversations: existingConversation
          ? prev.conversations
          : [conversation, ...prev.conversations],
        bookings: [...prev.bookings, booking],
        payments: [...prev.payments, payment],
      };
    });

    if (createdBooking) {
      const b: Booking = createdBooking;
      getConvexMutationHandlers()?.createDirectBooking({
        bookingAppId: b.id,
        conversationAppId: b.conversationId,
        actorUserId: params.actorUserId,
        tutorId: b.tutorId,
        courseId: b.courseId,
        topic: b.topic,
        startAt: b.startAt,
        sessionCount: params.sessionCount,
        brief: b.brief,
      });
    }

    return result;
  },

  acceptOffer(params: {
    bookingId: string;
    actorUserId: string;
  }): ServiceResult<Booking> {
    let result: ServiceResult<Booking> = {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      error: "Tawaran sesi tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      if (!booking) return prev;

      if (booking.learnerId !== params.actorUserId) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error:
            "Hanya mahasiswa penerima tawaran yang dapat menerima tawaran ini.",
        };
        return prev;
      }

      if (booking.status === "accepted" || booking.status === "paid") {
        result = {
          ok: false,
          code: "ALREADY_ACCEPTED",
          error: "Tawaran sesi ini sudah diterima sebelumnya.",
        };
        return prev;
      }

      if (booking.status === "declined") {
        result = {
          ok: false,
          code: "ALREADY_DECLINED",
          error: "Tawaran yang sudah ditolak tidak dapat diterima.",
        };
        return prev;
      }

      if (booking.startAt <= Date.now()) {
        result = {
          ok: false,
          code: "OFFER_EXPIRED",
          error:
            "Jadwal tawaran sesi ini sudah lewat. Minta tutor mengirim jadwal baru.",
        };
        return prev;
      }

      const newStart = booking.startAt;
      const newEnd = booking.startAt + booking.durationMinutes * 60_000;
      const conflicting = prev.bookings.find((other) => {
        if (other.id === booking.id) return false;
        if (other.tutorId !== booking.tutorId) return false;
        if (other.status !== "accepted" && other.status !== "paid") return false;
        const otherStart = other.startAt;
        const otherEnd = other.startAt + other.durationMinutes * 60_000;
        return newStart < otherEnd && otherStart < newEnd;
      });

      if (conflicting) {
        result = {
          ok: false,
          code: "SCHEDULE_CONFLICT",
          error:
            "Jadwal bentrok dengan sesi tutor yang sudah diterima/dibayar di demo ini. Minta tutor mengirim jadwal lain.",
        };
        return prev;
      }

      const updatedBooking: Booking = { ...booking, status: "accepted" };
      const hasPayment = prev.payments.some((p) => p.bookingId === booking.id);
      const nextPayments: Payment[] = hasPayment
        ? prev.payments
        : [
            ...prev.payments,
            {
              id: `pay-${booking.id}`,
              bookingId: booking.id,
              amount: booking.price,
              status: "unpaid",
            },
          ];

      result = { ok: true, data: updatedBooking };
      return {
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === booking.id ? updatedBooking : b
        ),
        payments: nextPayments,
      };
    });

    if (result.ok) {
      getConvexMutationHandlers()?.acceptOffer({
        bookingId: params.bookingId,
        actorUserId: params.actorUserId,
      });
    }

    return result;
  },

  declineOffer(params: {
    bookingId: string;
    actorUserId: string;
  }): ServiceResult<Booking> {
    let result: ServiceResult<Booking> = {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      error: "Tawaran sesi tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      if (!booking) return prev;

      if (booking.learnerId !== params.actorUserId) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error:
            "Hanya mahasiswa penerima tawaran yang dapat menolak tawaran ini.",
        };
        return prev;
      }

      if (booking.status !== "offered") {
        result = {
          ok: false,
          code: "INVALID_STATE",
          error: "Tawaran ini tidak lagi dalam status menunggu konfirmasi.",
        };
        return prev;
      }

      const updatedBooking: Booking = { ...booking, status: "declined" };
      result = { ok: true, data: updatedBooking };
      return {
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === booking.id ? updatedBooking : b
        ),
      };
    });

    if (result.ok) {
      getConvexMutationHandlers()?.declineOffer({
        bookingId: params.bookingId,
        actorUserId: params.actorUserId,
      });
    }

    return result;
  },
};
