import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  bookingObjectValidator,
  courseObjectValidator,
  isAdminAuthorized,
  paymentObjectValidator,
  sanitizeProofFileName,
  serviceResultValidator,
  tutorObjectValidator,
  userObjectValidator,
} from "./validators";

export const getCheckoutByBooking = query({
  args: {
    bookingId: v.string(),
    userId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      booking: bookingObjectValidator,
      payment: paymentObjectValidator,
      tutor: tutorObjectValidator,
      learner: userObjectValidator,
      course: courseObjectValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) return null;

    const [tutor, learner, course, paymentRow] = await Promise.all([
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
    ]);

    if (!tutor || !learner || !course) return null;

    if (args.userId !== undefined) {
      const uid = args.userId.trim();
      if (!uid || (booking.learnerId !== uid && tutor.userId !== uid)) {
        return null;
      }
    }

    const payment = paymentRow
      ? {
          id: paymentRow.appId,
          bookingId: paymentRow.bookingId,
          amount: paymentRow.amount,
          status: paymentRow.status,
          proofName: paymentRow.proofName,
          submittedAt: paymentRow.submittedAt,
          verifiedAt: paymentRow.verifiedAt,
          rejectionReason: paymentRow.rejectionReason,
        }
      : {
          id: `pay-${booking.appId}`,
          bookingId: booking.appId,
          amount: booking.price,
          status:
            booking.status === "paid" ? ("paid" as const) : ("unpaid" as const),
        };

    return {
      booking: {
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
        status: booking.status,
        createdAt: booking.createdAt,
      },
      payment,
      tutor: {
        id: tutor.appId,
        userId: tutor.userId,
        name: tutor.name,
        department: tutor.department,
        cohort: tutor.cohort,
        bio: tutor.bio,
        courseIds: tutor.courseIds,
        topics: tutor.topics,
        hourlyRate: tutor.hourlyRate,
        verified: tutor.verified,
        badge: tutor.badge,
        rating: tutor.rating,
        completedSessionsDemo: tutor.completedSessionsDemo,
        location: tutor.location,
        slots: tutor.slots,
      },
      learner: {
        id: learner.appId,
        email: learner.email,
        name: learner.name,
        role: learner.role,
      },
      course: {
        id: course.appId,
        name: course.name,
        code: course.code,
        description: course.description,
        topics: course.topics,
      },
    };
  },
});

// shortcut: demo trusts caller-supplied actorUserId and exposes simulateVerification for checkout testing
export const startPayment = mutation({
  args: {
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(paymentObjectValidator),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Data pemesanan tidak ditemukan.",
      };
    }

    if (booking.learnerId !== args.actorUserId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya mahasiswa pemesan yang dapat membuka pembayaran ini.",
      };
    }

    if (booking.status === "paid") {
      return {
        ok: false as const,
        code: "ALREADY_PAID",
        error:
          "Pemesanan ini sudah lunas (demo). Pembayaran ulang tidak diperlukan.",
      };
    }

    if (booking.status !== "accepted") {
      return {
        ok: false as const,
        code: "NOT_ACCEPTED",
        error:
          "Checkout hanya tersedia untuk tawaran sesi yang sudah diterima.",
      };
    }

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();

    if (existing) {
      if (existing.status === "paid") {
        return {
          ok: false as const,
          code: "ALREADY_PAID",
          error: "Pembayaran ini sudah selesai.",
        };
      }
      return {
        ok: true as const,
        data: {
          id: existing.appId,
          bookingId: existing.bookingId,
          amount: existing.amount,
          status: existing.status,
          proofName: existing.proofName,
          submittedAt: existing.submittedAt,
          verifiedAt: existing.verifiedAt,
          rejectionReason: existing.rejectionReason,
        },
      };
    }

    const appId = `pay-${booking.appId}`;
    await ctx.db.insert("payments", {
      appId,
      bookingId: booking.appId,
      amount: booking.price,
      status: "unpaid",
    });

    return {
      ok: true as const,
      data: {
        id: appId,
        bookingId: booking.appId,
        amount: booking.price,
        status: "unpaid" as const,
      },
    };
  },
});

