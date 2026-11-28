import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  env,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  canRevealSensitiveContact,
  isAdminRequestAuthorized,
  isDemoFallbackAllowed,
  mapTutorDoc,
  mapUserDoc,
  resolveActorUser,
} from "./lib/auth";
import { paymentModeValidator } from "./schema";
import {
  bookingObjectValidator,
  courseObjectValidator,
  paymentConfigObjectValidator,
  paymentObjectValidator,
  sanitizeProofFileName,
  serviceResultValidator,
  tutorObjectValidator,
  userObjectValidator,
} from "./validators";

async function mapPaymentDoc(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"payments">,
) {
  const proofUrl = row.proofStorageId
    ? ((await ctx.storage.getUrl(row.proofStorageId)) ?? undefined)
    : undefined;
  return {
    id: row.appId,
    bookingId: row.bookingId,
    amount: row.amount,
    status: row.status,
    paymentMethod: row.paymentMethod,
    proofName: row.proofName,
    proofStorageId: row.proofStorageId,
    proofUrl,
    midtransOrderId: row.midtransOrderId,
    midtransTransactionId: row.midtransTransactionId,
    midtransSnapToken: row.midtransSnapToken,
    midtransRedirectUrl: row.midtransRedirectUrl,
    submittedAt: row.submittedAt,
    verifiedAt: row.verifiedAt,
    paidAt: row.paidAt,
    refundedAt: row.refundedAt,
    rejectionReason: row.rejectionReason,
  };
}

async function resolvePaymentConfig(ctx: QueryCtx | MutationCtx) {
  const saved = await ctx.db
    .query("paymentConfigs")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .first();

  const midtransEnabled = Boolean(env.MIDTRANS_SERVER_KEY?.trim());
  if (saved) {
    const qrisImageUrl = saved.qrisStorageId
      ? ((await ctx.storage.getUrl(saved.qrisStorageId)) ?? saved.qrisImageUrl)
      : (saved.qrisImageUrl ?? env.KOLEARA_STATIC_QRIS_URL?.trim() ?? "/qris-koleara.png");
    return {
      mode: saved.mode,
      merchantName: saved.merchantName,
      qrisImageUrl,
      instructions: saved.instructions,
      accountInfo: saved.accountInfo,
      midtransEnabled,
      updatedAt: saved.updatedAt,
    };
  }

  return {
    mode: "static_qris" as const,
    merchantName: env.KOLEARA_STATIC_QRIS_MERCHANT?.trim() || "KOLEARA ITS",
    qrisImageUrl: env.KOLEARA_STATIC_QRIS_URL?.trim() || "/qris-koleara.png",
    instructions:
      "Scan QRIS KOLEARA menggunakan e-wallet atau mobile banking sesuai nominal tepat, lalu unggah bukti transfer agar diverifikasi admin.",
    accountInfo: undefined,
    midtransEnabled,
    updatedAt: 0,
  };
}

export const getPaymentConfig = query({
  args: {},
  returns: paymentConfigObjectValidator,
  handler: async (ctx) => {
    return await resolvePaymentConfig(ctx);
  },
});

export const updatePaymentConfig = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
    mode: paymentModeValidator,
    merchantName: v.string(),
    qrisImageUrl: v.optional(v.string()),
    qrisStorageId: v.optional(v.id("_storage")),
    instructions: v.string(),
    accountInfo: v.optional(v.string()),
  },
  returns: serviceResultValidator(paymentConfigObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
      nowMs: now,
    });
    if (!admin.authorized) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Akses admin diperlukan untuk mengubah konfigurasi QRIS.",
      };
    }

    const merchantName = args.merchantName.trim();
    const instructions = args.instructions.trim();
    if (merchantName.length < 2 || merchantName.length > 100) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Nama merchant wajib 2–100 karakter.",
      };
    }
    if (instructions.length < 5 || instructions.length > 500) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Instruksi pembayaran wajib 5–500 karakter.",
      };
    }

    const existing = await ctx.db
      .query("paymentConfigs")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    if (existing) {
      if (
        existing.qrisStorageId &&
        args.qrisStorageId &&
        existing.qrisStorageId !== args.qrisStorageId
      ) {
        await ctx.storage.delete(existing.qrisStorageId);
      }
      await ctx.db.patch("paymentConfigs", existing._id, {
        mode: args.mode,
        merchantName,
        qrisImageUrl: args.qrisImageUrl?.trim() || existing.qrisImageUrl,
        qrisStorageId: args.qrisStorageId ?? existing.qrisStorageId,
        instructions,
        accountInfo: args.accountInfo?.trim() || undefined,
        updatedAt: now,
        updatedBy: admin.adminUserId,
      });
    } else {
      await ctx.db.insert("paymentConfigs", {
        key: "default",
        mode: args.mode,
        merchantName,
        qrisImageUrl: args.qrisImageUrl?.trim() || undefined,
        qrisStorageId: args.qrisStorageId,
        instructions,
        accountInfo: args.accountInfo?.trim() || undefined,
        updatedAt: now,
        updatedBy: admin.adminUserId,
      });
    }

    return {
      ok: true as const,
      data: await resolvePaymentConfig(ctx),
    };
  },
});

