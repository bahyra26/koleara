import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import {
  canRevealSensitiveContact,
  isAdminRequestAuthorized,
  mapTutorDoc,
  mapUserDoc,
  resolveActorUser,
} from "./lib/auth";
import {
  difficultyTierValidator,
  meetingModeValidator,
} from "./schema";
import {
  bookingObjectValidator,
  courseObjectValidator,
  evaluateCancellationRefund,
  isValidAppId,
  MAX_BRIEF_LENGTH,
  MAX_HOURLY_RATE_IDR,
  MAX_TOPIC_LENGTH,
  paymentObjectValidator,
  serviceResultValidator,
  sessionReviewObjectValidator,
  tutorObjectValidator,
  userObjectValidator,
} from "./validators";
import {
  AUTO_COMPLETE_AFTER_TUTOR_DONE_MS,
  computePaymentDeadline,
} from "../lib/validators";

const ACTIVE_LOCK_STATUSES = new Set([
  "accepted",
  "paid",
  "tutor_marked_done",
  "completed",
]);

function mapBookingDoc(
  row: Doc<"bookings">,
  options?: { revealMeetingLink?: boolean },
) {
  const reveal =
    Boolean(options?.revealMeetingLink) &&
    canRevealSensitiveContact(row.status);
  return {
    id: row.appId,
    conversationId: row.conversationId,
    learnerId: row.learnerId,
    tutorId: row.tutorId,
    courseId: row.courseId,
    topic: row.topic,
    startAt: row.startAt,
    durationMinutes: row.durationMinutes,
    sessionCount: row.sessionCount,
    price: row.price,
    meetingMode: row.meetingMode,
    brief: row.brief,
    difficultyTier: row.difficultyTier,
    diagnosticNotes: row.diagnosticNotes,
    agreedNoJoki: row.agreedNoJoki,
    meetingLink: reveal ? row.meetingLink : undefined,
    status: row.status,
    escrowStatus: row.escrowStatus,
    declineReason: row.declineReason,
    paymentDeadlineAt: row.paymentDeadlineAt,
    acceptedAt: row.acceptedAt,
    paidAt: row.paidAt,
    tutorMarkedDoneAt: row.tutorMarkedDoneAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    createdAt: row.createdAt,
  };
}

async function hasTutorScheduleConflict(
  ctx: MutationCtx,
  params: { tutorId: string; startAt: number; durationMinutes: number; excludeBookingAppId?: string },
): Promise<boolean> {
  const newStart = params.startAt;
  const newEnd = params.startAt + params.durationMinutes * 60_000;
  const windowStart = newStart - 60 * 60_000;

  const tutorBookings = await ctx.db
    .query("bookings")
    .withIndex("by_tutorId_and_startAt", (q) =>
      q
        .eq("tutorId", params.tutorId)
        .gt("startAt", windowStart)
        .lt("startAt", newEnd),
    )
    .take(50);

  return tutorBookings.some((other) => {
    if (params.excludeBookingAppId && other.appId === params.excludeBookingAppId) {
      return false;
    }
    if (!ACTIVE_LOCK_STATUSES.has(other.status)) return false;
    const otherEnd = other.startAt + other.durationMinutes * 60_000;
    return newStart < otherEnd && other.startAt < newEnd;
  });
}

export const getBookingById = query({
  args: {
    bookingId: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.union(bookingObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!row) return null;

    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });

    if (admin.authorized) {
      return mapBookingDoc(row, { revealMeetingLink: true });
    }

    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.userId,
    });

    if (args.sessionToken !== undefined || args.userId !== undefined) {
      if (!actor) return null;
      if (row.learnerId !== actor.appId) {
        const tutor = await ctx.db
          .query("tutors")
          .withIndex("by_appId", (q) => q.eq("appId", row.tutorId))
          .first();
        if (tutor?.userId !== actor.appId) return null;
      }
      return mapBookingDoc(row, { revealMeetingLink: true });
    }

    return mapBookingDoc(row, { revealMeetingLink: false });
  },
});

