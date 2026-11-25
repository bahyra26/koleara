import type {
  Booking,
  MeetingMode,
  Message,
  Payment,
  ServiceResult,
} from "@/lib/contracts";
import {
  createSyntheticId,
  getDemoStateSnapshot,
  updateDemoState,
} from "@/lib/mock/store";
import { validateOfferInput } from "@/lib/validators";

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
      return { ok: false, error: firstError };
    }
    const price = validation.price;
    const startAt = params.startAt;

    let result: ServiceResult<Booking> = {
      ok: false,
      error: "Percakapan tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const conversation = prev.conversations.find(
        (c) => c.id === params.conversationId
      );
      if (!conversation) return prev;

      const tutor = prev.tutors.find((t) => t.id === conversation.tutorId);
      if (!tutor || tutor.userId !== params.actorUserId) {
        result = {
          ok: false,
          error:
            "Hanya tutor pada percakapan ini yang dapat membuat tawaran sesi.",
        };
        return prev;
      }

      const course = prev.courses.find((c) => c.id === params.courseId);
      if (!course) {
        result = { ok: false, error: "Mata kuliah tidak valid." };
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

    return result;
  },

  acceptOffer(params: {
    bookingId: string;
    actorUserId: string;
  }): ServiceResult<Booking> {
    let result: ServiceResult<Booking> = {
      ok: false,
      error: "Tawaran sesi tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      if (!booking) return prev;

      if (booking.learnerId !== params.actorUserId) {
        result = {
          ok: false,
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

    return result;
  },

  declineOffer(params: {
    bookingId: string;
    actorUserId: string;
  }): ServiceResult<Booking> {
    let result: ServiceResult<Booking> = {
      ok: false,
      error: "Tawaran sesi tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      if (!booking) return prev;

      if (booking.learnerId !== params.actorUserId) {
        result = {
          ok: false,
          error:
            "Hanya mahasiswa penerima tawaran yang dapat menolak tawaran ini.",
        };
        return prev;
      }

      if (booking.status !== "offered") {
        result = {
          ok: false,
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

    return result;
  },
};