export const getCheckoutByBooking = query({
  args: {
    bookingId: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      booking: bookingObjectValidator,
      payment: paymentObjectValidator,
      tutor: tutorObjectValidator,
      learner: userObjectValidator,
      course: courseObjectValidator,
      paymentConfig: paymentConfigObjectValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) return null;

    const [tutor, learner, course, paymentRow, paymentConfig] =
      await Promise.all([
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
        resolvePaymentConfig(ctx),
      ]);

    if (!tutor || !learner || !course) return null;

    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });

    if (!admin.authorized) {
      if (args.sessionToken !== undefined || args.userId !== undefined) {
        const actor = await resolveActorUser(ctx, {
          sessionToken: args.sessionToken,
          fallbackUserId: args.userId,
        });
        if (
          !actor ||
          (booking.learnerId !== actor.appId && tutor.userId !== actor.appId)
        ) {
          return null;
        }
      }
    }

    const revealContact =
      admin.authorized || canRevealSensitiveContact(booking.status);

    const payment = paymentRow
      ? await mapPaymentDoc(ctx, paymentRow)
      : {
          id: `pay-${booking.appId}`,
          bookingId: booking.appId,
          amount: booking.price,
          status:
            booking.status === "paid" || booking.status === "completed"
              ? ("paid" as const)
              : ("unpaid" as const),
          paymentMethod: paymentConfig.mode,
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
        sessionCount: booking.sessionCount,
        price: booking.price,
        meetingMode: booking.meetingMode,
        brief: booking.brief,
        difficultyTier: booking.difficultyTier,
        diagnosticNotes: booking.diagnosticNotes,
        agreedNoJoki: booking.agreedNoJoki,
        meetingLink: revealContact ? booking.meetingLink : undefined,
        status: booking.status,
        escrowStatus: booking.escrowStatus,
        declineReason: booking.declineReason,
        paymentDeadlineAt: booking.paymentDeadlineAt,
        acceptedAt: booking.acceptedAt,
        paidAt: booking.paidAt,
        tutorMarkedDoneAt: booking.tutorMarkedDoneAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
        cancelledBy: booking.cancelledBy,
        createdAt: booking.createdAt,
      },
      payment,
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
      paymentConfig,
    };
  },
});

export const startPayment = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(paymentObjectValidator),
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
        error: "Data pemesanan tidak ditemukan.",
      };
    }

    if (booking.learnerId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya mahasiswa pemesan yang dapat membuka pembayaran ini.",
      };
    }

    if (booking.status === "paid" || booking.status === "completed") {
      return {
        ok: false as const,
        code: "ALREADY_PAID",
        error: "Pemesanan ini sudah lunas. Pembayaran ulang tidak diperlukan.",
      };
    }

    if (booking.status !== "accepted") {
      return {
        ok: false as const,
        code: "NOT_ACCEPTED",
        error:
          "Checkout hanya tersedia untuk sesi yang sudah diterima tutor.",
      };
    }

    const config = await resolvePaymentConfig(ctx);
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
        data: await mapPaymentDoc(ctx, existing),
      };
    }

    const appId = `pay-${booking.appId}`;
    const insertedId = await ctx.db.insert("payments", {
      appId,
      bookingId: booking.appId,
      amount: booking.price,
      status: "unpaid",
      paymentMethod: config.mode,
    });
    const inserted = await ctx.db.get("payments", insertedId);

    return {
      ok: true as const,
      data: await mapPaymentDoc(ctx, inserted!),
    };
  },
});

