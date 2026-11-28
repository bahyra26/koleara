import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { meetingModeValidator } from "./schema";
import {
  bookingObjectValidator,
  isValidAppId,
  MAX_BRIEF_LENGTH,
  MAX_HOURLY_RATE_IDR,
  MAX_TOPIC_LENGTH,
  serviceResultValidator,
} from "./validators";

export const getBookingById = query({
  args: {
    bookingId: v.string(),
    userId: v.optional(v.string()),
  },
  returns: v.union(bookingObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!row) return null;

    if (args.userId !== undefined) {
      const uid = args.userId.trim();
      if (!uid) return null;
      if (row.learnerId !== uid) {
        const tutor = await ctx.db
          .query("tutors")
          .withIndex("by_appId", (q) => q.eq("appId", row.tutorId))
          .first();
        if (tutor?.userId !== uid) return null;
      }
    }
    return {
      id: row.appId,
      conversationId: row.conversationId,
      learnerId: row.learnerId,
      tutorId: row.tutorId,
      courseId: row.courseId,
      topic: row.topic,
      startAt: row.startAt,
      durationMinutes: row.durationMinutes,
      price: row.price,
      meetingMode: row.meetingMode,
      brief: row.brief,
      status: row.status,
      createdAt: row.createdAt,
    };
  },
});

// shortcut: demo trusts caller-supplied actorUserId until Convex Auth is wired
export const createOffer = mutation({
  args: {
    bookingAppId: v.optional(v.string()),
    messageAppId: v.optional(v.string()),
    conversationId: v.string(),
    actorUserId: v.string(),
    courseId: v.string(),
    topic: v.string(),
    startAt: v.number(),
    price: v.number(),
    meetingMode: v.optional(meetingModeValidator),
    brief: v.optional(v.string()),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const trimmedCourseId = args.courseId.trim();
    const trimmedTopic = args.topic.trim();
    const trimmedBrief = args.brief?.trim() || undefined;

    if (!trimmedCourseId) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Pilih mata kuliah terlebih dahulu.",
      };
    }
    if (!trimmedTopic || trimmedTopic.length > MAX_TOPIC_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Topik bahasan wajib 1–${MAX_TOPIC_LENGTH} karakter.`,
      };
    }
    if (trimmedBrief && trimmedBrief.length > MAX_BRIEF_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Catatan sesi maksimal ${MAX_BRIEF_LENGTH} karakter.`,
      };
    }
    if (!Number.isFinite(args.startAt) || args.startAt <= now) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Jadwal sesi harus di waktu mendatang (WIB).",
      };
    }
    if (
      !Number.isSafeInteger(args.price) ||
      args.price <= 0 ||
      args.price > MAX_HOURLY_RATE_IDR
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Tarif sesi harus bilangan bulat Rp1–Rp10.000.000.",
      };
    }
    if (args.bookingAppId !== undefined && !isValidAppId(args.bookingAppId)) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "ID tawaran sesi tidak valid.",
      };
    }
    if (args.messageAppId !== undefined && !isValidAppId(args.messageAppId)) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "ID pesan tawaran tidak valid.",
      };
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_appId", (q) => q.eq("appId", args.conversationId))
      .first();
    if (!conversation) {
      return {
        ok: false as const,
        code: "CONVERSATION_NOT_FOUND",
        error: "Percakapan tidak ditemukan.",
      };
    }

    const [tutor, course] = await Promise.all([
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", conversation.tutorId))
        .first(),
      ctx.db
        .query("courses")
        .withIndex("by_appId", (q) => q.eq("appId", trimmedCourseId))
        .first(),
    ]);

    if (!tutor || !tutor.verified || tutor.userId !== args.actorUserId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error:
          "Hanya tutor terverifikasi pada percakapan ini yang dapat membuat tawaran sesi.",
      };
    }

    if (!course) {
      return {
        ok: false as const,
        code: "COURSE_NOT_FOUND",
        error: "Mata kuliah tidak valid.",
      };
    }

    if (!tutor.courseIds.includes(course.appId)) {
      return {
        ok: false as const,
        code: "INVALID_COURSE_FOR_TUTOR",
        error: "Tutor tidak terdaftar mengampu mata kuliah tersebut.",
      };
    }

    const bookingAppId =
      args.bookingAppId ??
      `bk-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const messageAppId =
      args.messageAppId ??
      `msg-offer-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const existingBooking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", bookingAppId))
      .first();

    if (existingBooking) {
      if (
        existingBooking.conversationId !== conversation.appId ||
        existingBooking.tutorId !== conversation.tutorId
      ) {
        return {
          ok: false as const,
          code: "CONFLICT",
          error: "ID booking sudah digunakan pada percakapan lain.",
        };
      }
      return {
        ok: true as const,
        data: {
          id: existingBooking.appId,
          conversationId: existingBooking.conversationId,
          learnerId: existingBooking.learnerId,
          tutorId: existingBooking.tutorId,
          courseId: existingBooking.courseId,
          topic: existingBooking.topic,
          startAt: existingBooking.startAt,
          durationMinutes: existingBooking.durationMinutes,
          price: existingBooking.price,
          meetingMode: existingBooking.meetingMode,
          brief: existingBooking.brief,
          status: existingBooking.status,
          createdAt: existingBooking.createdAt,
        },
      };
    }

    await ctx.db.insert("bookings", {
      appId: bookingAppId,
      conversationId: conversation.appId,
      learnerId: conversation.learnerId,
      tutorId: conversation.tutorId,
      courseId: course.appId,
      topic: trimmedTopic,
      startAt: args.startAt,
      durationMinutes: 60,
      price: args.price,
      meetingMode: args.meetingMode ?? "online",
      brief: trimmedBrief,
      status: "offered",
      createdAt: now,
    });

    await ctx.db.insert("messages", {
      appId: messageAppId,
      conversationId: conversation.appId,
      senderId: args.actorUserId,
      type: "offer",
      bookingId: bookingAppId,
      createdAt: now,
    });

    await ctx.db.patch("conversations", conversation._id, {
      lastMessageAt: now,
    });

    return {
      ok: true as const,
      data: {
        id: bookingAppId,
        conversationId: conversation.appId,
        learnerId: conversation.learnerId,
        tutorId: conversation.tutorId,
        courseId: course.appId,
        topic: trimmedTopic,
        startAt: args.startAt,
        durationMinutes: 60 as const,
        price: args.price,
        meetingMode: args.meetingMode ?? ("online" as const),
        brief: trimmedBrief,
        status: "offered" as const,
        createdAt: now,
      },
    };
  },
});

