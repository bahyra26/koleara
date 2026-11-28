import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  isAdminRequestAuthorized,
  mapTutorDoc,
  resolveSessionUser,
} from "./lib/auth";
import { badgeValidator } from "./schema";
import {
  paymentObjectValidator,
  payoutObjectValidator,
  sanitizeProofFileName,
  serviceResultValidator,
  tutorApplicationObjectValidator,
  tutorObjectValidator,
  tutorPayoutAccountObjectValidator,
} from "./validators";

export const listPendingApplications = query({
  args: {
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.array(tutorApplicationObjectValidator),
  handler: async (ctx, args) => {
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    if (!admin.authorized) return [];
    const rows = await ctx.db
      .query("tutorApplications")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);

    return await Promise.all(
      rows.map(async (row) => {
        const proofUrl = row.proofStorageId
          ? ((await ctx.storage.getUrl(row.proofStorageId)) ?? undefined)
          : undefined;
        return {
          id: row.appId,
          userId: row.userId,
          name: row.name,
          department: row.department,
          cohort: row.cohort,
          courseIds: row.courseIds,
          topics: row.topics,
          bio: row.bio,
          hourlyRate: row.hourlyRate,
          teachingMode: row.teachingMode,
          campusSpots: row.campusSpots,
          languages: row.languages,
          slots: row.slots,
          proofStorageId: row.proofStorageId,
          proofFileName: row.proofFileName,
          proofUrl,
          payoutBankOrWallet: row.payoutBankOrWallet,
          payoutAccountName: row.payoutAccountName,
          payoutAccountNumber: row.payoutAccountNumber,
          status: row.status,
          reviewedBy: row.reviewedBy,
          reviewedAt: row.reviewedAt,
          rejectionReason: row.rejectionReason,
          createdAt: row.createdAt,
        };
      }),
    );
  },
});