export const getSessionDetail = query({
  args: {
    bookingId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      booking: bookingObjectValidator,
      payment: v.union(paymentObjectValidator, v.null()),
      tutor: tutorObjectValidator,
      learner: userObjectValidator,
      course: courseObjectValidator,
      review: v.union(sessionReviewObjectValidator, v.null()),
      tutorWhatsapp: v.optional(v.string()),
      learnerWhatsapp: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) return null;

    const [tutor, learner, course, paymentRow, reviewRow] = await Promise.all([
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_appId", (q) => q.eq("appId", booking.learnerId))
        .first(),
      ctx.db
        .query("courses")
        .withIndex("by_appId", (q) => q.eq("appId", booking.courseId))
        .first(),
      ctx.db
        .query("payments")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
        .first(),
      ctx.db
        .query("sessionReviews")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
        .first(),
    ]);

    if (!tutor || !learner || !course) return null;

    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.userId,
    });

    const isParticipant = Boolean(
      actor && (booking.learnerId === actor.appId || tutor.userId === actor.appId),
    );
    if (!admin.authorized && !isParticipant) {
      return null;
    }

    const revealContact =
      admin.authorized || (isParticipant && canRevealSensitiveContact(booking.status));

    const tutorUser = revealContact
      ? await ctx.db
          .query("users")
          .withIndex("by_appId", (q) => q.eq("appId", tutor.userId))
          .first()
      : null;

    const proofUrl = paymentRow?.proofStorageId
      ? ((await ctx.storage.getUrl(paymentRow.proofStorageId)) ?? undefined)
      : undefined;

    return {
      booking: mapBookingDoc(booking, { revealMeetingLink: revealContact }),
      payment: paymentRow
        ? {
            id: paymentRow.appId,
            bookingId: paymentRow.bookingId,
            amount: paymentRow.amount,
            status: paymentRow.status,
            paymentMethod: paymentRow.paymentMethod,
            proofName: paymentRow.proofName,
            proofStorageId: paymentRow.proofStorageId,
            proofUrl,
            midtransOrderId: paymentRow.midtransOrderId,
            midtransTransactionId: paymentRow.midtransTransactionId,
            midtransSnapToken: paymentRow.midtransSnapToken,
            midtransRedirectUrl: paymentRow.midtransRedirectUrl,
            submittedAt: paymentRow.submittedAt,
            verifiedAt: paymentRow.verifiedAt,
            paidAt: paymentRow.paidAt,
            refundedAt: paymentRow.refundedAt,
            rejectionReason: paymentRow.rejectionReason,
          }
        : null,
      tutor: await mapTutorDoc(ctx, tutor),
      learner: await mapUserDoc(ctx, learner, { includePrivate: revealContact }),
      course: {
        id: course.appId,
        name: course.name,
        code: course.code,
        description: course.description,
        aliases: course.aliases,
        topics: course.topics,
      },
      review: reviewRow
        ? {
            id: reviewRow.appId,
            bookingId: reviewRow.bookingId,
            learnerId: reviewRow.learnerId,
            tutorId: reviewRow.tutorId,
            clarityRating: reviewRow.clarityRating,
            pacingRating: reviewRow.pacingRating,
            reviewText: reviewRow.reviewText,
            createdAt: reviewRow.createdAt,
          }
        : null,
      tutorWhatsapp: revealContact ? tutorUser?.whatsapp : undefined,
      learnerWhatsapp: revealContact ? learner.whatsapp : undefined,
    };
  },
});

export const listMySessions = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    roleView: v.optional(v.union(v.literal("learner"), v.literal("tutor"), v.literal("all"))),
  },
  returns: v.array(bookingObjectValidator),
  handler: async (ctx, args) => {
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.userId,
    });
    if (!actor) return [];

    const roleView = args.roleView ?? "all";
    const collected = new Map<string, Doc<"bookings">>();

    if (roleView === "learner" || roleView === "all") {
      const learnerRows = await ctx.db
        .query("bookings")
        .withIndex("by_learnerId_and_createdAt", (q) =>
          q.eq("learnerId", actor.appId),
        )
        .order("desc")
        .take(100);
      for (const row of learnerRows) {
        collected.set(row.appId, row);
      }
    }

    if (roleView === "tutor" || roleView === "all") {
      const myTutors = await ctx.db
        .query("tutors")
        .withIndex("by_userId", (q) => q.eq("userId", actor.appId))
        .take(5);
      for (const tutor of myTutors) {
        const tutorRows = await ctx.db
          .query("bookings")
          .withIndex("by_tutorId_and_startAt", (q) => q.eq("tutorId", tutor.appId))
          .order("desc")
          .take(100);
        for (const row of tutorRows) {
          collected.set(row.appId, row);
        }
      }
    }

    return Array.from(collected.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => mapBookingDoc(row, { revealMeetingLink: true }));
  },
});