export const submitDemoProof = mutation({
  args: {
    bookingId: v.string(),
    actorUserId: v.string(),
    proofName: v.optional(v.string()),
  },
  returns: serviceResultValidator(paymentObjectValidator),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Data pemesanan tidak ditemukan.",
      };
    }

    if (booking.learnerId !== args.actorUserId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya mahasiswa pemesan yang dapat mengirim bukti demo.",
      };
    }

    if (booking.status !== "accepted") {
      return {
        ok: false as const,
        code: "NOT_ACCEPTED",
        error: "Pemesanan ini tidak dalam status siap dibayar.",
      };
    }

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();

    if (existing?.status === "paid") {
      return {
        ok: false as const,
        code: "ALREADY_PAID",
        error: "Pembayaran ini sudah terverifikasi (demo).",
      };
    }
    if (existing?.status === "pending_verification") {
      return {
        ok: false as const,
        code: "ALREADY_SUBMITTED",
        error: "Bukti demo sudah dikirim dan sedang menunggu verifikasi.",
      };
    }

    const safeFileName = sanitizeProofFileName(args.proofName);
    const now = Date.now();
    const appId = existing?.appId ?? `pay-${booking.appId}`;

    if (existing) {
      await ctx.db.patch("payments", existing._id, {
        status: "pending_verification",
        proofName: safeFileName,
        submittedAt: now,
        rejectionReason: undefined,
      });
    } else {
      await ctx.db.insert("payments", {
        appId,
        bookingId: booking.appId,
        amount: booking.price,
        status: "pending_verification",
        proofName: safeFileName,
        submittedAt: now,
      });
    }

    return {
      ok: true as const,
      data: {
        id: appId,
        bookingId: booking.appId,
        amount: booking.price,
        status: "pending_verification" as const,
        proofName: safeFileName,
        submittedAt: now,
      },
    };
  },
});

// shortcut: simulated QRIS gateway auto-confirms for booking learner in demo; replace with signed payment webhook in production
export const completeDemoQris = mutation({
  args: {
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(paymentObjectValidator),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Booking not found.",
      };
    }
    if (booking.learnerId !== args.actorUserId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Only the learner who created this booking can complete payment.",
      };
    }

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();

    if (booking.status === "paid" && existing?.status === "paid") {
      return {
        ok: true as const,
        data: {
          id: existing.appId,
          bookingId: existing.bookingId,
          amount: existing.amount,
          status: "paid" as const,
          proofName: existing.proofName,
          submittedAt: existing.submittedAt,
          verifiedAt: existing.verifiedAt,
        },
      };
    }

    if (booking.status !== "accepted") {
      return {
        ok: false as const,
        code: "NOT_ACCEPTED",
        error: "This booking cannot be paid in its current state.",
      };
    }

    const now = Date.now();
    const appId = existing?.appId ?? `pay-${booking.appId}`;
    const proofName = existing?.proofName ?? "qris-auto-demo.png";
    const submittedAt = existing?.submittedAt ?? now;

    if (existing) {
      await ctx.db.patch("payments", existing._id, {
        status: "paid",
        proofName,
        submittedAt,
        verifiedAt: now,
        rejectionReason: undefined,
      });
    } else {
      await ctx.db.insert("payments", {
        appId,
        bookingId: booking.appId,
        amount: booking.price,
        status: "paid",
        proofName,
        submittedAt,
        verifiedAt: now,
      });
    }

    await ctx.db.patch("bookings", booking._id, { status: "paid" });

    return {
      ok: true as const,
      data: {
        id: appId,
        bookingId: booking.appId,
        amount: booking.price,
        status: "paid" as const,
        proofName,
        submittedAt,
        verifiedAt: now,
      },
    };
  },
});

export const simulateVerification = mutation({
  args: {
    bookingId: v.string(),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    adminKey: v.optional(v.string()),
  },
  returns: serviceResultValidator(paymentObjectValidator),
  handler: async (ctx, args) => {
    if (!isAdminAuthorized(args.adminKey)) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Kunci admin tidak valid.",
      };
    }

    const [booking, payment] = await Promise.all([
      ctx.db
        .query("bookings")
        .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
        .first(),
      ctx.db
        .query("payments")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
        .first(),
    ]);

    if (!booking || !payment) {
      return {
        ok: false as const,
        code: "PAYMENT_NOT_FOUND",
        error: "Data pembayaran tidak ditemukan.",
      };
    }

    if (
      payment.status !== "pending_verification" ||
      booking.status !== "accepted"
    ) {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error:
          "Simulasi verifikasi hanya dapat dijalankan saat status Menunggu Verifikasi.",
      };
    }

    const now = Date.now();
    if (args.decision === "approve") {
      await ctx.db.patch("payments", payment._id, {
        status: "paid",
        verifiedAt: now,
        rejectionReason: undefined,
      });
      await ctx.db.patch("bookings", booking._id, {
        status: "paid",
      });

      return {
        ok: true as const,
        data: {
          id: payment.appId,
          bookingId: payment.bookingId,
          amount: payment.amount,
          status: "paid" as const,
          proofName: payment.proofName,
          submittedAt: payment.submittedAt,
          verifiedAt: now,
        },
      };
    }

    const rejectionReason =
      "Verifikasi admin demo ditolak (simulasi). Anda dapat mencoba kirim ulang bukti demo.";
    await ctx.db.patch("payments", payment._id, {
      status: "rejected",
      verifiedAt: now,
      rejectionReason,
    });

    return {
      ok: true as const,
      data: {
        id: payment.appId,
        bookingId: payment.bookingId,
        amount: payment.amount,
        status: "rejected" as const,
        proofName: payment.proofName,
        submittedAt: payment.submittedAt,
        verifiedAt: now,
        rejectionReason,
      },
    };
  },
});