export const approveTutorApplication = mutation({
  args: {
    applicationId: v.string(),
    department: v.optional(v.string()),
    cohort: v.optional(v.number()),
    badge: v.optional(badgeValidator),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: serviceResultValidator(tutorObjectValidator),
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

    const application = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", args.applicationId))
      .first();

    if (!application) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        error: "Pengajuan tutor tidak ditemukan.",
      };
    }

    if (application.status !== "pending") {
      return {
        ok: false as const,
        code: "INVALID_STATE",
        error: "Pengajuan tutor ini sudah diputuskan sebelumnya.",
      };
    }

    const resolvedCohort = args.cohort ?? application.cohort ?? 2023;
    if (
      !Number.isInteger(resolvedCohort) ||
      resolvedCohort < 2000 ||
      resolvedCohort > 2035
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Angkatan (cohort) harus berupa tahun bulat antara 2000–2035.",
      };
    }

    const rawDept = (
      args.department ??
      application.department ??
      "Teknik Informatika"
    ).trim();
    if (rawDept.length < 2 || rawDept.length > 80) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Nama departemen wajib 2–80 karakter.",
      };
    }

    const [user, existingTutor, courses] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_appId", (q) => q.eq("appId", application.userId))
        .first(),
      ctx.db
        .query("tutors")
        .withIndex("by_userId", (q) => q.eq("userId", application.userId))
        .first(),
      ctx.db.query("courses").take(50),
    ]);

    const validCourseIds = new Set(courses.map((c) => c.appId));
    const filteredCourseIds = application.courseIds.filter((cid) =>
      validCourseIds.has(cid),
    );
    if (filteredCourseIds.length === 0) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Pengajuan tidak memiliki mata kuliah aktif yang valid.",
      };
    }

    if (user && user.role === "learner") {
      await ctx.db.patch("users", user._id, { role: "tutor" });
    }

    const nameSlug =
      application.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "kandidat";

    const tutorAppId =
      existingTutor?.appId ??
      `tutor-${nameSlug}-${now.toString(36).slice(-4)}`;

    const badge = args.badge ?? "grade";
    let tutorDocId = existingTutor?._id;

    if (existingTutor) {
      await ctx.db.patch("tutors", existingTutor._id, {
        name: application.name,
        department: rawDept,
        cohort: resolvedCohort,
        bio: application.bio,
        courseIds: filteredCourseIds,
        topics: application.topics,
        hourlyRate: application.hourlyRate,
        verified: true,
        badge,
        location: application.teachingMode ?? existingTutor.location ?? "hybrid",
        campusSpots: application.campusSpots ?? existingTutor.campusSpots,
        languages: application.languages ?? existingTutor.languages ?? ["id"],
        slots: application.slots,
      });
    } else {
      tutorDocId = await ctx.db.insert("tutors", {
        appId: tutorAppId,
        userId: application.userId,
        name: application.name,
        department: rawDept,
        cohort: resolvedCohort,
        bio: application.bio,
        courseIds: filteredCourseIds,
        topics: application.topics,
        hourlyRate: application.hourlyRate,
        verified: true,
        badge,
        rating: undefined,
        reviewCount: 0,
        clarityRatingSum: 0,
        pacingRatingSum: 0,
        completedSessions: 0,
        completedSessionsDemo: 0,
        cancelledByTutorCount: 0,
        location: application.teachingMode ?? "hybrid",
        campusSpots: application.campusSpots,
        languages: application.languages ?? ["id"],
        avatarStorageId: user?.avatarStorageId,
        slots: application.slots,
      });
    }

    if (
      application.payoutBankOrWallet &&
      application.payoutAccountName &&
      application.payoutAccountNumber
    ) {
      const existingPayoutAcc = await ctx.db
        .query("tutorPayoutAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", application.userId))
        .first();
      if (existingPayoutAcc) {
        await ctx.db.patch("tutorPayoutAccounts", existingPayoutAcc._id, {
          tutorId: tutorAppId,
          bankOrWallet: application.payoutBankOrWallet,
          accountName: application.payoutAccountName,
          accountNumber: application.payoutAccountNumber,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("tutorPayoutAccounts", {
          tutorId: tutorAppId,
          userId: application.userId,
          bankOrWallet: application.payoutBankOrWallet,
          accountName: application.payoutAccountName,
          accountNumber: application.payoutAccountNumber,
          updatedAt: now,
        });
      }
    }

    // Brief Bab 4.8: delete transcript/asdos proof file from Storage after verification decision
    if (application.proofStorageId) {
      await ctx.storage.delete(application.proofStorageId);
    }

    await ctx.db.patch("tutorApplications", application._id, {
      status: "approved",
      proofStorageId: undefined,
      reviewedBy: admin.adminUserId,
      reviewedAt: now,
    });

    if (user) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendTransactionalEmail, {
        to: user.email,
        subject: "[KOLEARA] Pengajuan Tutor Anda Disetujui!",
        html: `<p>Halo ${application.name},</p><p>Selamat! Pengajuan tutor Anda telah diverifikasi (lencana: <strong>${badge === "asdos" ? "Verified Asdos" : "Verified Grade"}</strong>). Profil Anda kini tampil di pencarian tutor KOLEARA.</p>`,
      });
    }

    const updatedTutor = await ctx.db.get("tutors", tutorDocId!);
    return {
      ok: true as const,
      data: await mapTutorDoc(ctx, updatedTutor!),
    };
  },
});

export const rejectTutorApplication = mutation({
  args: {
    applicationId: v.string(),
    rejectionReason: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.object({
    rejected: v.boolean(),
    unauthorized: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
      nowMs: now,
    });
    if (!admin.authorized) {
      return { rejected: false, unauthorized: true };
    }

    const application = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", args.applicationId))
      .first();

    if (!application || application.status !== "pending") {
      return { rejected: false };
    }

    // Brief Bab 4.8: delete proof file after admin decision
    if (application.proofStorageId) {
      await ctx.storage.delete(application.proofStorageId);
    }

    const reason =
      args.rejectionReason?.trim().slice(0, 300) ||
      "Pengajuan belum memenuhi syarat verifikasi kompetensi ITS.";

    await ctx.db.patch("tutorApplications", application._id, {
      status: "rejected",
      proofStorageId: undefined,
      reviewedBy: admin.adminUserId,
      reviewedAt: now,
      rejectionReason: reason,
    });

    const user = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", application.userId))
      .first();
    if (user) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendTransactionalEmail, {
        to: user.email,
        subject: "[KOLEARA] Pembaruan Pengajuan Tutor",
        html: `<p>Halo ${application.name},</p><p>Mohon maaf, pengajuan tutor Anda belum dapat disetujui. Alasan: ${reason}</p><p>Anda dapat mengajukan ulang melalui halaman Jadi Tutor.</p>`,
      });
    }

    return { rejected: true };
  },
});