export const getTutorBusySlots = query({
  args: {
    tutorId: v.string(),
    fromMs: v.number(),
    toMs: v.number(),
  },
  returns: v.array(
    v.object({
      startAt: v.number(),
      endAt: v.number(),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_tutorId_and_startAt", (q) =>
        q
          .eq("tutorId", args.tutorId)
          .gte("startAt", args.fromMs - 60 * 60_000)
          .lte("startAt", args.toMs),
      )
      .take(200);

    return rows
      .filter((row) => ACTIVE_LOCK_STATUSES.has(row.status))
      .map((row) => ({
        startAt: row.startAt,
        endAt: row.startAt + row.durationMinutes * 60_000,
        status: row.status,
      }));
  },
});

/**
 * Brief F6: Learner submits a Session Request with Pre-Session Brief.
 */
export const requestSession = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    tutorId: v.string(),
    courseId: v.string(),
    topic: v.string(),
    startAt: v.number(),
    sessionCount: v.optional(v.union(v.literal(1), v.literal(4))),
    meetingMode: v.optional(meetingModeValidator),
    difficultyTier: difficultyTierValidator,
    diagnosticNotes: v.string(),
    agreedNoJoki: v.boolean(),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; data: ReturnType<typeof mapBookingDoc> }
    | { ok: false; error: string; code?: string }
  > => {
    const now = Date.now();
    const learner = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!learner) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu untuk mengajukan sesi.",
      };
    }

    if (!args.agreedNoJoki) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Anda wajib menyetujui komitmen belajar konsep (bukan joki tugas).",
      };
    }

    const trimmedTopic = args.topic.trim();
    const trimmedNotes = args.diagnosticNotes.trim();
    if (!trimmedTopic || trimmedTopic.length > MAX_TOPIC_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Subtopik wajib 1–${MAX_TOPIC_LENGTH} karakter.`,
      };
    }
    if (trimmedNotes.length < 10 || trimmedNotes.length > MAX_BRIEF_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Pre-Session Brief wajib 10–${MAX_BRIEF_LENGTH} karakter agar tutor dapat mempersiapkan materi.`,
      };
    }
    if (!Number.isFinite(args.startAt) || args.startAt <= now) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Jadwal sesi harus di waktu mendatang (WIB).",
      };
    }

    const [tutor, course] = await Promise.all([
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
        .first(),
      ctx.db
        .query("courses")
        .withIndex("by_appId", (q) => q.eq("appId", args.courseId.trim()))
        .first(),
    ]);

    if (!tutor || !tutor.verified) {
      return {
        ok: false as const,
        code: "TUTOR_NOT_FOUND",
        error: "Tutor terverifikasi tidak ditemukan.",
      };
    }
    if (tutor.userId === learner.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Anda tidak dapat mengajukan sesi ke akun tutor Anda sendiri.",
      };
    }
    if (!course || !tutor.courseIds.includes(course.appId)) {
      return {
        ok: false as const,
        code: "INVALID_COURSE_FOR_TUTOR",
        error: "Mata kuliah tidak tersedia pada tutor ini.",
      };
    }

    const conflicted = await hasTutorScheduleConflict(ctx, {
      tutorId: tutor.appId,
      startAt: args.startAt,
      durationMinutes: 60,
    });
    if (conflicted) {
      return {
        ok: false as const,
        code: "SCHEDULE_CONFLICT",
        error: "Slot jadwal ini sudah terisi. Silakan pilih waktu lain.",
      };
    }

    const sessionCount = args.sessionCount ?? 1;
    const price = tutor.hourlyRate * sessionCount;
    if (!Number.isSafeInteger(price) || price <= 0 || price > MAX_HOURLY_RATE_IDR) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Total tarif sesi melebihi batas yang diperbolehkan.",
      };
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_learnerId_and_tutorId", (q) =>
        q.eq("learnerId", learner.appId).eq("tutorId", tutor.appId),
      )
      .first();

    const conversationAppId =
      conversation?.appId ??
      `conv-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    if (!conversation) {
      await ctx.db.insert("conversations", {
        appId: conversationAppId,
        learnerId: learner.appId,
        tutorId: tutor.appId,
        lastMessageAt: now,
      });
    }

    const bookingAppId = `bk-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const meetingMode =
      args.meetingMode ??
      (tutor.location === "offline" ? "offline_its" : "online");

    const insertedId = await ctx.db.insert("bookings", {
      appId: bookingAppId,
      conversationId: conversationAppId,
      learnerId: learner.appId,
      tutorId: tutor.appId,
      courseId: course.appId,
      topic: trimmedTopic,
      startAt: args.startAt,
      durationMinutes: 60,
      sessionCount,
      price,
      meetingMode,
      brief: trimmedNotes,
      difficultyTier: args.difficultyTier,
      diagnosticNotes: trimmedNotes,
      agreedNoJoki: true,
      status: "requested",
      escrowStatus: "none",
      createdAt: now,
    });

    const tutorUser = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", tutor.userId))
      .first();
    if (tutorUser) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendTransactionalEmail, {
        to: tutorUser.email,
        subject: `[KOLEARA] Permintaan sesi baru dari ${learner.name}`,
        html: `<p>Halo ${tutor.name},</p><p><strong>${learner.name}</strong> mengajukan sesi <strong>${course.name} — ${trimmedTopic}</strong>.</p><p>Pre-Session Brief: ${trimmedNotes}</p><p>Silakan buka Dashboard Tutor untuk menerima atau menolak permintaan ini.</p>`,
      });
    }

    const created: Doc<"bookings"> | null = await ctx.db.get("bookings", insertedId);
    return {
      ok: true as const,
      data: mapBookingDoc(created!, { revealMeetingLink: false }),
    };
  },
});