// shortcut: demo trusts caller-supplied actorUserId until Convex Auth is wired
export const createDirectBooking = mutation({
  args: {
    bookingAppId: v.optional(v.string()),
    conversationAppId: v.optional(v.string()),
    actorUserId: v.string(),
    tutorId: v.string(),
    courseId: v.string(),
    topic: v.string(),
    startAt: v.number(),
    sessionCount: v.union(v.literal(1), v.literal(4)),
    brief: v.optional(v.string()),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const trimmedCourseId = args.courseId.trim();
    const trimmedTopic = args.topic.trim();
    const trimmedBrief = args.brief?.trim() || undefined;

    if (!trimmedCourseId) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Select a course first.",
      };
    }
    if (!trimmedTopic || trimmedTopic.length > MAX_TOPIC_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Topic must be 1–${MAX_TOPIC_LENGTH} characters.`,
      };
    }
    if (trimmedBrief && trimmedBrief.length > MAX_BRIEF_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Notes must be at most ${MAX_BRIEF_LENGTH} characters.`,
      };
    }
    if (!Number.isFinite(args.startAt) || args.startAt <= now) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Session time must be in the future (WIB).",
      };
    }
    if (args.bookingAppId !== undefined && !isValidAppId(args.bookingAppId)) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Invalid booking ID.",
      };
    }
    if (
      args.conversationAppId !== undefined &&
      !isValidAppId(args.conversationAppId)
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Invalid conversation ID.",
      };
    }

    const [learner, tutor, course] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_appId", (q) => q.eq("appId", args.actorUserId))
        .first(),
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
        .first(),
      ctx.db
        .query("courses")
        .withIndex("by_appId", (q) => q.eq("appId", trimmedCourseId))
        .first(),
    ]);

    if (!learner) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error: "Sign in to continue booking.",
      };
    }
    if (!tutor || !tutor.verified) {
      return {
        ok: false as const,
        code: "TUTOR_NOT_FOUND",
        error: "Verified tutor not found.",
      };
    }
    if (tutor.userId === learner.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Switch to a learner account to book this tutor.",
      };
    }
    if (!course || !tutor.courseIds.includes(course.appId)) {
      return {
        ok: false as const,
        code: "INVALID_COURSE_FOR_TUTOR",
        error: "Selected course is not available for this tutor.",
      };
    }

    const price = tutor.hourlyRate * args.sessionCount;
    if (
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      price > MAX_HOURLY_RATE_IDR
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Session total exceeds allowed demo limit.",
      };
    }

    const bookingAppId =
      args.bookingAppId ??
      `bk-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const existingBooking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", bookingAppId))
      .first();
    if (existingBooking) {
      if (
        existingBooking.learnerId !== learner.appId ||
        existingBooking.tutorId !== tutor.appId
      ) {
        return {
          ok: false as const,
          code: "CONFLICT",
          error: "Booking ID already belongs to another session.",
        };
      }
      return {
        ok: true as const,
        data: {
          id: existingBooking.appId,
          conversationId: existingBooking.conversationId,
          learnerId: existingBooking.learnerId,
          tutorId: existingBooking.tutorId,
          courseId: existingBooking.courseId,
          topic: existingBooking.topic,
          startAt: existingBooking.startAt,
          durationMinutes: existingBooking.durationMinutes,
          price: existingBooking.price,
          meetingMode: existingBooking.meetingMode,
          brief: existingBooking.brief,
          status: existingBooking.status,
          createdAt: existingBooking.createdAt,
        },
      };
    }

    const newEnd = args.startAt + 60 * 60_000;
    const windowStart = args.startAt - 60 * 60_000;
    const tutorBookings = await ctx.db
      .query("bookings")
      .withIndex("by_tutorId_and_startAt", (q) =>
        q
          .eq("tutorId", tutor.appId)
          .gt("startAt", windowStart)
          .lt("startAt", newEnd)
      )
      .take(50);

    const reusableUnpaid = tutorBookings.find(
      (other) =>
        other.learnerId === learner.appId &&
        other.courseId === course.appId &&
        other.startAt === args.startAt &&
        other.price === price &&
        other.status === "accepted"
    );
    if (reusableUnpaid) {
      return {
        ok: true as const,
        data: {
          id: reusableUnpaid.appId,
          conversationId: reusableUnpaid.conversationId,
          learnerId: reusableUnpaid.learnerId,
          tutorId: reusableUnpaid.tutorId,
          courseId: reusableUnpaid.courseId,
          topic: reusableUnpaid.topic,
          startAt: reusableUnpaid.startAt,
          durationMinutes: reusableUnpaid.durationMinutes,
          price: reusableUnpaid.price,
          meetingMode: reusableUnpaid.meetingMode,
          brief: reusableUnpaid.brief,
          status: reusableUnpaid.status,
          createdAt: reusableUnpaid.createdAt,
        },
      };
    }

    const conflicting = tutorBookings.find((other) => {
      if (other.status !== "accepted" && other.status !== "paid") return false;
      const otherEnd = other.startAt + other.durationMinutes * 60_000;
      return args.startAt < otherEnd && other.startAt < newEnd;
    });
    if (conflicting) {
      return {
        ok: false as const,
        code: "SCHEDULE_CONFLICT",
        error: "This time slot is already booked. Pick another available slot.",
      };
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_learnerId_and_tutorId", (q) =>
        q.eq("learnerId", learner.appId).eq("tutorId", tutor.appId)
      )
      .first();

    const conversationAppId =
      conversation?.appId ??
      args.conversationAppId ??
      `conv-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    if (!conversation) {
      await ctx.db.insert("conversations", {
        appId: conversationAppId,
        learnerId: learner.appId,
        tutorId: tutor.appId,
        lastMessageAt: now,
      });
    }

    const meetingMode =
      tutor.location === "offline"
        ? ("offline_its" as const)
        : ("online" as const);

    await ctx.db.insert("bookings", {
      appId: bookingAppId,
      conversationId: conversationAppId,
      learnerId: learner.appId,
      tutorId: tutor.appId,
      courseId: course.appId,
      topic: trimmedTopic,
      startAt: args.startAt,
      durationMinutes: 60,
      price,
      meetingMode,
      brief: trimmedBrief,
      status: "accepted",
      createdAt: now,
    });

    const existingPayment = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingAppId))
      .first();
    if (!existingPayment) {
      await ctx.db.insert("payments", {
        appId: `pay-${bookingAppId}`,
        bookingId: bookingAppId,
        amount: price,
        status: "unpaid",
      });
    }

    return {
      ok: true as const,
      data: {
        id: bookingAppId,
        conversationId: conversationAppId,
        learnerId: learner.appId,
        tutorId: tutor.appId,
        courseId: course.appId,
        topic: trimmedTopic,
        startAt: args.startAt,
        durationMinutes: 60 as const,
        price,
        meetingMode,
        brief: trimmedBrief,
        status: "accepted" as const,
        createdAt: now,
      },
    };
  },
});