export const listPendingPayments = query({
  args: {
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.array(paymentObjectValidator),
  handler: async (ctx, args) => {
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    if (!admin.authorized) return [];
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_status", (q) => q.eq("status", "pending_verification"))
      .order("desc")
      .take(100);

    return await Promise.all(
      rows.map(async (row) => {
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
      }),
    );
  },
});

/**
 * Brief F11: Admin payout queue — groups completed/forfeited bookings ready for payout by tutor.
 */
export const listReadyPayouts = query({
  args: {
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      tutorId: v.string(),
      tutorName: v.string(),
      totalAmount: v.number(),
      bookingIds: v.array(v.string()),
      payoutAccount: v.union(tutorPayoutAccountObjectValidator, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    if (!admin.authorized) return [];

    const [completedBookings, cancelledBookings] = await Promise.all([
      ctx.db
        .query("bookings")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", "completed"))
        .order("desc")
        .take(200),
      ctx.db
        .query("bookings")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", "cancelled"))
        .order("desc")
        .take(200),
    ]);

    const ready = [...completedBookings, ...cancelledBookings].filter(
      (b) => b.escrowStatus === "ready_for_payout",
    );

    const byTutor = new Map<string, { amount: number; bookingIds: string[] }>();
    for (const b of ready) {
      const entry = byTutor.get(b.tutorId) ?? { amount: 0, bookingIds: [] };
      entry.amount += b.price;
      entry.bookingIds.push(b.appId);
      byTutor.set(b.tutorId, entry);
    }

    const tutorIds = Array.from(byTutor.keys());
    const results = await Promise.all(
      tutorIds.map(async (tutorId) => {
        const [tutor, account] = await Promise.all([
          ctx.db
            .query("tutors")
            .withIndex("by_appId", (q) => q.eq("appId", tutorId))
            .first(),
          ctx.db
            .query("tutorPayoutAccounts")
            .withIndex("by_tutorId", (q) => q.eq("tutorId", tutorId))
            .first(),
        ]);
        const bucket = byTutor.get(tutorId)!;
        return {
          tutorId,
          tutorName: tutor?.name ?? tutorId,
          totalAmount: bucket.amount,
          bookingIds: bucket.bookingIds,
          payoutAccount: account
            ? {
                tutorId: account.tutorId,
                userId: account.userId,
                bankOrWallet: account.bankOrWallet,
                accountName: account.accountName,
                accountNumber: account.accountNumber,
                updatedAt: account.updatedAt,
              }
            : null,
        };
      }),
    );

    return results.sort((a, b) => b.totalAmount - a.totalAmount);
  },
});

export const createPayoutBatch = mutation({
  args: {
    tutorId: v.string(),
    bookingIds: v.optional(v.array(v.string())),
    proofStorageId: v.optional(v.id("_storage")),
    proofFileName: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: serviceResultValidator(payoutObjectValidator),
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
        error: "Akses admin diperlukan untuk mencairkan honor.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
      .first();
    if (!tutor) {
      return {
        ok: false as const,
        code: "TUTOR_NOT_FOUND",
        error: "Tutor tidak ditemukan.",
      };
    }

    const tutorBookings = await ctx.db
      .query("bookings")
      .withIndex("by_tutorId_and_startAt", (q) => q.eq("tutorId", tutor.appId))
      .take(200);

    const allowedIds = args.bookingIds ? new Set(args.bookingIds) : null;
    const eligible = tutorBookings.filter(
      (b) =>
        b.escrowStatus === "ready_for_payout" &&
        (!allowedIds || allowedIds.has(b.appId)),
    );

    if (eligible.length === 0) {
      return {
        ok: false as const,
        code: "NO_ELIGIBLE_BOOKINGS",
        error: "Tidak ada sesi yang siap dicairkan untuk tutor ini.",
      };
    }

    const totalAmount = eligible.reduce((sum, b) => sum + b.price, 0);
    const bookingIds = eligible.map((b) => b.appId);
    const payoutAppId = `payout-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const proofFileName = args.proofFileName
      ? sanitizeProofFileName(args.proofFileName)
      : undefined;

    await ctx.db.insert("payouts", {
      appId: payoutAppId,
      tutorId: tutor.appId,
      amount: totalAmount,
      bookingIds,
      status: "paid_out",
      proofStorageId: args.proofStorageId,
      proofFileName,
      paidOutAt: now,
      processedBy: admin.adminUserId,
      createdAt: now,
    });

    for (const b of eligible) {
      await ctx.db.patch("bookings", b._id, {
        escrowStatus: "paid_out",
      });
    }

    const proofUrl = args.proofStorageId
      ? ((await ctx.storage.getUrl(args.proofStorageId)) ?? undefined)
      : undefined;

    const tutorUser = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", tutor.userId))
      .first();
    if (tutorUser) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendTransactionalEmail, {
        to: tutorUser.email,
        subject: `[KOLEARA] Honor Rp${totalAmount.toLocaleString("id-ID")} telah dicairkan`,
        html: `<p>Halo ${tutor.name},</p><p>Honor untuk ${bookingIds.length} sesi sebesar <strong>Rp${totalAmount.toLocaleString("id-ID")}</strong> telah ditransfer oleh admin KOLEARA.</p>`,
      });
    }

    return {
      ok: true as const,
      data: {
        id: payoutAppId,
        tutorId: tutor.appId,
        amount: totalAmount,
        bookingIds,
        status: "paid_out" as const,
        proofStorageId: args.proofStorageId,
        proofFileName,
        proofUrl,
        paidOutAt: now,
        processedBy: admin.adminUserId,
        createdAt: now,
      },
    };
  },
});

export const listPayouts = query({
  args: {
    tutorId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.array(payoutObjectValidator),
  handler: async (ctx, args) => {
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });

    if (args.tutorId) {
      const tutorId = args.tutorId;
      const rows = await ctx.db
        .query("payouts")
        .withIndex("by_tutorId_and_createdAt", (q) => q.eq("tutorId", tutorId))
        .order("desc")
        .take(50);

      if (!admin.authorized) {
        // Only allow the owning tutor to read their own payout history
        const tutor = await ctx.db
          .query("tutors")
          .withIndex("by_appId", (q) => q.eq("appId", tutorId))
          .first();
        if (!tutor) return [];
        const caller = await resolveSessionUser(ctx, args.sessionToken);
        if (!caller || caller.appId !== tutor.userId) return [];
      }

      return await Promise.all(
        rows.map(async (row) => ({
          id: row.appId,
          tutorId: row.tutorId,
          amount: row.amount,
          bookingIds: row.bookingIds,
          status: row.status,
          proofStorageId: row.proofStorageId,
          proofFileName: row.proofFileName,
          proofUrl: row.proofStorageId
            ? ((await ctx.storage.getUrl(row.proofStorageId)) ?? undefined)
            : undefined,
          paidOutAt: row.paidOutAt,
          processedBy: row.processedBy,
          createdAt: row.createdAt,
        })),
      );
    }

    if (!admin.authorized) return [];
    const rows = await ctx.db.query("payouts").order("desc").take(100);
    return await Promise.all(
      rows.map(async (row) => ({
        id: row.appId,
        tutorId: row.tutorId,
        amount: row.amount,
        bookingIds: row.bookingIds,
        status: row.status,
        proofStorageId: row.proofStorageId,
        proofFileName: row.proofFileName,
        proofUrl: row.proofStorageId
          ? ((await ctx.storage.getUrl(row.proofStorageId)) ?? undefined)
          : undefined,
        paidOutAt: row.paidOutAt,
        processedBy: row.processedBy,
        createdAt: row.createdAt,
      })),
    );
  },
});