/**
 * Brief F7: Atomic Tutor Accept with anti-double-booking index check & payment deadline scheduler.
 */
export const acceptSession = mutation({
  args: {
    bookingId: v.string(),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Permintaan sesi tidak ditemukan.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
      .first();
    if (!tutor || !tutor.verified || tutor.userId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya tutor terkait yang dapat menerima permintaan sesi ini.",
      };
    }

    if (booking.status !== "requested") {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error: "Permintaan sesi ini tidak dalam status menunggu persetujuan tutor.",
      };
    }
    if (booking.startAt <= now) {
      return {
        ok: false as const,
        code: "OFFER_EXPIRED",
        error: "Jadwal sesi sudah lewat.",
      };
    }

    const conflicted = await hasTutorScheduleConflict(ctx, {
      tutorId: booking.tutorId,
      startAt: booking.startAt,
      durationMinutes: booking.durationMinutes,
      excludeBookingAppId: booking.appId,
    });
    if (conflicted) {
      return {
        ok: false as const,
        code: "SCHEDULE_CONFLICT",
        error: "Jadwal bentrok dengan sesi lain yang sudah aktif.",
      };
    }

    const paymentDeadlineAt = computePaymentDeadline(now, booking.startAt);
    const expiryJobId = await ctx.scheduler.runAt(
      paymentDeadlineAt,
      internal.bookings.expireUnpaidBooking,
      { bookingId: booking.appId },
    );

    const meetingLink = args.meetingLink?.trim() || booking.meetingLink;
    await ctx.db.patch("bookings", booking._id, {
      status: "accepted",
      acceptedAt: now,
      paymentDeadlineAt,
      paymentExpiryJobId: expiryJobId,
      ...(meetingLink ? { meetingLink } : {}),
    });

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

    const learner = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", booking.learnerId))
      .first();
    if (learner) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendTransactionalEmail, {
        to: learner.email,
        subject: `[KOLEARA] Permintaan sesi diterima oleh ${tutor.name}`,
        html: `<p>Halo ${learner.name},</p><p><strong>${tutor.name}</strong> menerima permintaan sesi <strong>${booking.topic}</strong>.</p><p>Silakan selesaikan pembayaran sebesar <strong>Rp${booking.price.toLocaleString("id-ID")}</strong> sebelum batas waktu agar jadwal terkunci.</p>`,
      });
    }

    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: mapBookingDoc(updated!, { revealMeetingLink: false }),
    };
  },
});