export const acceptOffer = mutation({
  args: {
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();

    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Tawaran sesi tidak ditemukan.",
      };
    }

    if (booking.learnerId !== args.actorUserId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error:
          "Hanya mahasiswa penerima tawaran yang dapat menerima tawaran ini.",
      };
    }

    if (booking.status === "accepted" || booking.status === "paid") {
      return {
        ok: false as const,
        code: "ALREADY_ACCEPTED",
        error: "Tawaran sesi ini sudah diterima sebelumnya.",
      };
    }

    if (booking.status === "declined") {
      return {
        ok: false as const,
        code: "ALREADY_DECLINED",
        error: "Tawaran yang sudah ditolak tidak dapat diterima.",
      };
    }

    const now = Date.now();
    if (booking.startAt <= now) {
      return {
        ok: false as const,
        code: "OFFER_EXPIRED",
        error:
          "Jadwal tawaran sesi ini sudah lewat. Minta tutor mengirim jadwal baru.",
      };
    }

    // Exact index range for overlapping 60-minute sessions: (newStart - 60m, newEnd)
    const newStart = booking.startAt;
    const newEnd = booking.startAt + booking.durationMinutes * 60_000;
    const windowStart = newStart - 60 * 60_000;

    const tutorBookings = await ctx.db
      .query("bookings")
      .withIndex("by_tutorId_and_startAt", (q) =>
        q
          .eq("tutorId", booking.tutorId)
          .gt("startAt", windowStart)
          .lt("startAt", newEnd),
      )
      .take(50);

    const conflicting = tutorBookings.find((other) => {
      if (other.appId === booking.appId) return false;
      if (other.status !== "accepted" && other.status !== "paid") return false;
      const otherEnd = other.startAt + other.durationMinutes * 60_000;
      return newStart < otherEnd && other.startAt < newEnd;
    });

    if (conflicting) {
      return {
        ok: false as const,
        code: "SCHEDULE_CONFLICT",
        error:
          "Jadwal bentrok dengan sesi tutor yang sudah diterima/dibayar di demo ini. Minta tutor mengirim jadwal lain.",
      };
    }

    await ctx.db.patch("bookings", booking._id, { status: "accepted" });

    const existingPayment = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();

    if (!existingPayment) {
      await ctx.db.insert("payments", {
        appId: `pay-${booking.appId}`,
        bookingId: booking.appId,
        amount: booking.price,
        status: "unpaid",
      });
    }

    return {
      ok: true as const,
      data: {
        id: booking.appId,
        conversationId: booking.conversationId,
        learnerId: booking.learnerId,
        tutorId: booking.tutorId,
        courseId: booking.courseId,
        topic: booking.topic,
        startAt: booking.startAt,
        durationMinutes: booking.durationMinutes,
        price: booking.price,
        meetingMode: booking.meetingMode,
        brief: booking.brief,
        status: "accepted" as const,
        createdAt: booking.createdAt,
      },
    };
  },
});

export const declineOffer = mutation({
  args: {
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();

    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Tawaran sesi tidak ditemukan.",
      };
    }

    if (booking.learnerId !== args.actorUserId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error:
          "Hanya mahasiswa penerima tawaran yang dapat menolak tawaran ini.",
      };
    }

    if (booking.status !== "offered") {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error: "Tawaran ini tidak lagi dalam status menunggu konfirmasi.",
      };
    }

    await ctx.db.patch("bookings", booking._id, { status: "declined" });

    return {
      ok: true as const,
      data: {
        id: booking.appId,
        conversationId: booking.conversationId,
        learnerId: booking.learnerId,
        tutorId: booking.tutorId,
        courseId: booking.courseId,
        topic: booking.topic,
        startAt: booking.startAt,
        durationMinutes: booking.durationMinutes,
        price: booking.price,
        meetingMode: booking.meetingMode,
        brief: booking.brief,
        status: "declined" as const,
        createdAt: booking.createdAt,
      },
    };
  },
});