export const submitDemoProof = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.string(),
    actorUserId: v.string(),
    proofName: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
  },
  returns: serviceResultValidator(paymentObjectValidator),
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
        error: "Data pemesanan tidak ditemukan.",
      };
    }

    if (booking.learnerId !== actor.appId) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Hanya mahasiswa pemesan yang dapat mengirim bukti transfer.",
      };
    }

    if (booking.status !== "accepted") {
      return {
        ok: false as const,
        code: "NOT_ACCEPTED",
        error: "Pemesanan ini tidak dalam status siap dibayar.",
      };
    }

    if (args.proofStorageId) {
      const meta = await ctx.db.system.get("_storage", args.proofStorageId);
      if (!meta) {
        return {
          ok: false as const,
          code: "FILE_NOT_FOUND",
          error: "File bukti pembayaran tidak ditemukan di penyimpanan.",
        };
      }
    }

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();

    if (existing?.status === "paid") {
      return {
        ok: false as const,
        code: "ALREADY_PAID",
        error: "Pembayaran ini sudah terverifikasi.",
      };
    }
    if (existing?.status === "pending_verification") {
      return {
        ok: false as const,
        code: "ALREADY_SUBMITTED",
        error: "Bukti transfer sudah dikirim dan sedang menunggu verifikasi admin.",
      };
    }

    const safeFileName = sanitizeProofFileName(args.proofName);
    const appId = existing?.appId ?? `pay-${booking.appId}`;

    let docId = existing?._id;
    if (existing) {
      if (
        existing.proofStorageId &&
        args.proofStorageId &&
        existing.proofStorageId !== args.proofStorageId
      ) {
        await ctx.storage.delete(existing.proofStorageId);
      }
      await ctx.db.patch("payments", existing._id, {
        status: "pending_verification",
        paymentMethod: "static_qris",
        proofName: safeFileName,
        ...(args.proofStorageId ? { proofStorageId: args.proofStorageId } : {}),
        submittedAt: now,
        rejectionReason: undefined,
      });
    } else {
      docId = await ctx.db.insert("payments", {
        appId,
        bookingId: booking.appId,
        amount: booking.price,
        status: "pending_verification",
        paymentMethod: "static_qris",
        proofName: safeFileName,
        proofStorageId: args.proofStorageId,
        submittedAt: now,
      });
    }

    const updated = await ctx.db.get("payments", docId!);
    return {
      ok: true as const,
      data: await mapPaymentDoc(ctx, updated!),
    };
  },
});

export const completeDemoQris = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.string(),
    actorUserId: v.string(),
  },
  returns: serviceResultValidator(paymentObjectValidator),
  handler: async (ctx, args) => {
    if (!isDemoFallbackAllowed()) {
      return {
        ok: false as const,
        code: "DEMO_DISABLED",
        error:
          "Konfirmasi otomatis demo dinonaktifkan di produksi. Unggah bukti QRIS untuk diverifikasi admin atau bayar via Midtrans.",
      };
    }

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
        error: "Sign in to complete payment.",
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
        error: "Booking not found.",
      };
    }
    if (booking.learnerId !== actor.appId) {
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
        data: await mapPaymentDoc(ctx, existing),
      };
    }

    if (booking.status !== "accepted") {
      return {
        ok: false as const,
        code: "NOT_ACCEPTED",
        error: "This booking cannot be paid in its current state.",
      };
    }

    if (booking.paymentExpiryJobId) {
      await ctx.scheduler.cancel(booking.paymentExpiryJobId);
    }

    const appId = existing?.appId ?? `pay-${booking.appId}`;
    const proofName = existing?.proofName ?? "qris-auto-demo.png";
    const submittedAt = existing?.submittedAt ?? now;

    let docId = existing?._id;
    if (existing) {
      await ctx.db.patch("payments", existing._id, {
        status: "paid",
        paymentMethod: existing.paymentMethod ?? "static_qris",
        proofName,
        submittedAt,
        verifiedAt: now,
        paidAt: now,
        rejectionReason: undefined,
      });
    } else {
      docId = await ctx.db.insert("payments", {
        appId,
        bookingId: booking.appId,
        amount: booking.price,
        status: "paid",
        paymentMethod: "static_qris",
        proofName,
        submittedAt,
        verifiedAt: now,
        paidAt: now,
      });
    }

    await ctx.db.patch("bookings", booking._id, {
      status: "paid",
      paidAt: now,
      escrowStatus: "held",
    });

    const updated = await ctx.db.get("payments", docId!);
    return {
      ok: true as const,
      data: await mapPaymentDoc(ctx, updated!),
    };
  },
});

