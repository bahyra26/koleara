import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { meetingModeValidator } from "./schema";
import { bookingObjectValidator, serviceResultValidator } from "./validators";

export const getBookingById = query({
  args: { bookingId: v.string() },
  returns: v.union(bookingObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .unique();
    if (!row) return null;
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
    if (!args.courseId.trim()) {
      return {
        ok: false as const,
        error: "Pilih mata kuliah terlebih dahulu.",
      };
    }
    if (!args.topic.trim()) {
      return { ok: false as const, error: "Topik bahasan wajib diisi." };
    }
    if (!Number.isFinite(args.startAt) || args.startAt <= now) {
      return {
        ok: false as const,
        error: "Jadwal sesi harus di waktu mendatang (WIB).",
      };
    }
    if (!Number.isSafeInteger(args.price) || args.price <= 0) {
      return {
        ok: false as const,
        error: "Tarif sesi harus lebih dari Rp0.",
      };
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_appId", (q) => q.eq("appId", args.conversationId))
      .unique();
    if (!conversation) {
      return { ok: false as const, error: "Percakapan tidak ditemukan." };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", conversation.tutorId))
      .unique();
    if (!tutor || tutor.userId !== args.actorUserId) {
      return {
        ok: false as const,
        error:
          "Hanya tutor pada percakapan ini yang dapat membuat tawaran sesi.",
      };
    }

    const course = await ctx.db
      .query("courses")
      .withIndex("by_appId", (q) => q.eq("appId", args.courseId))
      .unique();
    if (!course) {
      return { ok: false as const, error: "Mata kuliah tidak valid." };
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
      .unique();

    if (!existingBooking) {
      await ctx.db.insert("bookings", {
        appId: bookingAppId,
        conversationId: conversation.appId,
        learnerId: conversation.learnerId,
        tutorId: conversation.tutorId,
        courseId: course.appId,
        topic: args.topic.trim(),
        startAt: args.startAt,
        durationMinutes: 60,
        price: args.price,
        meetingMode: args.meetingMode ?? "online",
        brief: args.brief?.trim() || undefined,
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
    }

    return {
      ok: true as const,
      data: {
        id: bookingAppId,
        conversationId: conversation.appId,
        learnerId: conversation.learnerId,
        tutorId: conversation.tutorId,
        courseId: course.appId,
        topic: args.topic.trim(),
        startAt: args.startAt,
        durationMinutes: 60 as const,
        price: args.price,
        meetingMode: args.meetingMode ?? ("online" as const),
        brief: args.brief?.trim() || undefined,
        status: "offered" as const,
        createdAt: existingBooking ? existingBooking.createdAt : now,
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
      .unique();

    if (!booking) {
      return { ok: false as const, error: "Tawaran sesi tidak ditemukan." };
    }

    if (booking.learnerId !== args.actorUserId) {
      return {
        ok: false as const,
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

    // ACID Transaction anti-double-booking check across tutor's bookings
    const tutorBookings = await ctx.db
      .query("bookings")
      .withIndex("by_tutorId_and_startAt", (q) =>
        q.eq("tutorId", booking.tutorId),
      )
      .take(200);

    const newStart = booking.startAt;
    const newEnd = booking.startAt + booking.durationMinutes * 60_000;
    const conflicting = tutorBookings.find((other) => {
      if (other.appId === booking.appId) return false;
      if (other.status !== "accepted" && other.status !== "paid") return false;
      const otherStart = other.startAt;
      const otherEnd = other.startAt + other.durationMinutes * 60_000;
      return newStart < otherEnd && otherStart < newEnd;
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
      .unique();

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
      .unique();

    if (!booking) {
      return { ok: false as const, error: "Tawaran sesi tidak ditemukan." };
    }

    if (booking.learnerId !== args.actorUserId) {
      return {
        ok: false as const,
        error:
          "Hanya mahasiswa penerima tawaran yang dapat menolak tawaran ini.",
      };
    }

    if (booking.status !== "offered") {
      return {
        ok: false as const,
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