export const declineSession = mutation({
  args: {
    bookingId: v.string(),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    declineReason: v.optional(v.string()),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Permintaan sesi tidak ditemukan.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
      .first();
    if (!tutor || tutor.userId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya tutor terkait yang dapat menolak permintaan sesi ini.",
      };
    }
    if (booking.status !== "requested") {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error: "Permintaan sesi tidak lagi dalam status menunggu persetujuan.",
      };
    }

    const reason = args.declineReason?.trim().slice(0, 300) || undefined;
    await ctx.db.patch("bookings", booking._id, {
      status: "declined",
      declineReason: reason,
    });

    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: mapBookingDoc(updated!, { revealMeetingLink: false }),
    };
  },
});

export const updateMeetingLink = mutation({
  args: {
    bookingId: v.string(),
    meetingLink: v.string(),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const link = args.meetingLink.trim();
    if (link.length < 4 || link.length > 300) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Link meeting atau lokasi temu wajib 4–300 karakter.",
      };
    }

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Booking tidak ditemukan.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
      .first();
    if (!tutor || tutor.userId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya tutor terkait yang dapat memperbarui link meeting / lokasi.",
      };
    }

    await ctx.db.patch("bookings", booking._id, { meetingLink: link });
    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: mapBookingDoc(updated!, { revealMeetingLink: true }),
    };
  },
});

/**
 * Brief Bab 4.5: Session cancellation with 12-hour refund policy.
 */
export const cancelSession = mutation({
  args: {
    bookingId: v.string(),
    reason: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: serviceResultValidator(
    v.object({
      booking: bookingObjectValidator,
      refundEligible: v.boolean(),
      refundReason: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
      nowMs: now,
    });
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });

    if (!admin.authorized && !actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Data sesi tidak ditemukan.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
      .first();

    let cancelledByRole: "learner" | "tutor" | "admin" | null = null;
    if (actor && booking.learnerId === actor.appId) {
      cancelledByRole = "learner";
    } else if (actor && tutor && tutor.userId === actor.appId) {
      cancelledByRole = "tutor";
    } else if (admin.authorized) {
      cancelledByRole = "admin";
    }

    if (!cancelledByRole) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Anda tidak memiliki akses untuk membatalkan sesi ini.",
      };
    }

    if (
      booking.status !== "requested" &&
      booking.status !== "offered" &&
      booking.status !== "accepted" &&
      booking.status !== "paid"
    ) {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error: "Sesi dengan status saat ini tidak dapat dibatalkan.",
      };
    }

    const wasPaid = booking.status === "paid";
    const refund = evaluateCancellationRefund({
      cancelledByRole,
      wasPaid,
      startAt: booking.startAt,
      nowMs: now,
    });

    if (booking.paymentExpiryJobId) {
      await ctx.scheduler.cancel(booking.paymentExpiryJobId);
    }
    if (booking.autoCompleteJobId) {
      await ctx.scheduler.cancel(booking.autoCompleteJobId);
    }

    await ctx.db.patch("bookings", booking._id, {
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: actor?.appId ?? admin.adminUserId ?? "admin",
      declineReason: args.reason?.trim().slice(0, 300) || refund.reason,
      escrowStatus: refund.nextEscrowStatus,
    });

    if (cancelledByRole === "tutor" && tutor && wasPaid) {
      await ctx.db.patch("tutors", tutor._id, {
        cancelledByTutorCount: (tutor.cancelledByTutorCount ?? 0) + 1,
      });
    }

    if (refund.refundEligible) {
      const payment = await ctx.db
        .query("payments")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
        .first();
      if (payment) {
        await ctx.db.patch("payments", payment._id, {
          status: "refunded",
          refundedAt: now,
        });
      }
    }

    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: {
        booking: mapBookingDoc(updated!, { revealMeetingLink: false }),
        refundEligible: refund.refundEligible,
        refundReason: refund.reason,
      },
    };
  },
});