/**
 * Admin manual verification for Static QRIS (primary payment flow before Midtrans live).
 */
export const simulateVerification = mutation({
  args: {
    bookingId: v.string(),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    rejectionReason: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: serviceResultValidator(paymentObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
      nowMs: now,
    });
    if (!admin.authorized) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Akses admin tidak valid.",
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
          "Verifikasi hanya dapat dijalankan saat status Menunggu Verifikasi.",
      };
    }

    if (args.decision === "approve") {
      if (booking.paymentExpiryJobId) {
        await ctx.scheduler.cancel(booking.paymentExpiryJobId);
      }
      await ctx.db.patch("payments", payment._id, {
        status: "paid",
        verifiedAt: now,
        paidAt: now,
        rejectionReason: undefined,
      });
      await ctx.db.patch("bookings", booking._id, {
        status: "paid",
        paidAt: now,
        escrowStatus: "held",
      });

      const [learner, tutor] = await Promise.all([
        ctx.db
          .query("users")
          .withIndex("by_appId", (q) => q.eq("appId", booking.learnerId))
          .first(),
        ctx.db
          .query("tutors")
          .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
          .first(),
      ]);
      if (learner) {
        await ctx.scheduler.runAfter(0, internal.notifications.sendTransactionalEmail, {
          to: learner.email,
          subject: `[KOLEARA] Pembayaran terverifikasi — Sesi ${booking.topic} terjadwal`,
          html: `<p>Halo ${learner.name},</p><p>Pembayaran sebesar <strong>Rp${payment.amount.toLocaleString("id-ID")}</strong> telah diverifikasi. Link meeting dan kontak WhatsApp tutor sekarang sudah terbuka di halaman Sesi Saya.</p>`,
        });
      }
      if (tutor) {
        const tutorUser = await ctx.db
          .query("users")
          .withIndex("by_appId", (q) => q.eq("appId", tutor.userId))
          .first();
        if (tutorUser) {
          await ctx.scheduler.runAfter(0, internal.notifications.sendTransactionalEmail, {
            to: tutorUser.email,
            subject: `[KOLEARA] Sesi ${booking.topic} sudah dibayar learner`,
            html: `<p>Halo ${tutor.name},</p><p>Pembayaran learner untuk sesi <strong>${booking.topic}</strong> telah masuk ke escrow KOLEARA. Silakan pastikan link meeting/lokasi sudah terisi di Dashboard Tutor.</p>`,
          });
        }
      }

      const updated = await ctx.db.get("payments", payment._id);
      return {
        ok: true as const,
        data: await mapPaymentDoc(ctx, updated!),
      };
    }

    const rejectionReason =
      args.rejectionReason?.trim().slice(0, 300) ||
      "Verifikasi bukti pembayaran ditolak oleh admin. Silakan unggah ulang bukti transfer yang jelas.";
    await ctx.db.patch("payments", payment._id, {
      status: "rejected",
      verifiedAt: now,
      rejectionReason,
    });

    const updated = await ctx.db.get("payments", payment._id);
    return {
      ok: true as const,
      data: await mapPaymentDoc(ctx, updated!),
    };
  },
});

// ============================================================================
// Internal Midtrans Helpers (Ready-to-plug when MIDTRANS_SERVER_KEY is set)
// ============================================================================