/**
 * Brief Bab 4.5 & F10: Tutor marks session done -> schedules 24h auto-complete.
 */
export const markTutorDone = mutation({
  args: {
    bookingId: v.string(),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Data sesi tidak ditemukan.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
      .first();
    if (!tutor || tutor.userId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya tutor sesi ini yang dapat menandai sesi selesai.",
      };
    }

    if (booking.status !== "paid") {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error: "Sesi hanya dapat ditandai selesai setelah dibayar.",
      };
    }

    const autoJobId = await ctx.scheduler.runAfter(
      AUTO_COMPLETE_AFTER_TUTOR_DONE_MS,
      internal.bookings.autoCompleteSession,
      { bookingId: booking.appId },
    );

    await ctx.db.patch("bookings", booking._id, {
      status: "tutor_marked_done",
      tutorMarkedDoneAt: now,
      autoCompleteJobId: autoJobId,
    });

    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: mapBookingDoc(updated!, { revealMeetingLink: true }),
    };
  },
});

/**
 * Brief F10: Learner confirms session completion + submits clarity & pacing review in 1 step.
 * Atomically updates tutor review aggregates and releases escrow to ready_for_payout.
 */
export const confirmAndReviewSession = mutation({
  args: {
    bookingId: v.string(),
    clarityRating: v.number(),
    pacingRating: v.number(),
    reviewText: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: serviceResultValidator(
    v.object({
      booking: bookingObjectValidator,
      review: sessionReviewObjectValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    if (
      !Number.isInteger(args.clarityRating) ||
      args.clarityRating < 1 ||
      args.clarityRating > 5 ||
      !Number.isInteger(args.pacingRating) ||
      args.pacingRating < 1 ||
      args.pacingRating > 5
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Rating kejelasan konsep dan ritme harus bilangan bulat 1–5.",
      };
    }

    const reviewText = args.reviewText?.trim() || undefined;
    if (reviewText && reviewText.length > 600) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Ulasan maksimal 600 karakter.",
      };
    }

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Data sesi tidak ditemukan.",
      };
    }

    if (booking.learnerId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya learner sesi ini yang dapat mengonfirmasi dan memberi ulasan.",
      };
    }

    if (
      booking.status !== "paid" &&
      booking.status !== "tutor_marked_done" &&
      booking.status !== "completed"
    ) {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error: "Sesi belum dibayar atau sudah dibatalkan.",
      };
    }

    const existingReview = await ctx.db
      .query("sessionReviews")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();
    if (existingReview) {
      return {
        ok: false as const,
        code: "ALREADY_REVIEWED",
        error: "Anda sudah memberikan ulasan untuk sesi ini.",
      };
    }

    if (booking.autoCompleteJobId) {
      await ctx.scheduler.cancel(booking.autoCompleteJobId);
    }

    const wasAlreadyCompleted = booking.status === "completed";
    await ctx.db.patch("bookings", booking._id, {
      status: "completed",
      completedAt: booking.completedAt ?? now,
      escrowStatus:
        booking.escrowStatus === "paid_out" ? "paid_out" : "ready_for_payout",
    });

    const reviewAppId = `rev-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await ctx.db.insert("sessionReviews", {
      appId: reviewAppId,
      bookingId: booking.appId,
      learnerId: booking.learnerId,
      tutorId: booking.tutorId,
      clarityRating: args.clarityRating,
      pacingRating: args.pacingRating,
      reviewText,
      createdAt: now,
    });

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
      .first();
    if (tutor) {
      const nextReviewCount = (tutor.reviewCount ?? 0) + 1;
      const nextClaritySum = (tutor.clarityRatingSum ?? 0) + args.clarityRating;
      const nextPacingSum = (tutor.pacingRatingSum ?? 0) + args.pacingRating;
      const avgClarity = Math.round((nextClaritySum / nextReviewCount) * 100) / 100;
      await ctx.db.patch("tutors", tutor._id, {
        reviewCount: nextReviewCount,
        clarityRatingSum: nextClaritySum,
        pacingRatingSum: nextPacingSum,
        rating: avgClarity,
        completedSessions:
          (tutor.completedSessions ?? 0) + (wasAlreadyCompleted ? 0 : 1),
      });
    }

    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: {
        booking: mapBookingDoc(updated!, { revealMeetingLink: true }),
        review: {
          id: reviewAppId,
          bookingId: booking.appId,
          learnerId: booking.learnerId,
          tutorId: booking.tutorId,
          clarityRating: args.clarityRating,
          pacingRating: args.pacingRating,
          reviewText,
          createdAt: now,
        },
      },
    };
  },
});

export const expireUnpaidBooking = internalMutation({
  args: { bookingId: v.string() },
  returns: v.object({ expired: v.boolean() }),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking || booking.status !== "accepted") {
      return { expired: false };
    }

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();
    if (
      payment &&
      (payment.status === "paid" || payment.status === "pending_verification")
    ) {
      return { expired: false };
    }

    await ctx.db.patch("bookings", booking._id, {
      status: "expired",
      escrowStatus: "none",
    });
    return { expired: true };
  },
});

export const autoCompleteSession = internalMutation({
  args: { bookingId: v.string() },
  returns: v.object({ completed: v.boolean() }),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking || booking.status !== "tutor_marked_done") {
      return { completed: false };
    }

    const now = Date.now();
    await ctx.db.patch("bookings", booking._id, {
      status: "completed",
      completedAt: now,
      escrowStatus: "ready_for_payout",
    });

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
      .first();
    if (tutor) {
      await ctx.db.patch("tutors", tutor._id, {
        completedSessions: (tutor.completedSessions ?? 0) + 1,
      });
    }

    return { completed: true };
  },
});

// ============================================================================
// Chat Offer & Figma Direct Booking Flows (Preserved & Hardened)
// ============================================================================

export const createOffer = mutation({
  args: {
    sessionToken: v.optional(v.string()),
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
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Sesi login tidak valid.",
      };
    }

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

    if (!tutor || !tutor.verified || tutor.userId !== actor.appId) {
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
        data: mapBookingDoc(existingBooking, { revealMeetingLink: false }),
      };
    }

    const insertedId = await ctx.db.insert("bookings", {
      appId: bookingAppId,
      conversationId: conversation.appId,
      learnerId: conversation.learnerId,
      tutorId: conversation.tutorId,
      courseId: course.appId,
      topic: trimmedTopic,
      startAt: args.startAt,
      durationMinutes: 60,
      sessionCount: 1,
      price: args.price,
      meetingMode: args.meetingMode ?? "online",
      brief: trimmedBrief,
      status: "offered",
      escrowStatus: "none",
      createdAt: now,
    });

    await ctx.db.insert("messages", {
      appId: messageAppId,
      conversationId: conversation.appId,
      senderId: actor.appId,
      type: "offer",
      bookingId: bookingAppId,
      createdAt: now,
    });

    await ctx.db.patch("conversations", conversation._id, {
      lastMessageAt: now,
    });

    const created: Doc<"bookings"> | null = await ctx.db.get("bookings", insertedId);
    return {
      ok: true as const,
      data: mapBookingDoc(created!, { revealMeetingLink: false }),
    };
  },
});

export const createDirectBooking = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingAppId: v.optional(v.string()),
    conversationAppId: v.optional(v.string()),
    actorUserId: v.string(),
    tutorId: v.string(),
    courseId: v.string(),
    topic: v.string(),
    startAt: v.number(),
    sessionCount: v.union(v.literal(1), v.literal(4)),
    brief: v.optional(v.string()),
    difficultyTier: v.optional(difficultyTierValidator),
    diagnosticNotes: v.optional(v.string()),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; data: ReturnType<typeof mapBookingDoc> }
    | { ok: false; error: string; code?: string }
  > => {
    const now = Date.now();
    const learner = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!learner) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error: "Sign in to continue booking.",
      };
    }

    const trimmedCourseId = args.courseId.trim();
    const trimmedTopic = args.topic.trim();
    const trimmedBrief = args.brief?.trim() || undefined;
    const trimmedDiagnostic = args.diagnosticNotes?.trim() || trimmedBrief;

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
    if (trimmedDiagnostic && trimmedDiagnostic.length > MAX_BRIEF_LENGTH) {
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

    const [tutor, course] = await Promise.all([
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
        .first(),
      ctx.db
        .query("courses")
        .withIndex("by_appId", (q) => q.eq("appId", trimmedCourseId))
        .first(),
    ]);

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
        error: "Session total exceeds allowed limit.",
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
        data: mapBookingDoc(existingBooking, { revealMeetingLink: false }),
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
          .lt("startAt", newEnd),
      )
      .take(50);

    const reusableUnpaid = tutorBookings.find(
      (other) =>
        other.learnerId === learner.appId &&
        other.courseId === course.appId &&
        other.startAt === args.startAt &&
        other.price === price &&
        other.status === "accepted",
    );
    if (reusableUnpaid) {
      return {
        ok: true as const,
        data: mapBookingDoc(reusableUnpaid, { revealMeetingLink: false }),
      };
    }

    const conflicting = tutorBookings.find((other) => {
      if (!ACTIVE_LOCK_STATUSES.has(other.status)) return false;
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
        q.eq("learnerId", learner.appId).eq("tutorId", tutor.appId),
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
    const paymentDeadlineAt = computePaymentDeadline(now, args.startAt);
    const expiryJobId: Id<"_scheduled_functions"> = await ctx.scheduler.runAt(
      paymentDeadlineAt,
      internal.bookings.expireUnpaidBooking,
      { bookingId: bookingAppId },
    );

    const insertedId: Id<"bookings"> = await ctx.db.insert("bookings", {
      appId: bookingAppId,
      conversationId: conversationAppId,
      learnerId: learner.appId,
      tutorId: tutor.appId,
      courseId: course.appId,
      topic: trimmedTopic,
      startAt: args.startAt,
      durationMinutes: 60,
      sessionCount: args.sessionCount,
      price,
      meetingMode,
      brief: trimmedBrief,
      difficultyTier: args.difficultyTier,
      diagnosticNotes: trimmedDiagnostic,
      status: "accepted",
      escrowStatus: "none",
      acceptedAt: now,
      paymentDeadlineAt,
      paymentExpiryJobId: expiryJobId,
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

    const created: Doc<"bookings"> | null = await ctx.db.get("bookings", insertedId);
    return {
      ok: true as const,
      data: mapBookingDoc(created!, { revealMeetingLink: false }),
    };
  },
});

export const acceptOffer = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

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

    if (booking.learnerId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error:
          "Hanya mahasiswa penerima tawaran yang dapat menerima tawaran ini.",
      };
    }

    if (
      booking.status === "accepted" ||
      booking.status === "paid" ||
      booking.status === "completed"
    ) {
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

    if (booking.startAt <= now) {
      return {
        ok: false as const,
        code: "OFFER_EXPIRED",
        error:
          "Jadwal tawaran sesi ini sudah lewat. Minta tutor mengirim jadwal baru.",
      };
    }

    const conflicted = await hasTutorScheduleConflict(ctx, {
      tutorId: booking.tutorId,
      startAt: booking.startAt,
      durationMinutes: booking.durationMinutes,
      excludeBookingAppId: booking.appId,
    });

    if (conflicted) {
      return {
        ok: false as const,
        code: "SCHEDULE_CONFLICT",
        error:
          "Jadwal bentrok dengan sesi tutor yang sudah diterima/dibayar. Minta tutor mengirim jadwal lain.",
      };
    }

    const paymentDeadlineAt = computePaymentDeadline(now, booking.startAt);
    const expiryJobId = await ctx.scheduler.runAt(
      paymentDeadlineAt,
      internal.bookings.expireUnpaidBooking,
      { bookingId: booking.appId },
    );

    await ctx.db.patch("bookings", booking._id, {
      status: "accepted",
      acceptedAt: now,
      paymentDeadlineAt,
      paymentExpiryJobId: expiryJobId,
    });

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

    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: mapBookingDoc(updated!, { revealMeetingLink: false }),
    };
  },
});

export const declineOffer = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(bookingObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

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

    if (booking.learnerId !== actor.appId) {
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
    const updated = await ctx.db.get("bookings", booking._id);
    return {
      ok: true as const,
      data: mapBookingDoc(updated!, { revealMeetingLink: false }),
    };
  },
});