export const getBookingForMidtransInternal = internalQuery({
  args: {
    bookingId: v.string(),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      bookingId: v.string(),
      learnerId: v.string(),
      learnerName: v.string(),
      learnerEmail: v.string(),
      tutorName: v.string(),
      courseName: v.string(),
      topic: v.string(),
      amount: v.number(),
      status: v.string(),
      existingOrderId: v.optional(v.string()),
      existingSnapToken: v.optional(v.string()),
      existingRedirectUrl: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
    });
    if (!actor) return null;

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking || booking.learnerId !== actor.appId) return null;

    const [tutor, course, payment] = await Promise.all([
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", booking.tutorId))
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
    if (!tutor || !course) return null;

    return {
      bookingId: booking.appId,
      learnerId: actor.appId,
      learnerName: actor.name,
      learnerEmail: actor.email,
      tutorName: tutor.name,
      courseName: course.name,
      topic: booking.topic,
      amount: booking.price,
      status: booking.status,
      existingOrderId: payment?.midtransOrderId,
      existingSnapToken: payment?.midtransSnapToken,
      existingRedirectUrl: payment?.midtransRedirectUrl,
    };
  },
});

export const attachMidtransSnapInternal = internalMutation({
  args: {
    bookingId: v.string(),
    orderId: v.string(),
    snapToken: v.string(),
    redirectUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .first();
    if (!booking) return null;

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .first();

    if (existing) {
      await ctx.db.patch("payments", existing._id, {
        paymentMethod: "midtrans",
        midtransOrderId: args.orderId,
        midtransSnapToken: args.snapToken,
        midtransRedirectUrl: args.redirectUrl,
      });
    } else {
      await ctx.db.insert("payments", {
        appId: `pay-${booking.appId}`,
        bookingId: booking.appId,
        amount: booking.price,
        status: "unpaid",
        paymentMethod: "midtrans",
        midtransOrderId: args.orderId,
        midtransSnapToken: args.snapToken,
        midtransRedirectUrl: args.redirectUrl,
      });
    }
    return null;
  },
});

export const handleMidtransWebhookInternal = internalMutation({
  args: {
    orderId: v.string(),
    transactionStatus: v.string(),
    fraudStatus: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    paymentType: v.optional(v.string()),
    grossAmount: v.number(),
  },
  returns: v.object({
    handled: v.boolean(),
    idempotent: v.optional(v.boolean()),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_midtransOrderId", (q) => q.eq("midtransOrderId", args.orderId))
      .first();
    if (!payment) {
      return { handled: false, status: "order_not_found" };
    }

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", payment.bookingId))
      .first();
    if (!booking) {
      return { handled: false, status: "booking_not_found" };
    }

    if (Math.round(args.grossAmount) !== Math.round(payment.amount)) {
      return { handled: false, status: "amount_mismatch" };
    }

    const now = Date.now();
    const isSettled =
      args.transactionStatus === "settlement" ||
      (args.transactionStatus === "capture" &&
        (!args.fraudStatus || args.fraudStatus === "accept"));

    if (isSettled) {
      if (payment.status === "paid" && booking.status === "paid") {
        return { handled: true, idempotent: true, status: "paid" };
      }
      if (booking.paymentExpiryJobId) {
        await ctx.scheduler.cancel(booking.paymentExpiryJobId);
      }
      await ctx.db.patch("payments", payment._id, {
        status: "paid",
        paymentMethod: args.paymentType ?? "midtrans",
        midtransTransactionId: args.transactionId,
        verifiedAt: now,
        paidAt: now,
        rejectionReason: undefined,
      });
      await ctx.db.patch("bookings", booking._id, {
        status: "paid",
        paidAt: now,
        escrowStatus: "held",
      });
      return { handled: true, status: "paid" };
    }

    if (
      args.transactionStatus === "expire" ||
      args.transactionStatus === "cancel" ||
      args.transactionStatus === "deny"
    ) {
      if (payment.status === "paid") {
        return { handled: true, idempotent: true, status: "already_paid" };
      }
      await ctx.db.patch("payments", payment._id, {
        status: "rejected",
        midtransTransactionId: args.transactionId,
        rejectionReason: `Transaksi Midtrans ${args.transactionStatus}.`,
      });
      if (booking.status === "accepted") {
        await ctx.db.patch("bookings", booking._id, {
          status: "expired",
          escrowStatus: "none",
        });
      }
      return { handled: true, status: args.transactionStatus };
    }

    return { handled: true, status: args.transactionStatus };
  },
});
